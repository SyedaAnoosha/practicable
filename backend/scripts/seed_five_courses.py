"""Seed five complete courses into the database.

Creates:
  - 2 new sections (Compliance, Resilience) + reuses existing Risk Management
  - 2 new authors
  - 5 courses with modules, reading lessons (full HTML body + prose_sanitized),
    video lessons (reusing existing Mux assets), and generated cover images
    uploaded to Supabase Storage.

Usage:
    cd backend && python -m scripts.seed_five_courses

Requires DATABASE_URL and Supabase Storage credentials in .env.
"""

from __future__ import annotations

import asyncio
import io
import math
import uuid
from dataclasses import dataclass, field
from typing import Optional

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.html_sanitizer import sanitize_html
from app.db.models import (
    Author,
    Course,
    Lesson,
    LessonType,
    LessonBlock,
    LessonBlockType,
    Media,
    MediaStatus,
    Module,
    Section,
)
from app.db.session import AsyncSessionLocal
from app.integrations.storage_client import upload_file


# ─── Image generation ────────────────────────────────────────────────────────

IMG_W, IMG_H = 1280, 720


def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _darken(rgb: tuple[int, int, int], factor: float = 0.3) -> tuple[int, int, int]:
    return tuple(max(0, int(c * (1 - factor))) for c in rgb)  # type: ignore[return-value]


def _lighten(rgb: tuple[int, int, int], factor: float = 0.4) -> tuple[int, int, int]:
    return tuple(min(255, int(c + (255 - c) * factor)) for c in rgb)  # type: ignore[return-value]


def _generate_cover(
    title: str,
    subtitle: str,
    bg_color: str,
    accent_color: str,
    pattern: str = "circles",
) -> bytes:
    """Generate a course cover image and return JPEG bytes."""
    bg = _hex_to_rgb(bg_color)
    accent = _hex_to_rgb(accent_color)
    img = Image.new("RGB", (IMG_W, IMG_H), bg)
    draw = ImageDraw.Draw(img)

    # Background pattern
    if pattern == "circles":
        for i in range(12):
            r = 40 + i * 25
            x = IMG_W - 200 + (i % 3) * 30
            y = 100 + (i // 3) * 50
            draw.ellipse(
                [x - r, y - r, x + r, y + r],
                outline=_lighten(bg, 0.15),
                width=2,
            )
    elif pattern == "grid":
        for x in range(0, IMG_W, 60):
            draw.line([(x, 0), (x, IMG_H)], fill=_lighten(bg, 0.08), width=1)
        for y in range(0, IMG_H, 60):
            draw.line([(0, y), (IMG_W, y)], fill=_lighten(bg, 0.08), width=1)
    elif pattern == "diagonal":
        for offset in range(-IMG_H, IMG_W + IMG_H, 40):
            draw.line(
                [(offset, 0), (offset + IMG_H, IMG_H)],
                fill=_lighten(bg, 0.08),
                width=1,
            )
    elif pattern == "waves":
        for wave_y in range(0, IMG_H, 80):
            points = []
            for x in range(0, IMG_W + 10, 10):
                y = wave_y + int(20 * math.sin(x / 80))
                points.append((x, y))
            if len(points) >= 2:
                draw.line(points, fill=_lighten(bg, 0.1), width=1)
    elif pattern == "dots":
        for x in range(30, IMG_W, 50):
            for y in range(30, IMG_H, 50):
                draw.ellipse(
                    [x - 3, y - 3, x + 3, y + 3],
                    fill=_lighten(bg, 0.12),
                )

    # Accent bar on the left
    draw.rectangle([0, 0, 12, IMG_H], fill=accent)

    # Small accent circle
    draw.ellipse([IMG_W - 180, IMG_H - 180, IMG_W - 40, IMG_H - 40], fill=accent)

    # Title text — use default font, scale up
    try:
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
    except (OSError, IOError):
        font_title = ImageFont.load_default(size=48)

    try:
        font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
    except (OSError, IOError):
        font_sub = ImageFont.load_default(size=24)

    # Draw title (wrap if needed)
    text_color = (255, 255, 255)
    title_lines = _wrap_text(title, font_title, IMG_W - 200)
    y_pos = IMG_H // 2 - len(title_lines) * 30
    for line in title_lines:
        draw.text((60, y_pos), line, fill=text_color, font=font_title)
        y_pos += 60

    # Subtitle
    y_pos += 20
    draw.text((60, y_pos), subtitle, fill=_lighten(bg, 0.7), font=font_sub)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def _wrap_text(text: str, font, max_width: int) -> list[str]:
    """Simple word-wrap for the cover title."""
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        test = f"{current} {word}".strip()
        bbox = font.getbbox(test)
        if bbox[2] - bbox[0] > max_width and current:
            lines.append(current)
            current = word
        else:
            current = test
    if current:
        lines.append(current)
    return lines or [text]


# ─── Course data ─────────────────────────────────────────────────────────────


@dataclass
class LessonData:
    slug: str
    title: str
    description: str
    lesson_type: LessonType = LessonType.READING
    body: str = ""  # HTML for reading lessons
    sort_order: int = 0
    # For video lessons — will be resolved to an existing Mux asset at runtime
    reuse_video: bool = False
    duration_seconds: int = 0


@dataclass
class ModuleData:
    title: str
    description: str
    sort_order: int = 0
    lessons: list[LessonData] = field(default_factory=list)


@dataclass
class CourseData:
    slug: str
    title: str
    subtitle: str
    description: str
    section_slug: str
    author_slug: str
    level: str
    estimated_duration_minutes: int
    cover_bg: str
    cover_accent: str
    cover_pattern: str
    modules: list[ModuleData] = field(default_factory=list)


COURSES: list[CourseData] = [
    # ── Course 1 ──────────────────────────────────────────────────────────
    CourseData(
        slug="building-an-effective-risk-register",
        title="Building an Effective Risk Register",
        subtitle="From blank spreadsheet to decision-ready tool",
        description=(
            "A risk register is only useful if people actually read it. This course "
            "walks you through building a register that drives decisions — writing clear "
            "risk statements, choosing the right ratings, assigning real owners, and "
            "keeping the whole thing alive after the initial enthusiasm fades."
        ),
        section_slug="risk-management",
        author_slug="practicable-author",
        level="beginner",
        estimated_duration_minutes=120,
        cover_bg="#142E5C",
        cover_accent="#7C9CD6",
        cover_pattern="circles",
        modules=[
            ModuleData(
                title="Why Most Risk Registers Fail",
                description="Understanding the common patterns that kill register adoption.",
                sort_order=0,
                lessons=[
                    LessonData(
                        slug="the-risk-register-problem",
                        title="The Risk Register Problem",
                        description="Why most risk registers end up as compliance artifacts rather than decision tools.",
                        body=(
                            "<h2>The register no one opens</h2>\n"
                            "<p>Walk into almost any organisation and ask to see the risk register. "
                            "Someone will pull up a spreadsheet — usually enormous, usually colour-coded, "
                            "usually not updated since last quarter. The columns will contain a mix of "
                            "vague statements, ratings that no one can explain the basis for, and owners "
                            "who may not know they're listed.</p>\n"
                            "<p>This is not a failure of methodology. ISO 31000, COSO, and every other "
                            "framework describe perfectly good risk register structures. The failure is "
                            "practical: the register was built for the audit, not for the people who "
                            "need to manage risk day to day.</p>\n"
                            "<h2>What a register is actually for</h2>\n"
                            "<p>A risk register exists to answer three questions:</p>\n"
                            "<ul>\n"
                            "<li><strong>What could go wrong?</strong> — not in abstract categories, "
                            "but in specific, named events with real consequences.</li>\n"
                            "<li><strong>Who is doing something about it?</strong> — one person, not "
                            "a committee or a department.</li>\n"
                            "<li><strong>What happens next?</strong> — a concrete action with a date, "
                            "not a vague \"monitor\" or \"review\".</li>\n"
                            "</ul>\n"
                            "<p>If your register cannot answer all three for every entry, it is a list, "
                            "not a register. Lists do not get used because there is nothing to <em>do</em> "
                            "with them.</p>\n"
                            "<h2>The fix is not a new template</h2>\n"
                            "<p>Most teams respond to a dead register by redesigning the spreadsheet. "
                            "New columns, new colours, new approval workflow. This almost never works "
                            "because the problem is not the template — it is the entries themselves. "
                            "A well-written entry in a simple spreadsheet beats a badly-written entry "
                            "in a sophisticated one every time.</p>\n"
                            "<p>This course teaches you to write entries that people actually read, "
                            "and to build the habits that keep a register alive. No framework worship, "
                            "no compliance theatre — just the practical mechanics of making risk "
                            "management visible to the people who need to act on it.</p>"
                        ),
                        sort_order=0,
                    ),
                    LessonData(
                        slug="reading-a-dead-register",
                        title="Reading a Dead Register",
                        description="How to diagnose what went wrong by reading the entries themselves.",
                        body=(
                            "<h2>The autopsy</h2>\n"
                            "<p>Before you fix a register, you need to understand what killed it. "
                            "The diagnosis is almost always in the entries themselves — you do not need "
                            "a consultant or a framework review. Open the register and read twenty entries. "
                            "You will usually find the same four problems repeated across all of them.</p>\n"
                            "<h2>Problem 1: Vague risk statements</h2>\n"
                            "<p>\"Risk to business performance\" is not a risk statement. It is a "
                            "category heading. A real risk names an event and its consequence: "
                            "\"A failure of our primary logistics provider could delay customer "
                            "deliveries by more than 48 hours.\" The difference is specificity — "
                            "one describes a possibility, the other describes a scenario someone "
                            "can plan for.</p>\n"
                            "<h2>Problem 2: Phantom owners</h2>\n"
                            "<p>Check the owner column. If it says \"Operations\" or \"Finance\" or "
                            "\"IT Team\", the risk is not owned — it is assigned to a group, which "
                            "means it is assigned to no one. Ownership requires a name. If you cannot "
                            "name a single person accountable for this risk, that is itself a finding "
                            "worth recording.</p>\n"
                            "<h2>Problem 3: Placeholder actions</h2>\n"
                            "<p>Look at the action column. If more than a third of entries say "
                            "\"Monitor\", \"Review\", or \"Ongoing\", the register has become a "
                            "watchlist. Monitoring is not an action — it is the absence of one. "
                            "Every entry should have a next step that is concrete enough that "
                            "someone could do it this week, with a date attached.</p>\n"
                            "<h2>Problem 4: Stale dates</h2>\n"
                            "<p>Sort by last-updated. If the oldest entries have not been touched "
                            "in months, the register is not being managed — it is being stored. "
                            "A register that is not actively maintained is worse than no register "
                            "at all, because it creates the illusion that risks are being tracked "
                            "when they are not.</p>\n"
                            "<h2>What to do with the diagnosis</h2>\n"
                            "<p>You do not need to fix everything at once. Start with the entries "
                            "that matter most — the top five risks the board cares about — and "
                            "rewrite them using the principles in the rest of this course. "
                            "A register with five excellent entries is more useful than one with "
                            "fifty terrible ones.</p>"
                        ),
                        sort_order=1,
                    ),
                    LessonData(
                        slug="the-one-sentence-risk-test",
                        title="The One-Sentence Risk Test",
                        description="A practical test for whether your risk statements are clear enough.",
                        body=(
                            "<h2>The test</h2>\n"
                            "<p>Here is a test you can apply to every risk statement in your register: "
                            "<strong>Would a board member know what decision or action this entry "
                            "requires, without asking you to explain it out loud?</strong></p>\n"
                            "<p>If the answer is no, the entry is not done. It might be accurate, "
                            "it might be well-researched, it might use all the right terminology — "
                            "but if a busy decision-maker cannot read it and understand what needs "
                            "to happen, it has failed at its primary job.</p>\n"
                            "<h2>Why this works</h2>\n"
                            "<p>The test forces clarity by removing the safety net of context. "
                            "When you write a risk statement, you carry the full picture in your "
                            "head — the history, the politics, the technical details. The register "
                            "does not carry any of that. It sits in a spreadsheet, read (if it is "
                            "read at all) by people who do not have your context. The one-sentence "
                            "test simulates that reality.</p>\n"
                            "<h2>Before and after</h2>\n"
                            "<p><strong>Before:</strong> \"There is a risk that changes in our "
                            "operating environment could impact business performance.\"</p>\n"
                            "<p><strong>After:</strong> \"A failure of our primary logistics "
                            "provider could delay customer deliveries by more than 48 hours.\"</p>\n"
                            "<p>The \"after\" version names the event — a specific provider "
                            "failing — and the consequence, with a number attached. Anyone "
                            "reading it, including someone outside your team, knows exactly "
                            "what is being tracked.</p>\n"
                            "<h2>Applying the test</h2>\n"
                            "<p>Go through your register and apply this test to every entry. "
                            "For each one that fails, rewrite it as a single sentence: an event, "
                            "and its business consequence. Do not add context, do not add "
                            "background, do not hedge. Just the risk. You can always add detail "
                            "in a separate notes field, but the headline must stand on its own.</p>"
                        ),
                        sort_order=2,
                    ),
                ],
            ),
            ModuleData(
                title="Writing Clear Risk Entries",
                description="The mechanics of writing risk statements that people can act on.",
                sort_order=1,
                lessons=[
                    LessonData(
                        slug="writing-entries-people-actually-read",
                        title="Writing Entries People Actually Read",
                        description="Practical guidance on crafting risk statements that drive action.",
                        body=(
                            "<h2>Why register entries become unreadable</h2>\n"
                            "<p>Most registers fail long before anyone questions the framework. "
                            "They fail at the sentence level — one vague line nobody can act on, "
                            "sitting in a spreadsheet nobody opens again. Four habits are enough "
                            "to kill a register on their own.</p>\n"
                            "<ul>\n"
                            "<li><strong>Vague risk statements.</strong> \"Risk to business "
                            "performance\" describes almost nothing — it could mean a dozen "
                            "different failures, so a reader has no idea what is actually "
                            "being tracked.</li>\n"
                            "<li><strong>No clear owner.</strong> A risk that is not tied to "
                            "one named person is not managed, it is recorded. Ownership is "
                            "what turns an entry into a commitment instead of a note.</li>\n"
                            "<li><strong>No action.</strong> A risk with a rating and no next "
                            "step is a warning with nowhere to go. It sits there, gets reviewed "
                            "every quarter, and nothing changes.</li>\n"
                            "<li><strong>Too much background.</strong> Explaining the entire "
                            "operating environment before naming the risk buries the one "
                            "sentence that matters under paragraphs that do not move a "
                            "decision forward.</li>\n"
                            "</ul>\n"
                            "<h2>Write the risk in one sentence</h2>\n"
                            "<p>Before you touch a template, write the risk as a single, "
                            "specific sentence: an event, and its business consequence. If it "
                            "takes more than one sentence, you are probably describing a cause "
                            "and an effect that should stay separate — or you have not actually "
                            "decided what the risk is yet.</p>\n"
                            "<h2>Add the owner</h2>\n"
                            "<p>Every entry needs one name, not a team and not a function. "
                            "\"Operations\" is not an owner; \"Operations Manager, J. Reyes\" "
                            "is. If you cannot name a single accountable person, that is worth "
                            "flagging on its own — a risk with no owner is really an unassigned "
                            "decision waiting to happen.</p>\n"
                            "<h2>Add the next action</h2>\n"
                            "<p>The action is what makes an entry worth returning to. It does "
                            "not need to be the finished mitigation plan, just the next concrete "
                            "step and a date. \"Confirm backup logistics provider by 30 September\" "
                            "tells the reader something is actually moving. \"Monitor\" is not an "
                            "action, it is a placeholder for one.</p>\n"
                            "<h2>Quick checklist</h2>\n"
                            "<p>Before you file an entry, check it has:</p>\n"
                            "<ul>\n"
                            "<li>A specific event, not a category</li>\n"
                            "<li>A stated business consequence</li>\n"
                            "<li>A clear, named owner</li>\n"
                            "<li>A next action with a date</li>\n"
                            "<li>Wording a stranger could understand without you in the room</li>\n"
                            "</ul>"
                        ),
                        sort_order=0,
                    ),
                    LessonData(
                        slug="choosing-the-right-risk-rating",
                        title="Choosing the Right Risk Rating",
                        description="When ratings help, when they hurt, and how to keep them honest.",
                        body=(
                            "<h2>The rating trap</h2>\n"
                            "<p>Risk ratings — the familiar likelihood × impact matrix — are "
                            "the most abused tool in risk management. Teams spend hours debating "
                            "whether a risk is a \"4\" or a \"5\" while the actual decision "
                            "(what to do about it) goes unmade. The rating becomes the output "
                            "of the risk process rather than an input to a decision.</p>\n"
                            "<h2>When ratings help</h2>\n"
                            "<p>Ratings are useful for one thing: <strong>prioritisation</strong>. "
                            "When you have fifty risks and need to decide which ten to focus on "
                            "this quarter, a consistent rating system gives you a defensible "
                            "way to rank them. That is their entire value.</p>\n"
                            "<h2>When ratings hurt</h2>\n"
                            "<p>Ratings become harmful when:</p>\n"
                            "<ul>\n"
                            "<li>They replace judgment — a risk rated \"Medium\" gets less "
                            "attention than one rated \"High\" regardless of context</li>\n"
                            "<li>The scoring criteria are unclear — two people rate the same "
                            "risk differently because they are using different mental models</li>\n"
                            "<li>The matrix becomes the report — the board sees coloured boxes "
                            "instead of named risks with owners and actions</li>\n"
                            "</ul>\n"
                            "<h2>A practical rating system</h2>\n"
                            "<p>If you use ratings, keep them simple:</p>\n"
                            "<ul>\n"
                            "<li><strong>Likelihood:</strong> Rare (1), Unlikely (2), Possible (3), "
                            "Likely (4), Almost Certain (5)</li>\n"
                            "<li><strong>Impact:</strong> Insignificant (1), Minor (2), Moderate (3), "
                            "Major (4), Catastrophic (5)</li>\n"
                            "</ul>\n"
                            "<p>Multiply for a score of 1–25. Anything above 15 gets a board-level "
                            "action plan. Anything below 5 gets monitored. Everything in between "
                            "is the manager's judgment call — and that is fine. The rating is a "
                            "conversation starter, not a decision.</p>\n"
                            "<h2>The real rule</h2>\n"
                            "<p>Never let the rating be the end of the discussion. Every rated "
                            "risk should have a plain-English summary that explains <em>why</em> "
                            "it got that score. If you cannot explain the rating in one sentence, "
                            "the rating is not doing its job.</p>"
                        ),
                        sort_order=1,
                    ),
                    LessonData(
                        slug="owners-accountability-and-follow-through",
                        title="Owners, Accountability, and Follow-Through",
                        description="Why named ownership is the single most important column in your register.",
                        body=(
                            "<h2>Why ownership matters more than ratings</h2>\n"
                            "<p>A risk with a clear owner and a mediocre rating will get managed. "
                            "A risk with a perfect rating and no owner will not. Ownership is "
                            "the mechanism that turns a record into a commitment — it is the "
                            "column that determines whether anything actually happens.</p>\n"
                            "<h2>What good ownership looks like</h2>\n"
                            "<p>Good ownership means one person, named explicitly, who has the "
                            "authority to act and the accountability to follow through. It does "
                            "not mean the person who sits in the risk committee. It does not mean "
                            "the head of department whose name is on the org chart. It means the "
                            "person who will actually do the work — or escalate if they cannot.</p>\n"
                            "<h2>The anti-patterns</h2>\n"
                            "<p>Watch for these common failures:</p>\n"
                            "<ul>\n"
                            "<li><strong>Team ownership:</strong> \"Operations\" or \"Finance\" "
                            "as the owner. This is not ownership, it is distribution — and "
                            "distributed ownership is no ownership at all.</li>\n"
                            "<li><strong>Escalation ownership:</strong> The CEO listed as owner "
                            "of every high-rated risk. If the CEO owns it, nobody owns it — "
                            "the register has become an escalation list rather than a management "
                            "tool.</li>\n"
                            "<li><strong>Phantom ownership:</strong> A name listed but the "
                            "person has never been told they are the owner. Ownership requires "
                            "consent and capability.</li>\n"
                            "</ul>\n"
                            "<h2>Making ownership stick</h2>\n"
                            "<p>Three practical steps:</p>\n"
                            "<ol>\n"
                            "<li><strong>Tell them.</strong> Every person listed as a risk owner "
                            "should know they are listed, and understand what that means — "
                            "specifically, that they are expected to take the next action and "
                            "report progress.</li>\n"
                            "<li><strong>Give them authority.</strong> An owner without authority "
                            "to spend money, hire people, or change processes cannot actually "
                            "manage the risk. If the owner cannot act, the register is a fiction.</li>\n"
                            "<li><strong>Follow up.</strong> Review owners, not just risks. If "
                            "an owner has not updated their entries in ninety days, that is a "
                            "conversation to have — not a column to fill in.</li>\n"
                            "</ol>"
                        ),
                        sort_order=2,
                    ),
                    LessonData(
                        slug="the-reading-lesson-body",
                        title="Reviewing and Maintaining Your Register",
                        description="How to keep the register alive after the initial setup.",
                        body=(
                            "<h2>The maintenance problem</h2>\n"
                            "<p>Most registers die within six months. The initial enthusiasm "
                            "fades, entries stop getting updated, and the register becomes a "
                            "historical record rather than a living management tool. This lesson "
                            "is about building the habits that prevent that.</p>\n"
                            "<h2>The quarterly review that actually works</h2>\n"
                            "<p>Quarterly reviews fail because they are too infrequent and too "
                            "formal. By the time the review meeting happens, the register is "
                            "already stale. Instead, try a lighter rhythm:</p>\n"
                            "<ul>\n"
                            "<li><strong>Monthly:</strong> Each owner updates their own entries "
                            "— status, next action, any changes. Five minutes per entry.</li>\n"
                            "<li><strong>Quarterly:</strong> A brief review meeting where the "
                            "top ten risks are discussed. Not a presentation — a conversation "
                            "about what has changed and what needs attention.</li>\n"
                            "<li><strong>Annually:</strong> A full review of the register "
                            "structure, categories, and whether the right risks are being "
                            "tracked.</li>\n"
                            "</ul>\n"
                            "<h2>New risks, retired risks</h2>\n"
                            "<p>The register should grow and shrink. New risks emerge — a "
                            "new regulation, a new technology, a new market. Old risks "
                            "retire — the threat is gone, the mitigation worked, the risk "
                            "is now accepted. A register that only grows is not being "
                            "curated; it is being accumulated.</p>\n"
                            "<h2>The measure of success</h2>\n"
                            "<p>You know your register is working when people <em>ask</em> "
                            "for it. When a project manager says \"I need to check the risk "
                            "register before I commit to this timeline\" — that is the moment "
                            "the register has crossed from compliance artifact to management "
                            "tool. Everything in this course is aimed at reaching that point.</p>"
                        ),
                        sort_order=3,
                    ),
                ],
            ),
            ModuleData(
                title="Ratings, Owners, and Follow-Through",
                description="Building the accountability layer that makes risk management real.",
                sort_order=2,
                lessons=[
                    LessonData(
                        slug="building-the-owners-list",
                        title="Building the Owners List",
                        description="How to create a realistic ownership structure for your risk register.",
                        body=(
                            "<h2>Start with the people who can act</h2>\n"
                            "<p>The owners list is not the org chart. It is a list of the "
                            "people in your organisation who have the authority and the "
                            "capability to actually manage a risk. That usually means they "
                            "can spend money, change a process, or hire someone — without "
                            "needing three levels of approval.</p>\n"
                            "<h2>How many owners do you need?</h2>\n"
                            "<p>Fewer than you think. A register with fifty risks does not "
                            "need fifty owners. It needs ten to fifteen people who between "
                            "them cover the major risk areas. One person can own multiple "
                            "risks — what matters is that they have the context and authority "
                            "to manage each one.</p>\n"
                            "<h2>The owner conversation</h2>\n"
                            "<p>Before you add someone to the owners list, have a conversation. "
                            "Explain what ownership means — not just the title, but the "
                            "expectation: update your entries monthly, take the next action, "
                            "escalate if you cannot resolve it. Get their agreement. An owner "
                            "who does not know they are an owner is worse than no owner at all.</p>\n"
                            "<h2>When an owner leaves</h2>\n"
                            "<p>Build a handover into the process. When someone changes roles "
                            "or leaves the organisation, their risks need a new owner before "
                            "they go. This is a two-minute conversation, not a project — but it "
                            "only happens if you make it someone's job to have it.</p>\n"
                            "<h2>Practical exercise</h2>\n"
                            "<p>List the people in your organisation who could realistically "
                            "own a risk. Write their name, their role, and the risk area they "
                            "could cover. If there are gaps — areas with no possible owner — "
                            "that is a finding worth raising with the board.</p>"
                        ),
                        sort_order=0,
                    ),
                    LessonData(
                        slug="escalation-what-to-raise-and-when",
                        title="Escalation: What to Raise and When",
                        description="Building a clear escalation path that does not bypass the register.",
                        body=(
                            "<h2>Escalation is not failure</h2>\n"
                            "<p>Many teams treat escalation as an admission that risk management "
                            "has failed. It has not. Escalation is the mechanism that ensures "
                            "risks beyond an owner's authority get the attention they need. "
                            "A register with no escalation path is a register where high-rated "
                            "risks sit unactioned because no one has the authority to deal with "
                            "them.</p>\n"
                            "<h2>When to escalate</h2>\n"
                            "<p>Clear triggers make escalation objective rather than political:</p>\n"
                            "<ul>\n"
                            "<li>The risk rating has increased (a new impact or higher likelihood)</li>\n"
                            "<li>The owner cannot take the required action within their authority</li>\n"
                            "<li>The risk has materialised or partially materialised</li>\n"
                            "<li>The mitigation is not working as expected</li>\n"
                            "</ul>\n"
                            "<h2>What to escalate</h2>\n"
                            "<p>Escalate the <em>decision</em>, not the risk. \"I need approval "
                            "to spend $50K on a backup provider\" is an escalation. \"Our supply "
                            "chain risk is rated High\" is a statement. The register should make "
                            "it clear what decision is needed, who needs to make it, and what "
                            "the consequences of delay are.</p>\n"
                            "<h2>The escalation register</h2>\n"
                            "<p>Consider adding an \"escalated\" flag to your register. When a "
                            "risk is escalated, it should be visible — both to the board and to "
                            "the owner. This prevents the common failure where a risk is "
                            "escalated and then forgotten because no one is tracking the "
                            "escalation itself.</p>"
                        ),
                        sort_order=1,
                    ),
                    LessonData(
                        slug="keeping-the-register-alive",
                        title="Keeping the Register Alive",
                        description="Hoods and processes that prevent the register from going stale.",
                        body=(
                            "<h2>The graveyard of good intentions</h2>\n"
                            "<p>Every risk register starts with energy. The team gets together, "
                            "writes entries, assigns owners, sets actions. Three months later, "
                            "half the actions are overdue, two owners have changed roles, and "
                            "nobody has opened the spreadsheet since the last board pack was "
                            "assembled.</p>\n"
                            "<h2>The three habits that keep it alive</h2>\n"
                            "<p><strong>Habit 1: Tie it to existing meetings.</strong> Do not "
                            "create a new meeting for the risk register. Instead, add a ten-minute "
                            "standing agenda item to a meeting that already happens — the operations "
                            "review, the project standup, the leadership check-in. Review two or "
                            "three entries per meeting, not the whole register.</p>\n"
                            "<p><strong>Habit 2: Make owners report, not present.</strong> "
                            "Reporting is quick — \"my entry is on track / at risk / needs "
                            "help\" — and takes thirty seconds per entry. Presentations take "
                            "thirty minutes and bore everyone. The register lives on quick "
                            "updates, not slide decks.</p>\n"
                            "<p><strong>Habit 3: Celebrate closures.</strong> When a risk is "
                            "retired — the mitigation worked, the threat is gone — close it "
                            "publicly. This shows the register is not just a list of problems; "
                            "it is a list of problems that get solved. That is the single "
                            "strongest signal that risk management is working.</p>\n"
                            "<h2>The ninety-day test</h2>\n"
                            "<p>Check your register right now. How many entries have been "
                            "updated in the last ninety days? If the answer is less than half, "
                            "the register is dying. Apply the three habits above for the next "
                            "quarter and re-check. The metric is not the number of entries — "
                            "it is the number of entries that have been touched.</p>"
                        ),
                        sort_order=2,
                    ),
                ],
            ),
            ModuleData(
                title="From Register to Decisions",
                description="Using the register to drive real organisational decisions.",
                sort_order=3,
                lessons=[
                    LessonData(
                        slug="reporting-risk-to-the-board",
                        title="Reporting Risk to the Board",
                        description="How to present risk information that the board actually uses.",
                        body=(
                            "<h2>The board pack problem</h2>\n"
                            "<p>Most board risk reports are unreadable. They are either "
                            "too detailed (a fifty-page appendix no one opens) or too "
                            "vague (a one-page heatmap with no context). The board gets "
                            "the information but not the insight — they can see what is "
                            "rated red, but they cannot tell you what to do about it.</p>\n"
                            "<h2>What the board actually needs</h2>\n"
                            "<p>The board needs three things from a risk report:</p>\n"
                            "<ol>\n"
                            "<li><strong>The top risks</strong> — five to ten, not fifty. "
                            "The ones that could derail the strategy or the organisation.</li>\n"
                            "<li><strong>What has changed</strong> — new risks, retired risks, "
                            "risks that have moved up or down. Change is more important than "
                            "status.</li>\n"
                            "<li><strong>Decisions needed</strong> — explicit asks. \"We need "
                            "board approval for $X\" or \"We need a decision on Y\" or \"We "
                            "are proceeding with Z and the board should be aware.\"</li>\n"
                            "</ol>\n"
                            "<h2>The format that works</h2>\n"
                            "<p>A single page per risk, structured as:</p>\n"
                            "<ul>\n"
                            "<li><strong>Risk:</strong> one sentence (the one-sentence test)</li>\n"
                            "<li><strong>Change since last report:</strong> one sentence</li>\n"
                            "<li><strong>Action:</strong> what is being done, by whom, by when</li>\n"
                            "<li><strong>Ask:</strong> what the board needs to decide or approve</li>\n"
                            "</ul>\n"
                            "<p>This is one page per risk, not one page for the whole register. "
                            "The full register sits in the appendix for anyone who wants to dig "
                            "deeper, but the board gets the headline version first.</p>\n"
                            "<h2>The rhythm</h2>\n"
                            "<p>Report quarterly, with a short update at the halfway point. "
                            "Consistency matters more than perfection — the board will engage "
                            "with risk reporting if it arrives on time, every time, in the "
                            "same format. Change the format and you lose the audience.</p>"
                        ),
                        sort_order=0,
                    ),
                    LessonData(
                        slug="using-risk-to-prioritise-investment",
                        title="Using Risk to Prioritise Investment",
                        description="How risk intelligence changes where you spend money.",
                        body=(
                            "<h2>The investment question</h2>\n"
                            "<p>Every organisation has more risk than it can address. The "
                            "question is always: where do we spend our limited risk management "
                            "budget? The register should answer this question directly, but "
                            "most do not — because the entries are not written in a way that "
                            "connects risk to investment.</p>\n"
                            "<h2>The cost-benefit link</h2>\n"
                            "<p>For each high-rated risk, ask two questions:</p>\n"
                            "<ol>\n"
                            "<li><strong>What does it cost to mitigate?</strong> — not just "
                            "money, but time, people, and opportunity cost.</li>\n"
                            "<li><strong>What does it cost if it materialises?</strong> — "
                            "direct costs, indirect costs, and reputational impact.</li>\n"
                            "</ol>\n"
                            "<p>If the cost of mitigation is less than the expected cost of "
                            "the risk materialising, mitigate. If it is more, accept the risk "
                            "and document why. This is not complicated — it is basic "
                            "cost-benefit analysis applied to risk.</p>\n"
                            "<h2>The register as a business case</h2>\n"
                            "<p>A well-maintained register is the strongest business case "
                            "you can build for risk management investment. Instead of saying "
                            "\"we need more budget for risk,\" you can say \"here are the "
                            "five risks that could cost us $X, and here is what $Y in "
                            "mitigation would do.\" That is a conversation the board can "
                            "engage with.</p>\n"
                            "<h2>Prioritisation framework</h2>\n"
                            "<p>Use a simple three-tier approach:</p>\n"
                            "<ul>\n"
                            "<li><strong>Tier 1 — Act now:</strong> High-rated risks with "
                            "clear, affordable mitigations. Fund these immediately.</li>\n"
                            "<li><strong>Tier 2 — Plan:</strong> High-rated risks where "
                            "mitigation is expensive or complex. Develop a business case "
                            "and present it at the next investment cycle.</li>\n"
                            "<li><strong>Tier 3 — Accept:</strong> Risks where the cost of "
                            "mitigation exceeds the expected loss. Document the decision "
                            "and review annually.</li>\n"
                            "</ul>"
                        ),
                        sort_order=1,
                    ),
                    LessonData(
                        slug="embedding-risk-in-business-planning",
                        title="Embedding Risk in Business Planning",
                        description="Making risk management part of how the organisation plans and executes.",
                        body=(
                            "<h2>Risk as a planning input, not an afterthought</h2>\n"
                            "<p>Risk management is most effective when it is part of how the "
                            "organisation plans, not a separate activity that runs alongside "
                            "planning. The register should feed into strategy development, "
                            "project planning, and operational decision-making — not sit in "
                            "a silo waiting for someone to look at it.</p>\n"
                            "<h2>Three integration points</h2>\n"
                            "<p><strong>Strategy development:</strong> When the board is "
                            "setting strategy, the risk register should be on the table. "
                            "Which risks could prevent the strategy from succeeding? "
                            "What new risks does the strategy create? These questions "
                            "should be answered before the strategy is finalised, not "
                            "after.</p>\n"
                            "<p><strong>Project initiation:</strong> Every new project "
                            "should start with a risk check: what risks from the register "
                            "are relevant to this project? What new risks does this project "
                            "create? This takes ten minutes and prevents the common failure "
                            "where a project re-discovers a known risk that the organisation "
                            "already has a mitigation for.</p>\n"
                            "<p><strong>Operational reviews:</strong> Monthly or quarterly "
                            "operational reviews should include a risk checkpoint: what has "
                            "changed in the risk landscape since we last met? Are our "
                            "mitigations working? Do we need to adjust?</p>\n"
                            "<h2>The cultural shift</h2>\n"
                            "<p>Embedding risk in planning is ultimately a cultural shift. "
                            "It happens when people start asking \"what could go wrong?\" "
                            "as a normal part of decision-making, not as a separate risk "
                            "exercise. The register is the tool that enables this — but "
                            "only if it is visible, current, and trusted.</p>\n"
                            "<h2>Measuring success</h2>\n"
                            "<p>You know risk is embedded when project plans reference the "
                            "register, when strategy documents cite specific risks, and "
                            "when operational reviews include risk as a standard agenda "
                            "item. These are not lofty goals — they are practical habits "
                            "that any organisation can build.</p>"
                        ),
                        sort_order=2,
                    ),
                ],
            ),
        ],
    ),
    # ── Course 2 ──────────────────────────────────────────────────────────
    CourseData(
        slug="enterprise-risk-management-essentials",
        title="Enterprise Risk Management Essentials",
        subtitle="Building a framework that actually fits your organisation",
        description=(
            "Enterprise Risk Management (ERM) gets a bad reputation because most "
            "implementations are compliance projects disguised as management tools. "
            "This course cuts through the framework worship and shows you how to build "
            "an ERM programme that fits your organisation — not one that fits a "
            "textbook."
        ),
        section_slug="risk-management",
        author_slug="practicable-author",
        level="intermediate",
        estimated_duration_minutes=180,
        cover_bg="#1D6FA5",
        cover_accent="#A9D4EF",
        cover_pattern="grid",
        modules=[
            ModuleData(
                title="What ERM Actually Is (and Is Not)",
                description="Separating ERM from compliance theatre.",
                sort_order=0,
                lessons=[
                    LessonData(
                        slug="erm-vs-traditional-risk-management",
                        title="ERM vs Traditional Risk Management",
                        description="Understanding the difference — and why it matters.",
                        body=(
                            "<h2>The traditional approach</h2>\n"
                            "<p>Traditional risk management manages risks in silos. "
                            "The finance team manages financial risk. IT manages "
                            "technology risk. Operations manages operational risk. "
                            "Each team has its own register, its own ratings, and its "
                            "own reporting line. The problem is that the most dangerous "
                            "risks — the ones that can destroy an organisation — live in "
                            "the gaps between silos.</p>\n"
                            "<h2>What ERM changes</h2>\n"
                            "<p>ERM takes a portfolio view. Instead of asking \"what are "
                            "our technology risks?\" it asks \"what are the risks to our "
                            "strategic objectives?\" This shifts the conversation from "
                            "categories of risk to outcomes that matter to the board. "
                            "A cyber attack is a technology risk in traditional RM; in "
                            "ERM it is a risk to customer trust, revenue continuity, or "
                            "regulatory standing — and those are the terms the board "
                            "understands.</p>\n"
                            "<h2>The common mistake</h2>\n"
                            "<p>The most common ERM mistake is building a framework "
                            "first and fitting the organisation to it. COSO, ISO 31000, "
                            "and every other standard provide useful structures — but "
                            "they are frameworks, not blueprints. Your ERM programme "
                            "should be designed around your organisation's decision-making "
                            "process, not around a framework's document structure.</p>\n"
                            "<h2>The ERM test</h2>\n"
                            "<p>Here is a simple test: can your board name three strategic "
                            "risks and tell you what the organisation is doing about each "
                            "one? If they can, you have ERM. If they cannot, you have a "
                            "risk management function — which is not the same thing.</p>"
                        ),
                        sort_order=0,
                    ),
                    LessonData(
                        slug="the-risk-appetite-conversation",
                        title="The Risk Appetite Conversation",
                        description="How to define and communicate how much risk your organisation is willing to take.",
                        body=(
                            "<h2>What risk appetite actually means</h2>\n"
                            "<p>Risk appetite is the amount and type of risk an organisation "
                            "is willing to take in pursuit of its objectives. In practice, "
                            "it is the answer to the question: \"How much could we lose "
                            "before we change what we are doing?\" Most organisations have "
                            "never answered this question explicitly — which means the "
                            "answer is implicit, inconsistent, and usually discovered too "
                            "late.</p>\n"
                            "<h2>Why it matters</h2>\n"
                            "<p>Without a defined appetite, every risk feels like it needs "
                            "to be mitigated — which leads to either over-investment in "
                            "low-risk areas or under-investment in high-risk areas. Appetite "
                            "gives the organisation a shared reference point for how much "
                            "risk is acceptable, and how much is not.</p>\n"
                            "<h2>How to have the conversation</h2>\n"
                            "<p>Risk appetite is a board-level conversation, not a risk "
                            "team exercise. The board needs to answer:</p>\n"
                            "<ul>\n"
                            "<li>What level of financial loss would require us to change "
                            "our strategy?</li>\n"
                            "<li>What level of reputational damage would be unacceptable?</li>\n"
                            "<li>What regulatory breaches are we absolutely not willing to "
                            "tolerate?</li>\n"
                            "</ul>\n"
                            "<p>These answers should be documented in plain language — not "
                            "in a risk appetite statement that reads like it was written by "
                            "a committee of lawyers. If the board cannot understand their "
                            "own appetite statement, it is not doing its job.</p>\n"
                            "<h2>Tolerance vs appetite</h2>\n"
                            "<p>Appetite is the overall direction; tolerance is the specific "
                            "limit. Appetite might be \"we are willing to accept moderate "
                            "technology risk to accelerate digital transformation.\" "
                            "Tolerance might be \"system downtime must not exceed four hours "
                            "per quarter.\" Both are needed — appetite for strategy, "
                            "tolerance for operations.</p>"
                        ),
                        sort_order=1,
                    ),
                    LessonData(
                        slug="mapping-risk-to-strategy",
                        title="Mapping Risk to Strategy",
                        description="Connecting risk management to the strategic objectives that matter.",
                        body=(
                            "<h2>Why strategy and risk must connect</h2>\n"
                            "<p>A risk register that sits separately from strategy is a "
                            "risk register that will be ignored. The board cares about "
                            "strategy — achieving objectives, growing the business, "
                            "managing stakeholders. If risk management cannot show how "
                            "risks relate to those objectives, it is invisible to the "
                            "people who control the budget.</p>\n"
                            "<h2>The mapping process</h2>\n"
                            "<p>Start with the organisation's strategic objectives — "
                            "the three to five things the board has agreed to focus on. "
                            "For each objective, ask: what risks could prevent us from "
                            "achieving this? What risks does pursuing this objective "
                            "create? The answers form a natural bridge between risk "
                            "management and strategy.</p>\n"
                            "<h2>Example</h2>\n"
                            "<p>Strategic objective: \"Expand into the Asia-Pacific market "
                            "by 2027.\" Risks that could prevent it: regulatory barriers, "
                            "currency volatility, local competitor response, talent "
                            "shortage. Risks that pursuing it creates: operational "
                            "complexity, cultural misalignment, reputational exposure "
                            "in a new market. Each of these can be managed — but only "
                            "if they are identified and linked to the objective.</p>\n"
                            "<h2>The risk dashboard</h2>\n"
                            "<p>Once you have mapped risks to objectives, you can build "
                            "a dashboard that the board actually wants to see: for each "
                            "strategic objective, the top three risks, their current "
                            "status, and what is being done. This replaces the "
                            "traditional heatmap with something the board can act on.</p>\n"
                            "<h2>Reviewing the map</h2>\n"
                            "<p>Review the mapping at least annually, or whenever the "
                            "strategy changes. New objectives create new risks. Changed "
                            "objectives retire old ones. The map should be a living "
                            "document, not a one-time exercise.</p>"
                        ),
                        sort_order=2,
                    ),
                ],
            ),
            ModuleData(
                title="Building the ERM Framework",
                description="Practical steps to design and implement an ERM programme.",
                sort_order=1,
                lessons=[
                    LessonData(
                        slug="designing-the-erm-architecture",
                        title="Designing the ERM Architecture",
                        description="How to structure your ERM programme to fit your organisation.",
                        body=(
                            "<h2>Architecture before process</h2>\n"
                            "<p>Most ERM implementations start with process: risk identification, "
                            "assessment, treatment, monitoring. This is backwards. Start with "
                            "architecture: who makes decisions about risk, how information flows, "
                            "and where risk management plugs into existing governance. Get the "
                            "architecture right and the processes become obvious.</p>\n"
                            "<h2>The three layers</h2>\n"
                            "<p>Effective ERM has three layers:</p>\n"
                            "<ul>\n"
                            "<li><strong>Strategic layer:</strong> The board and executive team, "
                            "setting appetite, reviewing top risks, making investment decisions. "
                            "Meets quarterly.</li>\n"
                            "<li><strong>Operational layer:</strong> Business unit managers, "
                            "owning and managing risks within their area. Meets monthly.</li>\n"
                            "<li><strong>Working layer:</strong> Project teams and individuals, "
                            "identifying and managing risks in their daily work. Ongoing.</li>\n"
                            "</ul>\n"
                            "<p>The risk function connects these layers — not by owning all "
                            "the risks (it cannot), but by ensuring information flows up and "
                            "decisions flow down.</p>\n"
                            "<h2>The reporting line</h2>\n"
                            "<p>The chief risk officer (or equivalent) should report directly "
                            "to the board, not to the CEO. This is not about hierarchy — it "
                            "is about independence. If risk management reports to the CEO, "
                            "there is an inherent tension when the CEO's strategy creates "
                            "risk. The board needs an independent view.</p>\n"
                            "<h2>Start small</h2>\n"
                            "<p>Do not try to implement ERM across the whole organisation at "
                            "once. Start with one business unit, one division, or one "
                            "strategic objective. Get it working, prove the value, and "
                            "expand. A small programme that works is worth more than a "
                            "large programme that does not.</p>"
                        ),
                        sort_order=0,
                    ),
                    LessonData(
                        slug="risk-identification-methods",
                        title="Risk Identification Methods",
                        description="Practical techniques for finding the risks that matter.",
                        body=(
                            "<h2>Beyond brainstorming</h2>\n"
                            "<p>The most common risk identification method is a brainstorming "
                            "session. The problem is that brainstorming produces the risks "
                            "people already know about — which are often the least dangerous "
                            "ones. The really dangerous risks are the ones nobody has thought "
                            "of yet, or the ones nobody wants to talk about.</p>\n"
                            "<h2>Structured methods that work</h2>\n"
                            "<p><strong>Scenario analysis:</strong> Instead of asking \"what "
                            "could go wrong?\" ask \"what would happen if X occurred?\" "
                            "Pick three to five specific scenarios — a key supplier fails, "
                            "a regulatory change takes effect, a competitor launches a "
                            "disruptive product — and work through the consequences. This "
                            "produces risks that brainstorming misses.</p>\n"
                            "<p><strong>Process walkthrough:</strong> Walk through a critical "
                            "business process from end to end and ask at each step: what "
                            "could go wrong here? This is especially effective for operational "
                            "risks that sit in the details of how work actually gets done.</p>\n"
                            "<p><strong>External scanning:</strong> Look outside the "
                            "organisation. What are competitors doing? What are regulators "
                            "signalling? What technology trends could disrupt your market? "
                            "External risks are often the ones that surprise organisations "
                            "because they were not looking.</p>\n"
                            "<h2>The risk register as input</h2>\n"
                            "<p>Your existing risk register is a starting point, not an "
                            "endpoint. Use it to check: are we missing anything? Are there "
                            "risks in the register that no longer apply? Are there new "
                            "risks that should be added? The register is a living document, "
                            "and identification is an ongoing process, not a one-time event.</p>\n"
                            "<h2>Who should be involved</h2>\n"
                            "<p>Diversity of perspective is the most important factor. Include "
                            "people from different functions, levels, and backgrounds. The "
                            "operations manager sees risks the CFO does not. The frontline "
                            "worker sees risks the executive does not. The best risk "
                            "identification sessions include both.</p>"
                        ),
                        sort_order=1,
                    ),
                    LessonData(
                        slug="risk-assessment-and-prioritisation",
                        title="Risk Assessment and Prioritisation",
                        description="How to evaluate risks consistently and decide where to focus.",
                        body=(
                            "<h2>Assessment is a means, not an end</h2>\n"
                            "<p>Risk assessment exists to prioritise — to help you decide "
                            "which risks to address first. It is not an academic exercise "
                            "in precision. A risk rated \"Likely, Major\" is in a different "
                            "priority bucket than one rated \"Unlikely, Minor\" — the exact "
                            "score does not matter as much as the relative ranking.</p>\n"
                            "<h2>The assessment process</h2>\n"
                            "<p>For each identified risk, assess two things:</p>\n"
                            "<ul>\n"
                            "<li><strong>Likelihood:</strong> How probable is this risk? "
                            "Use historical data where available, expert judgment where "
                            "not. Avoid false precision — \"Possible\" is more honest "
                            "than \"3.2.\"</li>\n"
                            "<li><strong>Impact:</strong> If this risk materialises, what "
                            "is the consequence? Consider financial, operational, "
                            "reputational, and regulatory impacts.</li>\n"
                            "</ul>\n"
                            "<p>Multiply for a simple score, or use a matrix for a visual "
                            "ranking. The method matters less than the consistency — use "
                            "the same approach for every risk.</p>\n"
                            "<h2>Inherent vs residual risk</h2>\n"
                            "<p><strong>Inherent risk</strong> is the risk before any "
                            "mitigation. <strong>Residual risk</strong> is the risk "
                            "after mitigation. Both are worth assessing: inherent risk "
                            "tells you the raw exposure; residual risk tells you whether "
                            "your mitigations are adequate.</p>\n"
                            "<h2>Prioritisation</h2>\n"
                            "<p>Sort risks by score and group them into priority tiers. "
                            "Top-tier risks get board attention and dedicated resources. "
                            "Middle-tier risks get owner attention and periodic review. "
                            "Bottom-tier risks get monitored. This is not a one-time "
                            "exercise — reassess at least annually, or whenever conditions "
                            "change materially.</p>\n"
                            "<h2>Common pitfalls</h2>\n"
                            "<p>Watch for these: anchoring (everyone rates the same because "
                            "the first person spoke), optimism bias (underestimating "
                            "likelihood), and precision theatre (debating whether a risk "
                            "is a 3 or a 4 when the action is the same either way).</p>"
                        ),
                        sort_order=2,
                    ),
                    LessonData(
                        slug="risk-treatment-options",
                        title="Risk Treatment Options",
                        description="Beyond mitigation: the four strategies for dealing with risk.",
                        body=(
                            "<h2>Four options, not one</h2>\n"
                            "<p>The most common mistake in risk treatment is assuming that "
                            "every risk needs to be mitigated. There are actually four "
                            "options, and choosing the right one is the core skill of "
                            "risk management:</p>\n"
                            "<ul>\n"
                            "<li><strong>Mitigate:</strong> Reduce the likelihood or impact. "
                            "This is what most people think of as risk management — "
                            "implementing controls, adding redundancy, improving processes.</li>\n"
                            "<li><strong>Transfer:</strong> Shift the risk to a third party. "
                            "Insurance is the classic example, but contracts, outsourcing, "
                            "and partnerships can also transfer risk.</li>\n"
                            "<li><strong>Accept:</strong> Acknowledge the risk and choose "
                            "not to act. This is a deliberate decision, not an oversight — "
                            "and it should be documented with a clear rationale.</li>\n"
                            "<li><strong>Avoid:</strong> Stop the activity that creates the "
                            "risk. The most extreme option, but sometimes the right one — "
                            "especially when the risk is existential and the activity is "
                            "not core to the strategy.</li>\n"
                            "</ul>\n"
                            "<h2>Choosing the right option</h2>\n"
                            "<p>The choice depends on cost-benefit: compare the cost of "
                            "treatment to the expected loss from the risk. If mitigation "
                            "costs $100K and the expected loss is $50K, mitigation is not "
                            "cost-effective — accept or transfer instead. If the expected "
                            "loss is $500K, mitigation at $100K is a bargain.</p>\n"
                            "<h2>The treatment plan</h2>\n"
                            "<p>For each treated risk, document: the chosen option, the "
                            "specific actions, the owner, the timeline, and the cost. "
                            "This becomes the action plan that the register tracks — and "
                            "the basis for reporting to the board on what is being done "
                            "about the organisation's most significant risks.</p>\n"
                            "<h2>Reviewing treatment effectiveness</h2>\n"
                            "<p>Treatment is not a one-time event. Review whether mitigations "
                            "are working as expected, whether transfers are adequate, and "
                            "whether acceptance decisions are still valid. A risk landscape "
                            "changes constantly — treatment plans need to change with it.</p>"
                        ),
                        sort_order=3,
                    ),
                ],
            ),
            ModuleData(
                title="ERM in Practice",
                description="Real-world implementation lessons from organisations that have done it.",
                sort_order=2,
                lessons=[
                    LessonData(
                        slug="making-erm-work-in-medium-organisations",
                        title="Making ERM Work in Medium Organisations",
                        description="How to implement ERM without a large risk function.",
                        body=(
                            "<h2>The resource constraint</h2>\n"
                            "<p>Medium organisations — 200 to 2,000 employees — face a "
                            "unique challenge: too complex for informal risk management, "
                            "too resource-constrained for a full ERM function with dedicated "
                            "analysts, software, and consultants. The solution is to keep "
                            "ERM lightweight and embed it in existing processes.</p>\n"
                            "<h2>The minimal ERM architecture</h2>\n"
                            "<p>At a minimum, you need:</p>\n"
                            "<ul>\n"
                            "<li>A risk owner at the executive level (can be part-time)</li>\n"
                            "<li>A risk register that maps to strategic objectives</li>\n"
                            "<li>A quarterly board review of the top ten risks</li>\n"
                            "<li>A monthly operational review of risk status</li>\n"
                            "</ul>\n"
                            "<p>This is not a programme — it is a rhythm. The risk owner "
                            "ensures the register is current, the board reviews the big "
                            "picture, and the operational layer handles the details. No "
                            "specialist software required; a well-structured spreadsheet "
                            "works.</p>\n"
                            "<h2>Leveraging existing roles</h2>\n"
                            "<p>You do not need a chief risk officer. The finance director, "
                            "the COO, or a senior manager with the right temperament can "
                            "own the risk function alongside their existing role. What "
                            "matters is that someone is accountable for ensuring risks are "
                            "identified, assessed, and reported — and that they have the "
                            "authority to escalate to the board.</p>\n"
                            "<h2>The technology question</h2>\n"
                            "<p>Do not buy risk management software until you have proven "
                            "the process works with simple tools. A spreadsheet that is "
                            "used is worth more than a platform that is not. Once the "
                            "process is established and you have a critical mass of "
                            "risks to manage, then consider dedicated software.</p>\n"
                            "<h2>Measuring progress</h2>\n"
                            "<p>Track three metrics: the number of risks with current "
                            "actions, the percentage of actions completed on time, and "
                            "the board's ability to name top risks. If all three are "
                            "improving, your ERM programme is working — regardless of "
                            "how formal it looks on paper.</p>"
                        ),
                        sort_order=0,
                    ),
                    LessonData(
                        slug="common-erm-failures-and-how-to-avoid-them",
                        title="Common ERM Failures and How to Avoid Them",
                        description="Lessons from organisations that got ERM wrong.",
                        body=(
                            "<h2>Failure 1: Framework worship</h2>\n"
                            "<p>The organisation spends twelve months building a risk "
                            "management framework that perfectly mirrors ISO 31000. "
                            "The framework is comprehensive, well-documented, and "
                            "completely disconnected from how decisions are actually "
                            "made. The board sees it once, nods politely, and goes "
                            "back to running the business as before.</p>\n"
                            "<p><strong>Fix:</strong> Start with the decision, not the "
                            "framework. What decisions does the board need to make about "
                            "risk? Build the process to support those decisions, then "
                            "map it to the framework later.</p>\n"
                            "<h2>Failure 2: The risk silo</h2>\n"
                            "<p>Risk management lives in a function, managed by risk "
                            "professionals, reported to the board in a separate agenda "
                            "item. The rest of the organisation treats it as someone "
                            "else's problem. Risks are \"managed\" in the risk function "
                            "but not in the business.</p>\n"
                            "<p><strong>Fix:</strong> Make risk ownership a line "
                            "management responsibility. The risk function facilitates, "
                            "the business owns. Every risk in the register should have "
                            "a business owner, not a risk professional.</p>\n"
                            "<h2>Failure 3: The annual cycle</h2>\n"
                            "<p>Risk assessment happens once a year, in a marathon "
                            "workshop, and the results are filed until next year. By "
                            "month three, the register is already stale. By month six, "
                            "it is ignored.</p>\n"
                            "<p><strong>Fix:</strong> Move to a continuous cycle. Monthly "
                            "owner updates, quarterly board reviews, and ad-hoc reviews "
                            "when conditions change. The register should be updated "
                            "when things happen, not on a calendar.</p>\n"
                            "<h2>Failure 4: Measuring activity, not outcomes</h2>\n"
                            "<p>The risk team reports: \"We completed 47 risk assessments "
                            "this quarter.\" The board nods. But nobody asks: did the "
                            "assessments change any decisions? Did they prevent any losses? "
                            "Activity is not outcome.</p>\n"
                            "<p><strong>Fix:</strong> Measure what matters. How many "
                            "strategic decisions were informed by risk analysis? How many "
                            "risks were retired? How many early warnings were acted on? "
                            "These are the metrics that prove ERM is working.</p>"
                        ),
                        sort_order=1,
                    ),
                    LessonData(
                        slug="integrating-risk-into-governance",
                        title="Integrating Risk into Governance",
                        description="How risk management fits into the broader governance structure.",
                        body=(
                            "<h2>Risk and governance are inseparable</h2>\n"
                            "<p>Governance is how the board oversees the organisation. "
                            "Risk is what the board needs to oversee. They are not "
                            "separate topics — risk governance is governance. If your "
                            "governance framework does not explicitly address risk, "
                            "it has a gap.</p>\n"
                            "<h2>The governance connection</h2>\n"
                            "<p>Every board committee should have a risk mandate:</p>\n"
                            "<ul>\n"
                            "<li><strong>Audit committee:</strong> Oversees financial "
                            "risk, compliance risk, and internal controls</li>\n"
                            "<li><strong>Risk committee:</strong> Reviews strategic and "
                            "enterprise risks, sets appetite, monitors the top risks</li>\n"
                            "<li><strong>Technology committee:</strong> Oversees "
                            "cybersecurity, data privacy, and technology risk</li>\n"
                            "</ul>\n"
                            "<p>If you do not have a dedicated risk committee, the audit "
                            "committee or the full board can cover this role — but "
                            "someone must be accountable for enterprise risk oversight.</p>\n"
                            "<h2>The risk report to the board</h2>\n"
                            "<p>The board needs a regular risk report that covers: changes "
                            "in the risk landscape, the status of top risks, escalation "
                            "items, and any decisions needed. This should be a standard "
                            "board agenda item, not a special report that arrives "
                            "occasionally.</p>\n"
                            "<h2>Board risk competency</h2>\n"
                            "<p>The board itself needs to be competent in risk oversight. "
                            "This means: understanding risk appetite, being able to "
                            "challenge risk assessments, and knowing when to escalate. "
                            "Board risk competency is not about making the board into "
                            "risk experts — it is about ensuring they can ask the right "
                            "questions.</p>"
                        ),
                        sort_order=2,
                    ),
                ],
            ),
        ],
    ),
    # ── Course 3 ──────────────────────────────────────────────────────────
    CourseData(
        slug="third-party-and-vendor-risk-management",
        title="Third-Party and Vendor Risk Management",
        subtitle="Managing the risks you inherit from your supply chain",
        description=(
            "Your organisation's risks do not stop at its own boundary. Every vendor, "
            "supplier, and partner introduces risk — cybersecurity, operational, "
            "regulatory, reputational. This course shows you how to identify, assess, "
            "and manage third-party risk without strangling the relationships your "
            "business depends on."
        ),
        section_slug="risk-management",
        author_slug="practicable-author",
        level="intermediate",
        estimated_duration_minutes=150,
        cover_bg="#8A3F16",
        cover_accent="#D9905A",
        cover_pattern="diagonal",
        modules=[
            ModuleData(
                title="Why Third-Party Risk Matters",
                description="Understanding the risks you inherit from your supply chain.",
                sort_order=0,
                lessons=[
                    LessonData(
                        slug="the-third-party-risk-landscape",
                        title="The Third-Party Risk Landscape",
                        description="An overview of where third-party risk comes from and why it is growing.",
                        body=(
                            "<h2>You are only as strong as your weakest vendor</h2>\n"
                            "<p>Modern organisations depend on third parties for everything "
                            "from cloud infrastructure to payroll processing. Each dependency "
                            "introduces risk: the vendor could fail, be breached, lose "
                            "certification, or simply stop meeting your needs. The more you "
                            "outsource, the more risk you accumulate — and most organisations "
                            "do not have a clear picture of how much third-party risk they "
                            "are carrying.</p>\n"
                            "<h2>The growing exposure</h2>\n"
                            "<p>Third-party risk is growing for three reasons:</p>\n"
                            "<ul>\n"
                            "<li><strong>Regulatory pressure:</strong> Regulators increasingly "
                            "hold organisations accountable for their vendors' conduct. APRA "
                            "CPS 234, GDPR Article 28, and similar regulations make third-party "
                            "risk management a compliance requirement, not a nice-to-have.</li>\n"
                            "<li><strong>Concentration risk:</strong> Many organisations rely "
                            "on the same small set of cloud providers, SaaS platforms, and "
                            "managed service providers. If one fails, thousands of organisations "
                            "are affected simultaneously.</li>\n"
                            "<li><strong>Attack surface expansion:</strong> Every vendor with "
                            "access to your systems, data, or network is a potential entry "
                            "point for attackers. The SolarWinds breach demonstrated that a "
                            "single compromised vendor could expose thousands of organisations.</li>\n"
                            "</ul>\n"
                            "<h2>The categories of third-party risk</h2>\n"
                            "<p>Third-party risk falls into several categories:</p>\n"
                            "<ul>\n"
                            "<li><strong>Cybersecurity risk:</strong> The vendor's security "
                            "posture affects yours.</li>\n"
                            "<li><strong>Operational risk:</strong> The vendor's failure "
                            "disrupts your operations.</li>\n"
                            "<li><strong>Compliance risk:</strong> The vendor's non-compliance "
                            "becomes your non-compliance.</li>\n"
                            "<li><strong>Financial risk:</strong> The vendor's financial "
                            "instability threatens service continuity.</li>\n"
                            "<li><strong>Reputational risk:</strong> The vendor's conduct "
                            "affects your reputation.</li>\n"
                            "</ul>"
                        ),
                        sort_order=0,
                    ),
                    LessonData(
                        slug="vendor-tiering-and-criticality",
                        title="Vendor Tiering and Criticality",
                        description="How to classify vendors by the risk they pose.",
                        body=(
                            "<h2>Not all vendors are equal</h2>\n"
                            "<p>You cannot manage every vendor with the same intensity. "
                            "A stationery supplier and a cloud hosting provider pose "
                            "fundamentally different levels of risk. Vendor tiering is "
                            "the process of classifying vendors by the impact their "
                            "failure would have on your organisation.</p>\n"
                            "<h2>The tiering framework</h2>\n"
                            "<p>A simple three-tier model works for most organisations:</p>\n"
                            "<ul>\n"
                            "<li><strong>Tier 1 — Critical:</strong> Failure would cause "
                            "significant operational disruption, regulatory breach, or "
                            "reputational damage. Examples: primary cloud provider, core "
                            "banking system, outsourced payroll. These vendors get the "
                            "most rigorous assessment and ongoing monitoring.</li>\n"
                            "<li><strong>Tier 2 — Important:</strong> Failure would cause "
                            "manageable disruption but not existential harm. Examples: "
                            "secondary suppliers, professional service firms, SaaS tools "
                            "with alternatives. These vendors get periodic assessment.</li>\n"
                            "<li><strong>Tier 3 — Routine:</strong> Failure would cause "
                            "minor inconvenience. Examples: office supplies, general "
                            "maintenance. These vendors get basic due diligence at onboarding.</li>\n"
                            "</ul>\n"
                            "<h2>How to determine a vendor's tier</h2>\n"
                            "<p>Ask three questions:</p>\n"
                            "<ol>\n"
                            "<li>If this vendor disappeared tomorrow, how long before "
                            "it affects our operations?</li>\n"
                            "<li>Do they have access to our sensitive data or systems?</li>\n"
                            "<li>Is there an alternative we could switch to quickly?</li>\n"
                            "</ol>\n"
                            "<p>If the answer to question 1 is \"immediately\" and question 2 "
                            "is \"yes\" and question 3 is \"no\", the vendor is Tier 1. "
                            "Adjust from there.</p>\n"
                            "<h2>Reviewing tiers</h2>\n"
                            "<p>Tiers are not permanent. A vendor can move up or down based "
                            "on changes in scope, access, or your own business needs. "
                            "Review tiers annually, or whenever a vendor relationship changes "
                            "materially.</p>"
                        ),
                        sort_order=1,
                    ),
                    LessonData(
                        slug="the-vendor-risk-assessment-process",
                        title="The Vendor Risk Assessment Process",
                        description="A step-by-step guide to assessing vendor risk before and during engagement.",
                        body=(
                            "<h2>Pre-engagement assessment</h2>\n"
                            "<p>The best time to assess vendor risk is before you sign the "
                            "contract. Once the contract is signed and the vendor is "
                            "embedded in your operations, changing vendors becomes expensive "
                            "and disruptive. Front-load the assessment.</p>\n"
                            "<h2>The assessment checklist</h2>\n"
                            "<p>For Tier 1 and Tier 2 vendors, assess:</p>\n"
                            "<ul>\n"
                            "<li><strong>Security posture:</strong> Do they have relevant "
                            "certifications (ISO 27001, SOC 2)? Can they provide a recent "
                            "penetration test report?</li>\n"
                            "<li><strong>Financial stability:</strong> Are they financially "
                            "viable? Check credit ratings, annual reports, or ask for "
                            "financial references.</li>\n"
                            "<li><strong>Operational resilience:</strong> Do they have "
                            "business continuity plans? What is their disaster recovery "
                            "capability?</li>\n"
                            "<li><strong>Regulatory compliance:</strong> Are they compliant "
                            "with relevant regulations? Do they hold necessary licences?</li>\n"
                            "<li><strong>Data handling:</strong> How do they handle your "
                            "data? Where is it stored? Who has access?</li>\n"
                            "</ul>\n"
                            "<h2>The due diligence report</h2>\n"
                            "<p>Document your findings in a concise due diligence report. "
                            "This is not a research paper — it is a risk assessment that "
                            "supports a go/no-go decision. Include the key findings, "
                            "identified risks, and recommended mitigations. The report "
                            "should be short enough that a decision-maker will actually "
                            "read it.</p>\n"
                            "<h2>Ongoing monitoring</h2>\n"
                            "<p>Assessment is not a one-time event. For Tier 1 vendors, "
                            "review annually. For Tier 2, every two years. Monitor for "
                            "trigger events: data breaches, financial difficulties, "
                            "regulatory actions, or significant management changes.</p>"
                        ),
                        sort_order=2,
                    ),
                ],
            ),
            ModuleData(
                title="Contractual and Operational Controls",
                description="Building risk management into vendor contracts and day-to-day operations.",
                sort_order=1,
                lessons=[
                    LessonData(
                        slug="contract-clauses-that-actually-protect-you",
                        title="Contract Clauses That Actually Protect You",
                        description="Key contract provisions for managing third-party risk.",
                        body=(
                            "<h2>Contracts as risk controls</h2>\n"
                            "<p>A well-drafted contract is one of the most effective risk "
                            "controls available. It defines expectations, allocates "
                            "responsibility, and provides remedies when things go wrong. "
                            "Most vendor contracts, however, are written by procurement "
                            "or legal teams with limited risk input — which means the "
                            "risk provisions are generic, not tailored to the specific "
                            "risks this vendor relationship creates.</p>\n"
                            "<h2>Essential clauses</h2>\n"
                            "<p>Every vendor contract should include these risk clauses:</p>\n"
                            "<ul>\n"
                            "<li><strong>Security requirements:</strong> Minimum security "
                            "standards the vendor must meet, with evidence requirements "
                            "(certifications, audit reports).</li>\n"
                            "<li><strong>Incident notification:</strong> The vendor must "
                            "notify you of security incidents, data breaches, or service "
                            "disruptions within a defined timeframe (24-72 hours depending "
                            "on severity).</li>\n"
                            "<li><strong>Audit rights:</strong> The right to audit the "
                            "vendor's controls, either directly or through a third party. "
                            "This is especially important for Tier 1 vendors.</li>\n"
                            "<li><strong>Data handling:</strong> Where your data is stored, "
                            "who can access it, and what happens to it when the contract "
                            "ends.</li>\n"
                            "<li><strong>Service levels:</strong> Measurable performance "
                            "targets with consequences for non-compliance.</li>\n"
                            "<li><strong>Exit provisions:</strong> How data is returned, "
                            "how transition is managed, and what happens to ongoing "
                            "obligations.</li>\n"
                            "</ul>\n"
                            "<h2>The exit clause</h2>\n"
                            "<p>The most overlooked clause is the exit provision. What "
                            "happens when the contract ends — whether by choice or because "
                            "the vendor fails? Data portability, transition assistance, "
                            "and post-termination obligations should all be defined "
                            "before you sign, not negotiated in a crisis.</p>\n"
                            "<h2>Practical tip</h2>\n"
                            "<p>Create a standard set of risk clauses for your "
                            "organisation. Use these as the starting point for every "
                            "vendor contract, adjusting for the vendor's tier and the "
                            "specific risks involved. This is faster and more consistent "
                            "than negotiating from scratch each time.</p>"
                        ),
                        sort_order=0,
                    ),
                    LessonData(
                        slug="ongoing-vendor-monitoring",
                        title="Ongoing Vendor Monitoring",
                        description="How to keep track of vendor risk after the contract is signed.",
                        body=(
                            "<h2>The monitoring gap</h2>\n"
                            "<p>Most organisations assess vendors thoroughly at onboarding "
                            "and then forget about them until the contract renewal. This "
                            "creates a monitoring gap — the period between onboarding and "
                            "renewal where vendor risk can change significantly without "
                            "anyone noticing.</p>\n"
                            "<h2>What to monitor</h2>\n"
                            "<p>Ongoing monitoring does not mean continuous surveillance. "
                            "It means tracking a few key signals:</p>\n"
                            "<ul>\n"
                            "<li><strong>Security incidents:</strong> Has the vendor "
                            "experienced a breach? Monitor news feeds, vendor "
                            "notifications, and security advisories.</li>\n"
                            "<li><strong>Financial health:</strong> Is the vendor "
                            "financially stable? Monitor credit ratings, news, and "
                            "annual reports.</li>\n"
                            "<li><strong>Compliance status:</strong> Are their "
                            "certifications current? Have they been subject to "
                            "regulatory action?</li>\n"
                            "<li><strong>Service performance:</strong> Are they meeting "
                            "SLAs? Track uptime, response times, and incident frequency.</li>\n"
                            "</ul>\n"
                            "<h2>The monitoring cadence</h2>\n"
                            "<p>Match the cadence to the tier:</p>\n"
                            "<ul>\n"
                            "<li><strong>Tier 1:</strong> Quarterly review of key metrics, "
                            "annual comprehensive assessment.</li>\n"
                            "<li><strong>Tier 2:</strong> Semi-annual review, triggered "
                            "assessment on significant events.</li>\n"
                            "<li><strong>Tier 3:</strong> Annual confirmation of continued "
                            "suitability.</li>\n"
                            "</ul>\n"
                            "<h2>Trigger events</h2>\n"
                            "<p>Regardless of cadence, certain events should trigger an "
                            "immediate review: a data breach at the vendor, a significant "
                            "management change, financial distress, loss of key "
                            "certification, or a material change in the services they "
                            "provide to you.</p>"
                        ),
                        sort_order=1,
                    ),
                    LessonData(
                        slug="vendor-exit-and-transition-planning",
                        title="Vendor Exit and Transition Planning",
                        description="How to plan for the end of a vendor relationship before it starts.",
                        body=(
                            "<h2>Plan the exit before you need it</h2>\n"
                            "<p>Vendor exit planning is the most neglected part of third-party "
                            "risk management. Organisations spend months negotiating the "
                            "onboarding but give almost no thought to what happens when "
                            "the relationship ends — whether by choice or because the "
                            "vendor fails. By the time you need to exit, it is too late "
                            "to negotiate the terms.</p>\n"
                            "<h2>What to plan for</h2>\n"
                            "<p>Exit planning should address:</p>\n"
                            "<ul>\n"
                            "<li><strong>Data portability:</strong> How is your data "
                            "exported? In what format? What is the timeline?</li>\n"
                            "<li><strong>Knowledge transfer:</strong> What institutional "
                            "knowledge lives at the vendor? How is it transferred?</li>\n"
                            "<li><strong>Transition period:</strong> How long will it "
                            "take to switch to an alternative? What support does the "
                            "vendor provide during transition?</li>\n"
                            "<li><strong>Post-termination obligations:</strong> What "
                            "obligations survive the contract end? Confidentiality, "
                            "data deletion, audit cooperation?</li>\n"
                            "</ul>\n"
                            "<h2>The exit playbook</h2>\n"
                            "<p>For Tier 1 vendors, create a written exit playbook. "
                            "This is a step-by-step plan for transitioning away from "
                            "the vendor, including timelines, responsibilities, and "
                            "contingency arrangements. Review it annually and update "
                            "it as the relationship evolves.</p>\n"
                            "<h2>Alternative vendor readiness</h2>\n"
                            "<p>For critical vendors, always know who the alternatives "
                            "are. You do not need to have a backup vendor under contract, "
                            "but you should know: who else provides this service, what "
                            "would it take to switch, and how long the transition would "
                            "take. This information should be documented and reviewed "
                            "annually.</p>"
                        ),
                        sort_order=2,
                    ),
                ],
            ),
        ],
    ),
    # ── Course 4 ──────────────────────────────────────────────────────────
    CourseData(
        slug="regulatory-compliance-fundamentals",
        title="Regulatory Compliance Fundamentals",
        subtitle="Turning obligations into practical action",
        description=(
            "Compliance is not about ticking boxes — it is about understanding "
            "what the regulations require and building processes that meet those "
            "requirements sustainably. This course covers the fundamentals of "
            "compliance management, from interpretation to implementation to "
            "monitoring."
        ),
        section_slug="compliance",
        author_slug="practicable-author",
        level="beginner",
        estimated_duration_minutes=140,
        cover_bg="#5B3E8F",
        cover_accent="#A98BD6",
        cover_pattern="dots",
        modules=[
            ModuleData(
                title="Understanding Compliance",
                description="What compliance means and why it matters beyond avoiding penalties.",
                sort_order=0,
                lessons=[
                    LessonData(
                        slug="what-compliance-actually-requires",
                        title="What Compliance Actually Requires",
                        description="Moving from 'we need to comply' to understanding specific obligations.",
                        body=(
                            "<h2>The compliance gap</h2>\n"
                            "<p>Most organisations know they need to comply with regulations. "
                            "Few have a clear understanding of what those regulations "
                            "actually require of them. The gap between \"we need to comply\" "
                            "and \"here is exactly what we need to do\" is where most "
                            "compliance failures originate.</p>\n"
                            "<h2>Interpreting obligations</h2>\n"
                            "<p>Regulatory obligations come in different forms:</p>\n"
                            "<ul>\n"
                            "<li><strong>Prescriptive requirements:</strong> \"You must do X.\" "
                            "These are clear — either you are doing it or you are not.</li>\n"
                            "<li><strong>Principle-based requirements:</strong> \"You must "
                            "take reasonable steps to achieve Y.\" These require judgment — "
                            "what counts as \"reasonable\" depends on your context.</li>\n"
                            "<li><strong>Outcome-based requirements:</strong> \"You must "
                            "ensure Z.\" The regulator does not tell you how; they tell "
                            "you what the result must be.</li>\n"
                            "</ul>\n"
                            "<p>Understanding which type you are dealing with determines "
                            "your approach. Prescriptive requirements are checklists. "
                            "Principle-based requirements need documented judgment. "
                            "Outcome-based requirements need evidence of results.</p>\n"
                            "<h2>The obligation register</h2>\n"
                            "<p>The foundation of compliance management is an obligation "
                            "register: a clear list of every obligation that applies to "
                            "your organisation, who owns it, how it is met, and how it "
                            "is evidenced. This is not a spreadsheet exercise — it is "
                            "the core management tool that keeps compliance visible and "
                            "auditable.</p>\n"
                            "<h2>Common misinterpretations</h2>\n"
                            "<p>Watch for these: assuming compliance is the legal team's "
                            "job (it is everyone's), confusing compliance with best practice "
                            "(compliance is the minimum, best practice is aspirational), "
                            "and treating compliance as a one-time event (it is ongoing).</p>"
                        ),
                        sort_order=0,
                    ),
                    LessonData(
                        slug="the-compliance-programme-structure",
                        title="The Compliance Programme Structure",
                        description="How to build a compliance programme that is both effective and sustainable.",
                        body=(
                            "<h2>A programme, not a project</h2>\n"
                            "<p>Compliance is not a project with a start and end date. "
                            "It is a programme — an ongoing set of activities that keep "
                            "the organisation aligned with its obligations. The "
                            "difference matters: projects can be completed; programmes "
                            "must be sustained.</p>\n"
                            "<h2>The five components</h2>\n"
                            "<p>An effective compliance programme has five components:</p>\n"
                            "<ol>\n"
                            "<li><strong>Obligation identification:</strong> Knowing "
                            "what regulations apply and what they require. This is the "
                            "foundation — if you do not know what you need to comply "
                            "with, nothing else works.</li>\n"
                            "<li><strong>Control design:</strong> Building processes and "
                            "controls that meet the obligations. Controls should be "
                            "integrated into existing workflows, not bolted on as "
                            "separate activities.</li>\n"
                            "<li><strong>Monitoring:</strong> Checking that controls "
                            "are working as designed. This is not the same as auditing — "
                            "monitoring is continuous and embedded; auditing is periodic "
                            "and independent.</li>\n"
                            "<li><strong>Reporting:</strong> Communicating compliance "
                            "status to management and the board. Reports should be "
                            "outcome-focused, not activity-focused.</li>\n"
                            "<li><strong>Remediation:</strong> When compliance fails, "
                            "fixing it quickly and learning from the failure.</li>\n"
                            "</ol>\n"
                            "<h2>The compliance function</h2>\n"
                            "<p>Someone needs to own the compliance programme. In smaller "
                            "organisations, this might be a senior manager with compliance "
                            "as a secondary responsibility. In larger ones, a dedicated "
                            "compliance officer or team. What matters is that someone has "
                            "the authority and accountability to ensure obligations are "
                            "met and the programme is maintained.</p>"
                        ),
                        sort_order=1,
                    ),
                    LessonData(
                        slug="building-the-obligation-register",
                        title="Building the Obligation Register",
                        description="How to identify, document, and track every regulatory obligation.",
                        body=(
                            "<h2>What is an obligation register?</h2>\n"
                            "<p>An obligation register is a structured list of every "
                            "regulatory obligation that applies to your organisation. "
                            "It captures: what the obligation is, where it comes from "
                            "(which regulation or standard), who owns it, how it is "
                            "met, and what evidence demonstrates compliance. It is the "
                            "single source of truth for compliance management.</p>\n"
                            "<h2>How to build it</h2>\n"
                            "<p>Step 1: Identify all applicable regulations and standards. "
                            "This includes industry-specific regulations, general "
                            "legislation (privacy, workplace safety, financial reporting), "
                            "and any contractual obligations that have regulatory "
                            "equivalent force.</p>\n"
                            "<p>Step 2: Break each regulation into specific obligations. "
                            "\"Comply with GDPR\" is not an obligation — it is a goal. "
                            "The obligations are: maintain a record of processing "
                            "activities, conduct DPIAs for high-risk processing, appoint "
                            "a DPO where required, and so on.</p>\n"
                            "<p>Step 3: Assign an owner to each obligation. The owner "
                            "is responsible for ensuring the obligation is met and "
                            "evidenced. This should be a person, not a department.</p>\n"
                            "<p>Step 4: Document how each obligation is met. This is "
                            "the control description — the process, policy, or system "
                            "that satisfies the requirement.</p>\n"
                            "<p>Step 5: Define the evidence. What proves compliance? "
                            "A signed policy, an audit report, a system configuration "
                            "screenshot, a training record. The evidence must be "
                            "retrievable and current.</p>\n"
                            "<h2>Keeping it current</h2>\n"
                            "<p>The register must be updated whenever: regulations "
                            "change, the organisation changes, new obligations are "
                            "identified, or existing obligations are superseded. "
                            "Assign this monitoring to the compliance function and "
                            "review quarterly.</p>"
                        ),
                        sort_order=2,
                    ),
                ],
            ),
            ModuleData(
                title="Compliance in Practice",
                description="Day-to-day compliance management that actually works.",
                sort_order=1,
                lessons=[
                    LessonData(
                        slug="compliance-monitoring-and-evidence",
                        title="Compliance Monitoring and Evidence",
                        description="How to check that controls are working and prove it.",
                        body=(
                            "<h2>Monitoring vs auditing</h2>\n"
                            "<p>Monitoring is ongoing and embedded — it happens as part "
                            "of normal operations. Auditing is periodic and independent — "
                            "it happens at a set interval, usually by someone outside the "
                            "team. Both are necessary; they serve different purposes.</p>\n"
                            "<h2>What to monitor</h2>\n"
                            "<p>Monitor the controls that meet your obligations. For each "
                            "control, define: what to check, how often, who checks, and "
                            "what \"working\" looks like. Examples:</p>\n"
                            "<ul>\n"
                            "<li><strong>Access control:</strong> Review user access "
                            "quarterly. Check: are former employees still active? Are "
                            "permissions appropriate? Evidence: access review log.</li>\n"
                            "<li><strong>Training completion:</strong> Track who has "
                            "completed mandatory training. Evidence: LMS completion "
                            "records.</li>\n"
                            "<li><strong>Data handling:</strong> Verify that data "
                            "processing activities match the records. Evidence: DPIA "
                            "log, processing activity records.</li>\n"
                            "</ul>\n"
                            "<h2>The evidence standard</h2>\n"
                            "<p>Evidence must be: contemporaneous (created at the time, "
                            "not after the fact), specific (relating to the obligation "
                            "in question), and retrievable (stored where auditors can "
                            "find it). A checkbox that says \"completed\" is not "
                            "evidence — a dated record with a name is.</p>\n"
                            "<h2>When monitoring reveals non-compliance</h2>\n"
                            "<p>Non-compliance is not a failure of the compliance "
                            "programme — it is evidence that it is working. The purpose "
                            "of monitoring is to find problems before regulators do. "
                            "When non-compliance is found: document it, remediate it, "
                            "and learn from it. Hide nothing — regulators punish cover-ups "
                            "more than the underlying non-compliance.</p>"
                        ),
                        sort_order=0,
                    ),
                    LessonData(
                        slug="handling-regulatory-examinations",
                        title="Handling Regulatory Examinations",
                        description="How to prepare for and manage a regulatory examination or audit.",
                        body=(
                            "<h2>Preparing for the examination</h2>\n"
                            "<p>Preparation starts long before the regulator arrives. "
                            "The best preparation is a well-maintained obligation register "
                            "and evidence base — if your compliance programme is in order, "
                            "preparation is mostly about gathering and organising what "
                            "already exists.</p>\n"
                            "<h2>The preparation checklist</h2>\n"
                            "<ul>\n"
                            "<li><strong>Update the register:</strong> Ensure all "
                            "obligations are current and all evidence is accessible.</li>\n"
                            "<li><strong>Review recent changes:</strong> Any significant "
                            "changes to processes, systems, or personnel that affect "
                            "compliance should be documented and ready to explain.</li>\n"
                            "<li><strong>Brief the team:</strong> Everyone who might "
                            "interact with the examiner should know: what the examination "
                            "covers, what their role is, and how to escalate questions "
                            "they cannot answer.</li>\n"
                            "<li><strong>Gather evidence:</strong> Have your key evidence "
                            "documents ready — not hidden in someone's inbox or a "
                            "SharePoint folder nobody can find.</li>\n"
                            "</ul>\n"
                            "<h2>During the examination</h2>\n"
                            "<p>Be cooperative and transparent. Answer questions honestly. "
                            "If you do not know, say so and find out — do not guess. "
                            "If the examiner identifies a gap, acknowledge it and "
                            "describe your remediation plan. Defensiveness makes things "
                            "worse; transparency builds credibility.</p>\n"
                            "<h2>After the examination</h2>\n"
                            "<p>Document the findings and track remediation to completion. "
                            "Share the lessons learned with the broader team. If the "
                            "examination revealed systemic issues, treat them as a "
                            "programme improvement opportunity, not just a list of fixes.</p>"
                        ),
                        sort_order=1,
                    ),
                    LessonData(
                        slug="compliance-culture-and-training",
                        title="Compliance Culture and Training",
                        description="Building a culture where compliance is everyone's responsibility.",
                        body=(
                            "<h2>Compliance is a culture, not a function</h2>\n"
                            "<p>The most effective compliance programmes are not driven "
                            "by the compliance function — they are embedded in the culture. "
                            "When employees understand why compliance matters and feel "
                            "empowered to raise concerns, compliance becomes self-reinforcing. "
                            "When it is seen as \"the compliance team's job,\" it becomes "
                            "a负担 that people work around.</p>\n"
                            "<h2>The tone from the top</h2>\n"
                            "<p>Compliance culture starts with leadership. If senior "
                            "management treats compliance as a priority — allocating "
                            "resources, asking questions, and holding people accountable — "
                            "the organisation follows. If leadership treats compliance "
                            "as a cost centre to be minimised, the organisation takes "
                            "the same view.</p>\n"
                            "<h2>Effective training</h2>\n"
                            "<p>Compliance training fails when it is generic, boring, "
                            "and disconnected from people's actual work. Effective "
                            "training is:</p>\n"
                            "<ul>\n"
                            "<li><strong>Role-specific:</strong> A finance team member "
                            "needs different compliance training than a software "
                            "developer.</li>\n"
                            "<li><strong>Scenario-based:</strong> Use real examples "
                            "and case studies, not abstract principles.</li>\n"
                            "<li><strong>Regular:</strong> Annual training is not "
                            "enough. Quarterly reminders, team discussions, and "
                            "real-time guidance keep compliance top of mind.</li>\n"
                            "</ul>\n"
                            "<h2>The speak-up culture</h2>\n"
                            "<p>The strongest compliance signal is a speak-up culture: "
                            "employees feel safe raising concerns without fear of "
                            "retaliation. This requires: clear reporting channels, "
                            "confidentiality protections, and visible follow-through "
                            "when concerns are raised. If people do not speak up, it "
                            "does not mean there are no problems — it means the "
                            "problems are hidden.</p>"
                        ),
                        sort_order=2,
                    ),
                ],
            ),
        ],
    ),
    # ── Course 5 ──────────────────────────────────────────────────────────
    CourseData(
        slug="business-continuity-and-crisis-management",
        title="Business Continuity and Crisis Management",
        subtitle="Keeping the lights on when things go wrong",
        description=(
            "Business continuity is not about creating a binder that sits on a shelf. "
            "It is about building the organisational capability to keep operating — or "
            "recover quickly — when disruption hits. This course covers the practical "
            "mechanics of continuity planning, crisis response, and recovery."
        ),
        section_slug="resilience",
        author_slug="practicable-author",
        level="intermediate",
        estimated_duration_minutes=160,
        cover_bg="#1C6B3F",
        cover_accent="#6FCF97",
        cover_pattern="waves",
        modules=[
            ModuleData(
                title="Business Continuity Fundamentals",
                description="What business continuity actually means and how to approach it.",
                sort_order=0,
                lessons=[
                    LessonData(
                        slug="what-business-continuity-is-not",
                        title="What Business Continuity Is Not",
                        description="Dispelling the myths that make continuity planning ineffective.",
                        body=(
                            "<h2>The myth of the binder</h2>\n"
                            "<p>The most common image of business continuity is a thick "
                            "binder stored in a cupboard somewhere, produced by consultants "
                            "three years ago and never opened since. This is not business "
                            "continuity — it is compliance theatre. The binder satisfies "
                            "the auditor but does nothing to help the organisation when "
                            "disruption actually hits.</p>\n"
                            "<h2>What it is not</h2>\n"
                            "<ul>\n"
                            "<li><strong>It is not an IT disaster recovery plan.</strong> "
                            "IT DR is about restoring systems. Business continuity is "
                            "about maintaining business operations. They overlap but "
                            "they are not the same thing.</li>\n"
                            "<li><strong>It is not a risk register.</strong> Risk "
                            "management identifies what could go wrong. Continuity "
                            "planning determines what you do when it does.</li>\n"
                            "<li><strong>It is not a one-time exercise.</strong> A "
                            "continuity plan created two years ago and not updated is "
                            "worse than no plan at all — it creates false confidence.</li>\n"
                            "</ul>\n"
                            "<h2>What it is</h2>\n"
                            "<p>Business continuity is the organisational capability to:</p>\n"
                            "<ol>\n"
                            "<li>Identify which business processes are critical</li>\n"
                            "<li>Determine what is needed to keep them running</li>\n"
                            "<li>Build the plans and capabilities to do so</li>\n"
                            "<li>Test those plans regularly</li>\n"
                            "<li>Recover when disruption exceeds your capability</li>\n"
                            "</ol>\n"
                            "<h2>The real test</h2>\n"
                            "<p>Here is the real test of business continuity: if your "
                            "main office was inaccessible tomorrow morning, could your "
                            "organisation continue to serve customers within four hours? "
                            "If the answer is no, you have a continuity gap — and a plan "
                            "in a binder will not close it.</p>"
                        ),
                        sort_order=0,
                    ),
                    LessonData(
                        slug="business-impact-analysis",
                        title="Business Impact Analysis",
                        description="How to identify which processes are critical and what they need.",
                        body=(
                            "<h2>The foundation of continuity planning</h2>\n"
                            "<p>The Business Impact Analysis (BIA) is the most important "
                            "document in your continuity programme. It identifies which "
                            "business processes are critical, what the impact of disruption "
                            "would be, and what recovery capability is needed. Without a "
                            "BIA, your continuity plan is a guess.</p>\n"
                            "<h2>How to conduct a BIA</h2>\n"
                            "<p>Step 1: Identify all business processes. List every "
                            "significant activity the organisation performs — not just "
                            "IT systems, but manual processes, supplier relationships, "
                            "and people-dependent activities.</p>\n"
                            "<p>Step 2: Assess the impact of disruption. For each process, "
                            "ask: what happens if this stops for one hour? One day? One "
                            "week? One month? The impact is financial, operational, "
                            "regulatory, and reputational.</p>\n"
                            "<p>Step 3: Determine recovery time objectives. Based on "
                            "the impact assessment, how quickly does each process need "
                            "to be restored? This is your Recovery Time Objective (RTO).</p>\n"
                            "<p>Step 4: Identify dependencies. What does each critical "
                            "process depend on? People, systems, suppliers, data, "
                            "facilities? Map the dependencies to understand the full "
                            "picture.</p>\n"
                            "<h2>The critical process list</h2>\n"
                            "<p>The BIA produces a ranked list of critical processes. "
                            "This is the prioritisation that drives your continuity "
                            "plans — you focus resources on the processes that matter "
                            "most, not the ones that are easiest to plan for.</p>\n"
                            "<h2>Reviewing the BIA</h2>\n"
                            "<p>The BIA is not static. Review it annually, or whenever "
                            "the organisation changes significantly — new products, "
                            "new markets, new systems, or major organisational change. "
                            "A BIA that is not current is worse than no BIA at all.</p>"
                        ),
                        sort_order=1,
                    ),
                    LessonData(
                        slug="recovery-strategies-that-work",
                        title="Recovery Strategies That Work",
                        description="Practical approaches to recovering critical processes.",
                        body=(
                            "<h2>Strategy before plan</h2>\n"
                            "<p>Before you write a continuity plan, you need a recovery "
                            "strategy. The strategy determines <em>how</em> you will "
                            "recover; the plan documents the details. Most organisations "
                            "jump straight to the plan and end up with a document that "
                            "describes what they hope will happen rather than what they "
                            "can actually make happen.</p>\n"
                            "<h2>The four recovery strategies</h2>\n"
                            "<ul>\n"
                            "<li><strong>Redundancy:</strong> Having backup capability "
                            "ready to take over immediately. This is the fastest "
                            "recovery but the most expensive — you are paying for "
                            "capacity you do not normally use.</li>\n"
                            "<li><strong>Improvisation:</strong> Adapting existing "
                            "resources to fill the gap. This is flexible but depends "
                            "on people's ability to think under pressure — which is "
                            "less reliable than people think.</li>\n"
                            "<li><strong>Outsourcing:</strong> Using a third party to "
                            "provide the capability. This requires pre-established "
                            "relationships and contracts — you cannot negotiate an "
                            "outsourcing deal during a crisis.</li>\n"
                            "<li><strong>Acceptance:</strong> Acknowledging that some "
                            "disruption is unavoidable and managing the impact. Not "
                            "every process needs to survive disruption — only the "
                            "critical ones.</li>\n"
                            "</ul>\n"
                            "<h2>Matching strategy to criticality</h2>\n"
                            "<p>Match the strategy to the process criticality:</p>\n"
                            "<ul>\n"
                            "<li><strong>Critical (must recover immediately):</strong> "
                            "Redundancy or pre-arranged outsourcing.</li>\n"
                            "<li><strong>Important (must recover within 24-48 hours):</strong> "
                            "Improvisation with documented workarounds.</li>\n"
                            "<li><strong>Useful (can wait a week or more):</strong> "
                            "Acceptance with a recovery backlog.</li>\n"
                            "</ul>\n"
                            "<h2>The cost equation</h2>\n"
                            "<p>Every recovery strategy has a cost. The question is: "
                            "does the cost of the strategy exceed the cost of "
                            "disruption? For a critical process with high impact, "
                            "redundancy is almost always cost-effective. For a "
                            "non-critical process, acceptance is the right choice.</p>"
                        ),
                        sort_order=2,
                    ),
                ],
            ),
            ModuleData(
                title="Crisis Response",
                description="How to respond when disruption hits.",
                sort_order=1,
                lessons=[
                    LessonData(
                        slug="the-crisis-management-team",
                        title="The Crisis Management Team",
                        description="Who should be on the team and how to organise for effective response.",
                        body=(
                            "<h2>Who makes decisions in a crisis?</h2>\n"
                            "<p>In a crisis, decisions need to be made fast. If the "
                            "decision-making structure is unclear, the organisation "
                            "paralyses — everyone waits for someone else to act. The "
                            "crisis management team (CMT) is the structure that prevents "
                            "this.</p>\n"
                            "<h2>Core CMT roles</h2>\n"
                            "<p>Every CMT needs these roles, regardless of organisation "
                            "size:</p>\n"
                            "<ul>\n"
                            "<li><strong>Crisis leader:</strong> Makes final decisions. "
                            "This is usually the CEO or a designated deputy — someone "
                            "with the authority to commit the organisation.</li>\n"
                            "<li><strong>Operations coordinator:</strong> Manages the "
                            "operational response — what is being done, by whom, and "
                            "whether it is working.</li>\n"
                            "<li><strong>Communications lead:</strong> Manages internal "
                            "and external communications. In a crisis, saying the wrong "
                            "thing is worse than saying nothing — this role controls "
                            "the message.</li>\n"
                            "<li><strong>Information coordinator:</strong> Gathers and "
                            "verifies information. In the early stages of a crisis, "
                            "information is unreliable — this role separates fact from "
                            "rumour.</li>\n"
                            "</ul>\n"
                            "<h2>Standing up the CMT</h2>\n"
                            "<p>The CMT should have a clear activation trigger: what "
                            "type of event, what severity, causes the CMT to stand up. "
                            "The trigger should be objective — not \"when the CEO thinks "
                            "it is serious\" but \"when X or Y or Z occurs.\" This "
                            "removes hesitation from the activation decision.</p>\n"
                            "<h2>Practicing the response</h2>\n"
                            "<p>A CMT that has never practiced together will not perform "
                            "well under pressure. Run a tabletop exercise at least "
                            "annually — a scenario-based walkthrough where the CMT "
                            "makes decisions in real-time. The exercise should reveal "
                            "gaps in the plan, the team, and the information flows.</p>"
                        ),
                        sort_order=0,
                    ),
                    LessonData(
                        slug="communication-during-a-crisis",
                        title="Communication During a Crisis",
                        description="How to communicate effectively when the stakes are highest.",
                        body=(
                            "<h2>Communication is the crisis</h2>\n"
                            "<p>In most crises, the communication failure causes more "
                            "damage than the event itself. Customers do not know what "
                            "is happening. Employees hear rumours before official "
                            "information. Regulators get information from the media "
                            "instead of from you. The operational impact may be "
                            "temporary; the reputational impact can be permanent.</p>\n"
                            "<h2>The first hour</h2>\n"
                            "<p>The first hour after a crisis is discovered is critical. "
                            "You will not have complete information — but you need to "
                            "communicate something. The formula is:</p>\n"
                            "<ol>\n"
                            "<li><strong>Acknowledge:</strong> We are aware of [event]. "
                            "This prevents the information vacuum that rumours fill.</li>\n"
                            "<li><strong>Action:</strong> We are taking [specific action]. "
                            "This shows you are responding, not paralysed.</li>\n"
                            "<li><strong>Timeline:</strong> We will provide an update "
                            "by [specific time]. This manages expectations and creates "
                            "accountability for the next communication.</li>\n"
                            "</ol>\n"
                            "<h2>Internal before external</h2>\n"
                            "<p>Employees should hear from you before they hear from "
                            "the media. An informed workforce is your best defence "
                            "against reputational damage — they can answer questions "
                            "from customers, suppliers, and friends accurately rather "
                            "than speculatively.</p>\n"
                            "<h2>The communication plan</h2>\n"
                            "<p>Pre-draft templates for common crisis scenarios: data "
                            "breach, service outage, safety incident, regulatory action. "
                            "Fill in the blanks at crisis time rather than writing from "
                            "scratch. Templates save time and prevent communication "
                            "failures caused by pressure and fatigue.</p>\n"
                            "<h2>The follow-up</h2>\n"
                            "<p>After the immediate crisis passes, communicate the "
                            "resolution and the lessons learned. People remember how "
                            "you communicated during the crisis — silence or confusion "
                            "is remembered long after the operational issue is resolved.</p>"
                        ),
                        sort_order=1,
                    ),
                    LessonData(
                        slug="decision-making-under-pressure",
                        title="Decision-Making Under Pressure",
                        description="Frameworks for making good decisions when time is limited and stakes are high.",
                        body=(
                            "<h2>Why crisis decisions are different</h2>\n"
                            "<p>Normal business decisions have time for analysis, "
                            "consultation, and review. Crisis decisions do not. You "
                            "will never have complete information, you will never have "
                            "enough time, and the cost of inaction is often higher than "
                            "the cost of a imperfect decision. The skill is making the "
                            "best decision you can with what you have, and being "
                            "prepared to adjust as new information arrives.</p>\n"
                            "<h2>The 70% rule</h2>\n"
                            "<p>If you have 70% of the information you want, make the "
                            "decision. Waiting for the remaining 30% takes too long "
                            "and the information may not change the outcome. Colin "
                            "Powell's \"70% rule\" is a practical guide for crisis "
                            "decision-making: act on what you know, and correct course "
                            "as you learn more.</p>\n"
                            "<h2>The decision framework</h2>\n"
                            "<p>For any crisis decision, ask three questions:</p>\n"
                            "<ol>\n"
                            "<li><strong>What is the worst thing that happens if I act "
                            "and I am wrong?</strong> If the worst case is manageable, "
                            "act.</li>\n"
                            "<li><strong>What is the worst thing that happens if I do "
                            "not act?</strong> If inaction causes serious harm, act.</li>\n"
                            "<li><strong>Can I reverse this decision later?</strong> "
                            "If yes, the cost of a wrong decision is lower — bias "
                            "toward action.</li>\n"
                            "</ol>\n"
                            "<h2>Delegation in crisis</h2>\n"
                            "<p>The crisis leader cannot make every decision. Delegate "
                            "authority for specific areas to CMT members — with clear "
                            "boundaries on what they can decide independently and what "
                            "requires escalation. This prevents bottlenecks while "
                            "maintaining control.</p>\n"
                            "<h2>Decision log</h2>\n"
                            "<p>Log every significant decision: what was decided, when, "
                            "by whom, and what information it was based on. This serves "
                            "two purposes: it creates accountability and it provides "
                            "a learning resource for post-incident review.</p>"
                        ),
                        sort_order=2,
                    ),
                ],
            ),
            ModuleData(
                title="Testing, Recovery, and Improvement",
                description="Making sure your plans work and improving them over time.",
                sort_order=2,
                lessons=[
                    LessonData(
                        slug="testing-your-continuity-plans",
                        title="Testing Your Continuity Plans",
                        description="How to validate that your plans actually work when needed.",
                        body=(
                            "<h2>An untested plan is an assumption</h2>\n"
                            "<p>A business continuity plan that has not been tested is "
                            "an assumption — you assume it will work, but you do not "
                            "know. The only way to know is to test it. Testing also "
                            "builds familiarity: people who have practiced responding "
                            "to disruption respond faster and more effectively than "
                            "those encountering the plan for the first time.</p>\n"
                            "<h2>Testing methods</h2>\n"
                            "<p>Different test types serve different purposes:</p>\n"
                            "<ul>\n"
                            "<li><strong>Tabletop exercise:</strong> A scenario-based "
                            "discussion where the team walks through the response "
                            "verbally. Low cost, low disruption, good for identifying "
                            "gaps in the plan and the team.</li>\n"
                            "<li><strong>Walkthrough:</strong> A physical walkthrough "
                            "of recovery procedures — actually activating backup "
                            "systems, relocating to an alternate site, or invoking "
                            "a supplier arrangement. More realistic, higher cost.</li>\n"
                            "<li><strong>Full simulation:</strong> A realistic "
                            "simulation of a disruption event, including communications, "
                            "decision-making, and operational response. Most expensive "
                            "but most revealing.</li>\n"
                            "</ul>\n"
                            "<h2>What to test</h2>\n"
                            "<p>Test the critical processes identified in your BIA. "
                            "Do not try to test everything — focus on the processes "
                            "that matter most. Test the communication plan, the "
                            "decision-making process, and the recovery procedures "
                            "separately before combining them.</p>\n"
                            "<h2>After the test</h2>\n"
                            "<p>Every test produces findings. Document them, assign "
                            "remediation actions, and track them to completion. The "
                            "most common finding is that the plan does not match "
                            "reality — processes have changed, people have moved roles, "
                            "systems have been updated, and the plan has not kept pace. "
                            "This is why testing matters.</p>\n"
                            "<h2>Test frequency</h2>\n"
                            "<p>Tabletop exercises: at least annually. Walkthroughs: "
                            "at least annually for critical processes. Full simulations: "
                            "every two to three years, or when significant changes occur.</p>"
                        ),
                        sort_order=0,
                    ),
                    LessonData(
                        slug="incident-recovery-and-return-to-normal",
                        title="Incident Recovery and Return to Normal",
                        description="How to recover from disruption and return to normal operations.",
                        body=(
                            "<h2>Recovery is not the same as response</h2>\n"
                            "<p>The response phase ends when the immediate threat is "
                            "contained. Recovery begins when you start restoring normal "
                            "operations. The two phases overlap but require different "
                            "skills and different focus. Response is about stopping the "
                            "bleeding; recovery is about getting back to full strength.</p>\n"
                            "<h2>The recovery sequence</h2>\n"
                            "<p>Recover in priority order, not in the order things broke:</p>\n"
                            "<ol>\n"
                            "<li><strong>Critical processes first:</strong> The processes "
                            "identified as critical in your BIA. These get resources "
                            "and attention before anything else.</li>\n"
                            "<li><strong>Dependencies next:</strong> The systems, data, "
                            "and people that critical processes depend on. Fix the "
                            "foundation before restoring the structure.</li>\n"
                            "<li><strong>Important processes:</strong> Restore these "
                            "once critical processes are stable. Accept some delay.</li>\n"
                            "<li><strong>Routine processes:</strong> These can wait. "
                            "Do not let them distract from critical recovery.</li>\n"
                            "</ol>\n"
                            "<h2>Data recovery</h2>\n"
                            "<p>If data is affected, recovery follows a specific "
                            "sequence: verify the integrity of backups, restore from "
                            "the most recent clean backup, validate the restored data, "
                            "and then resume operations. Never restore without "
                            "validation — a corrupted restore is worse than the "
                            "original disruption.</p>\n"
                            "<h2>Returning to normal</h2>\n"
                            "<p>Define \"normal\" clearly. Normal is not what existed "
                            "before the disruption — it is the new steady state after "
                            "recovery. Some things will have changed permanently. "
                            "Acknowledge this and update your plans accordingly.</p>\n"
                            "<h2>The post-incident review</h2>\n"
                            "<p>Within two weeks of recovery, conduct a post-incident "
                            "review. What worked? What did not? What needs to change? "
                            "This is not about blame — it is about learning. Document "
                            "the findings and update your plans, BIA, and training "
                            "accordingly.</p>"
                        ),
                        sort_order=1,
                    ),
                    LessonData(
                        slug="continuous-improvement-of-resilience",
                        title="Continuous Improvement of Resilience",
                        description="How to build organisational resilience that improves over time.",
                        body=(
                            "<h2>Resilience is a muscle</h2>\n"
                            "<p>Organisational resilience is not a state you achieve — "
                            "it is a capability you develop. Like a muscle, it atrophies "
                            "without use and strengthens with practice. The organisations "
                            "that recover fastest from disruption are not the ones with "
                            "the best plans — they are the ones that practice, learn, "
                            "and improve continuously.</p>\n"
                            "<h2>The improvement cycle</h2>\n"
                            "<p>Resilience improves through a cycle of:</p>\n"
                            "<ol>\n"
                            "<li><strong>Assess:</strong> What are our current capabilities "
                            "and gaps? Use the BIA, test results, and incident reviews "
                            "as inputs.</li>\n"
                            "<li><strong>Improve:</strong> Address the gaps. Prioritise "
                            "based on risk and cost — fix the most impactful gaps first.</li>\n"
                            "<li><strong>Test:</strong> Validate that the improvements "
                            "work. A fix that is not tested is just an assumption.</li>\n"
                            "<li><strong>Learn:</strong> What did the test reveal? What "
                            "else needs to change? Feed the learning back into the "
                            "assessment.</li>\n"
                            "</ol>\n"
                            "<h2>Building resilience into the culture</h2>\n"
                            "<p>Resilience is not just about plans and systems — it is "
                            "about people. Build resilience by: cross-training people "
                            "so critical knowledge is not concentrated in one person, "
                            "encouraging adaptability and problem-solving, and rewarding "
                            "people who raise concerns and suggest improvements.</p>\n"
                            "<h2>Maturity model</h2>\n"
                            "<p>Use a simple maturity model to track progress:</p>\n"
                            "<ul>\n"
                            "<li><strong>Level 1 — Ad hoc:</strong> No formal plans. "
                            "Response depends on individual initiative.</li>\n"
                            "<li><strong>Level 2 — Planned:</strong> Plans exist but "
                            "are untested and not maintained.</li>\n"
                            "<li><strong>Level 3 — Tested:</strong> Plans are tested "
                            "regularly and updated based on findings.</li>\n"
                            "<li><strong>Level 4 — Integrated:</strong> Resilience is "
                            "embedded in business processes and culture.</li>\n"
                            "</ul>\n"
                            "<p>Most organisations are at Level 1 or 2. The goal is Level 3 — "
                            "tested and maintained. Level 4 is aspirational and requires "
                            "significant cultural change.</p>"
                        ),
                        sort_order=2,
                    ),
                ],
            ),
        ],
    ),
]


# ─── Main seed function ──────────────────────────────────────────────────────


async def _get_or_create_section(
    session: AsyncSession, slug: str, name: str, description: str
) -> Section:
    result = await session.execute(select(Section).where(Section.slug == slug))
    existing = result.scalar_one_or_none()
    if existing:
        return existing
    section = Section(
        id=uuid.uuid4(),
        slug=slug,
        name=name,
        description=description,
    )
    session.add(section)
    await session.flush()
    print(f"  Created section: {name}")
    return section


async def _get_or_create_author(
    session: AsyncSession, slug: str, name: str, bio: str
) -> Author:
    result = await session.execute(select(Author).where(Author.slug == slug))
    existing = result.scalar_one_or_none()
    if existing:
        return existing
    author = Author(
        id=uuid.uuid4(),
        slug=slug,
        name=name,
        bio=bio,
    )
    session.add(author)
    await session.flush()
    print(f"  Created author: {name}")
    return author


async def _get_existing_mux_assets(session: AsyncSession) -> list[dict]:
    """Fetch existing Mux assets from the media table for reuse."""
    result = await session.execute(
        select(Media).where(
            Media.mux_asset_id.isnot(None),
            Media.mux_playback_id.isnot(None),
            Media.status == MediaStatus.READY,
        )
    )
    assets = []
    for m in result.scalars().all():
        assets.append(
            {
                "mux_asset_id": m.mux_asset_id,
                "mux_playback_id": m.mux_playback_id,
                "duration_seconds": m.duration_seconds or 300,
            }
        )
    return assets


async def seed_courses():
    print("=== Seeding 5 courses ===\n")

    async with AsyncSessionLocal() as session:
        # 1. Ensure sections exist
        print("Sections:")
        section_map: dict[str, Section] = {}
        section_configs = [
            ("risk-management", "Risk Management", "Risk management fundamentals and practice"),
            ("compliance", "Compliance", "Regulatory compliance and governance"),
            ("resilience", "Resilience", "Business continuity and organisational resilience"),
        ]
        for slug, name, desc in section_configs:
            section_map[slug] = await _get_or_create_section(session, slug, name, desc)

        # 2. Ensure author exists
        print("\nAuthors:")
        author_map: dict[str, Author] = {}
        author_configs = [
            (
                "practicable-author",
                "Practicable Author",
                "Risk management practitioner and educator with over 15 years of experience "
                "in enterprise risk, compliance, and business continuity across financial "
                "services, technology, and government sectors.",
            ),
        ]
        for slug, name, bio in author_configs:
            author_map[slug] = await _get_or_create_author(session, slug, name, bio)

        # 3. Get existing Mux assets for video reuse
        print("\nFetching existing Mux assets...")
        mux_assets = await _get_existing_mux_assets(session)
        print(f"  Found {len(mux_assets)} existing video assets")

        # 4. Create courses
        video_counter = 0
        for course_data in COURSES:
            # Check if course already exists
            result = await session.execute(
                select(Course).where(Course.slug == course_data.slug)
            )
            existing_course = result.scalar_one_or_none()
            if existing_course:
                print(f"\n  Course '{course_data.title}' already exists — skipping")
                continue

            print(f"\n--- Course: {course_data.title} ---")

            # Generate and upload cover image
            cover_key = f"course-covers/{course_data.slug}.jpg"
            print(f"  Generating cover image...")
            img_bytes = _generate_cover(
                title=course_data.title,
                subtitle=course_data.subtitle,
                bg_color=course_data.cover_bg,
                accent_color=course_data.cover_accent,
                pattern=course_data.cover_pattern,
            )
            try:
                upload_file(key=cover_key, body=img_bytes, content_type="image/jpeg")
                print(f"  Uploaded cover: {cover_key}")
            except Exception as e:
                print(f"  WARNING: Could not upload cover image: {e}")
                cover_key = None

            # Create course
            section = section_map[course_data.section_slug]
            author = author_map[course_data.author_slug]

            course = Course(
                id=uuid.uuid4(),
                slug=course_data.slug,
                title=course_data.title,
                subtitle=course_data.subtitle,
                description=course_data.description,
                section_id=section.id,
                author_id=author.id,
                published=True,
                cover_image_key=cover_key,
                level=course_data.level,
                estimated_duration_minutes=course_data.estimated_duration_minutes,
            )
            session.add(course)
            await session.flush()
            print(f"  Created course: {course.title} (id={course.id})")

            # Create modules and lessons
            total_lessons = 0
            total_video = 0
            total_reading = 0

            for mod_data in course_data.modules:
                module = Module(
                    id=uuid.uuid4(),
                    title=mod_data.title,
                    description=mod_data.description,
                    sort_order=mod_data.sort_order,
                    course_id=course.id,
                )
                session.add(module)
                await session.flush()

                for lesson_data in mod_data.lessons:
                    # Determine lesson type
                    if lesson_data.reuse_video and mux_assets:
                        lesson_type = LessonType.VIDEO
                    elif lesson_data.body:
                        lesson_type = LessonType.READING
                    else:
                        lesson_type = LessonType.READING

                    lesson = Lesson(
                        id=uuid.uuid4(),
                        slug=lesson_data.slug,
                        title=lesson_data.title,
                        description=lesson_data.description,
                        lesson_type=lesson_type,
                        body=lesson_data.body if lesson_type == LessonType.READING else None,
                        prose_sanitized=(
                            sanitize_html(lesson_data.body)
                            if lesson_type == LessonType.READING and lesson_data.body
                            else None
                        ),
                        module_id=module.id,
                        sort_order=lesson_data.sort_order,
                        published=True,
                    )
                    session.add(lesson)
                    await session.flush()

                    # Create lesson blocks for reading lessons
                    if lesson_type == LessonType.READING and lesson_data.body:
                        block = LessonBlock(
                            id=uuid.uuid4(),
                            lesson_id=lesson.id,
                            sort_order=0,
                            block_type=LessonBlockType.TEXT,
                            text_body=lesson_data.body,
                            heading=lesson_data.title,
                            prose_sanitized=sanitize_html(lesson_data.body),
                        )
                        session.add(block)

                    # Create media row for video lessons
                    if lesson_type == LessonType.VIDEO and mux_assets:
                        asset = mux_assets[video_counter % len(mux_assets)]
                        media = Media(
                            id=uuid.uuid4(),
                            lesson_id=lesson.id,
                            mux_asset_id=asset["mux_asset_id"],
                            mux_playback_id=asset["mux_playback_id"],
                            status=MediaStatus.READY,
                            duration_seconds=asset["duration_seconds"],
                        )
                        session.add(media)
                        video_counter += 1
                        total_video += 1

                    total_lessons += 1
                    if lesson_type == LessonType.READING:
                        total_reading += 1

            print(
                f"  Created {len(course_data.modules)} modules, "
                f"{total_lessons} lessons ({total_reading} reading, {total_video} video)"
            )

        await session.commit()
        print("\n=== Done — all courses committed ===")


if __name__ == "__main__":
    asyncio.run(seed_courses())
