"""Build a domain pack PDF from the real 100-question catalogue.

WHAT A DOMAIN PACK IS (week2_plan.md W2-R6, RS 5.6). A purchasable *artefact* — a
formatted, ordered PDF of one domain's questions — not a paywall over free text. The
questions themselves stay free on the site, forever. What is sold here is the format
and the ordering: a document you can print, take into a meeting, and work through in a
defensible sequence. §20.6's honesty notice says exactly that, on the cover, above the
fold, not in fine print.

WHY THIS UNBLOCKED. Decision #19 held this SKU because "producing the PDF is content
work only the author can do." It was answered 2026-08-14 with "design something from
the files we already have" — so the pack is generated from
`docs/questions/questions.json`, which IS the author's own content: 100 real questions
with real answers, already seeded and already live on the site. Nothing here is
written by a machine. The machine only orders and typesets what was already authored.

THE WORKING ORDER — the actual thing being sold, so it has to be defensible.
Questions are sorted by, in strict priority:

  1. Tier          Foundational → Tactical → Strategic → Transformational
  2. Reg. pressure High → Moderate → Low → None
  3. Effort        Quick Win → Moderate → Project → Transformation
  4. Original id   (stable tiebreak, so the output is byte-reproducible)

That is not an arbitrary sort. It is the intern brief's own stated proof of value read
back as an ordering — *"what can I fix in a fortnight, cheaply, that my regulator cares
about?"* — basics before ambition, regulator-exposed before not, cheap before
expensive. The cover page explains it in those words so a buyer can disagree with it
knowingly.

TYPEFACES — a deviation, stated rather than hidden. The brand faces (Schibsted
Grotesk, Newsreader) are fetched at build time by `vite-plugin-webfont-dl` and exist
only as woff2, which ReportLab cannot embed. This uses the PDF base-14 Helvetica and
Times instead. The pack therefore does NOT match the site's typography and is not
claimed to. Dropping real .ttf files into `assets/fonts/` and registering them below is
the fix when the faces are licensed for embedding.

Run (from backend/):
    python scripts/build_domain_pack.py --domain Risk
    python scripts/build_domain_pack.py --all

Output lands in `build/domain-packs/` — gitignored, because a 60-question PDF is a
build product, not source. The source is questions.json.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
QUESTIONS_JSON = REPO_ROOT / "docs" / "questions" / "questions.json"
OUT_DIR = Path(__file__).resolve().parents[1] / "build" / "domain-packs"

# theme.css tokens, quoted not eyeballed. A PDF is not a stylesheet, so these are
# literals here by necessity — but they are the same literals, so the artefact and the
# site are recognisably one brand.
INK = colors.HexColor("#1C1712")  # --foreground
STAGE = colors.HexColor("#10213E")  # --stage
GOLD_STRONG = colors.HexColor("#7C5C14")  # --gold-strong (the text-safe shade; NEVER --gold)
MUTED = colors.HexColor("#6E675A")  # --muted-foreground
RULE = colors.HexColor("#E6DFD0")  # --border

# The five domains as they appear in questions.json, mapped to the buyer-facing names
# decided in week1_plan.md #2 and seeded in db/seed/001.
DOMAIN_TITLES = {
    "Risk": "Risk (Enterprise & operational)",
    "Cyber": "Cyber (Technology & security)",
    "Compliance": "Compliance (Regulatory)",
    "Resilience": "Resilience (Continuity)",
    "AI": "AI (Governance)",
}
DOMAIN_SLUGS = {
    "Risk": "risk-enterprise-op",
    "Cyber": "cyber-tech-security",
    "Compliance": "compliance-regulatory",
    "Resilience": "resilience-continuity",
    "AI": "ai-governance",
}

# Sort keys. Lower sorts first. Any value not listed sorts last rather than crashing —
# a new tag value should degrade the ordering, not break the build.
TIER_ORDER = {"Foundational": 0, "Tactical": 1, "Strategic": 2, "Transformational": 3}
REG_ORDER = {"High": 0, "Moderate": 1, "Low": 2, "None": 3}
EFFORT_ORDER = {"Quick Win": 0, "Moderate": 1, "Project": 2, "Transformation": 3}


def working_order_key(q: dict) -> tuple:
    tags = q.get("tags", {})
    return (
        TIER_ORDER.get(tags.get("tier"), 99),
        REG_ORDER.get(tags.get("reg_pressure"), 99),
        EFFORT_ORDER.get(tags.get("effort"), 99),
        q.get("id", 0),
    )


def esc(text: str) -> str:
    """questions.json carries markdown emphasis and raw ampersands; ReportLab's
    Paragraph parses a small HTML dialect. Escape the markup characters first, then
    re-introduce *emphasis* as <i>, so an ampersand in an answer cannot break a page."""
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*([^*]+?)\*(?!\*)", r"<i>\1</i>", text)
    return text


def build_styles() -> dict[str, ParagraphStyle]:
    return {
        "cover_brand": ParagraphStyle(
            "cover_brand", fontName="Helvetica-Bold", fontSize=11, textColor=GOLD_STRONG,
            spaceAfter=0, leading=14,
        ),
        "cover_title": ParagraphStyle(
            "cover_title", fontName="Helvetica-Bold", fontSize=30, textColor=STAGE,
            leading=34, spaceBefore=10, spaceAfter=8,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub", fontName="Times-Roman", fontSize=13, textColor=MUTED,
            leading=19, spaceAfter=18,
        ),
        "h_section": ParagraphStyle(
            "h_section", fontName="Helvetica-Bold", fontSize=15, textColor=STAGE,
            leading=19, spaceBefore=16, spaceAfter=8,
        ),
        "body": ParagraphStyle(
            "body", fontName="Times-Roman", fontSize=10.5, textColor=INK,
            leading=16, spaceAfter=8, alignment=TA_JUSTIFY,
        ),
        "note": ParagraphStyle(
            "note", fontName="Helvetica", fontSize=9.5, textColor=MUTED,
            leading=14, spaceAfter=6,
        ),
        "q_num": ParagraphStyle(
            "q_num", fontName="Helvetica-Bold", fontSize=8.5, textColor=GOLD_STRONG,
            leading=11, spaceAfter=2,
        ),
        "q_title": ParagraphStyle(
            "q_title", fontName="Helvetica-Bold", fontSize=13, textColor=STAGE,
            leading=17, spaceAfter=3,
        ),
        "q_sub": ParagraphStyle(
            "q_sub", fontName="Times-Italic", fontSize=10.5, textColor=MUTED,
            leading=15, spaceAfter=6,
        ),
        "q_tags": ParagraphStyle(
            "q_tags", fontName="Helvetica", fontSize=8, textColor=MUTED,
            leading=12, spaceAfter=8,
        ),
        "toc": ParagraphStyle(
            "toc", fontName="Helvetica", fontSize=9.5, textColor=INK,
            leading=15, spaceAfter=2, leftIndent=16, firstLineIndent=-16,
        ),
    }


def tag_line(tags: dict) -> str:
    """Every badge carries a word (DESIGN.md §7.6: colour is never the only carrier of
    meaning — in a print artefact there is no colour to lean on at all)."""
    parts = [
        ("Tier", tags.get("tier")),
        ("Effort", tags.get("effort")),
        ("Duration", tags.get("duration")),
        ("Cost", tags.get("cost")),
        ("ROI", tags.get("roi_horizon")),
        ("Regulator pressure", tags.get("reg_pressure")),
    ]
    rendered = "  ·  ".join(f"{k} {esc(str(v))}" for k, v in parts if v)
    traits = tags.get("leadership_traits")
    if traits:
        rendered += f"<br/>Leadership {esc(str(traits))}"
    return rendered


def build_pack(domain: str, questions: list[dict], out_path: Path) -> Path:
    title = DOMAIN_TITLES.get(domain, domain)
    ordered = sorted(questions, key=working_order_key)
    styles = build_styles()

    def decorate(canvas, doc):
        """Footer rule + page number on every page but the cover."""
        canvas.saveState()
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.5)
        canvas.line(20 * mm, 15 * mm, A4[0] - 20 * mm, 15 * mm)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(20 * mm, 10 * mm, f"Practicable · {title}")
        canvas.drawRightString(A4[0] - 20 * mm, 10 * mm, str(canvas.getPageNumber()))
        canvas.restoreState()

    doc = BaseDocTemplate(
        str(out_path), pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm, topMargin=20 * mm, bottomMargin=22 * mm,
        title=f"{title} — Practicable question pack",
        author="Practicable", subject="Risk management working questions",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame]),
        PageTemplate(id="content", frames=[frame], onPage=decorate),
    ])

    story: list = []

    # ── Cover ────────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 40 * mm))
    story.append(Paragraph("PRACTICABLE", styles["cover_brand"]))
    story.append(Paragraph(f"{esc(title)}", styles["cover_title"]))
    story.append(Paragraph(
        f"{len(ordered)} working questions, in the order worth doing them.",
        styles["cover_sub"],
    ))
    story.append(Spacer(1, 6 * mm))

    # §20.6's honesty notice — above the fold, on the cover, not in fine print. The
    # fastest possible way to lose buyer trust is a pack that implies purchase unlocks
    # something already free.
    story.append(Paragraph(
        "<b>What you are buying, plainly.</b> Every question and answer in this pack is "
        "free to read on practicable.com.au, and always will be. This document is not a "
        "paywall over them. What it adds is the part that takes the time: all "
        f"{len(ordered)} {esc(domain)} questions gathered in one place, typeset to be "
        "printed and marked up, and put in a defensible working order you can take into "
        "a planning meeting. If you would rather read them free on the site, do that "
        "instead — the link is on every page.",
        styles["note"],
    ))
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph("How this pack is ordered", styles["h_section"]))
    story.append(Paragraph(
        "Not by number, and not by how interesting the question is. The order answers "
        "one question a practitioner actually asks: <i>what can I fix in a fortnight, "
        "cheaply, that my regulator cares about?</i>",
        styles["body"],
    ))
    story.append(Paragraph(
        "<b>1. Foundations before ambition.</b> Foundational questions first, then "
        "Tactical, then Strategic, then Transformational. Skipping the basics is the "
        "most common way a risk programme stalls in year two.<br/>"
        "<b>2. Regulator-exposed before not.</b> Within a tier, higher regulator "
        "pressure comes first.<br/>"
        "<b>3. Cheap before expensive.</b> Within that, quick wins before multi-month "
        "projects.",
        styles["note"],
    ))
    story.append(Paragraph(
        "You are welcome to disagree with that order — it is stated here so you can "
        "disagree with it knowingly, rather than assuming the sequence is arbitrary. "
        "Each question carries its own tags so you can re-sort by whichever constraint "
        "is actually binding on you this quarter.",
        styles["body"],
    ))

    story.append(NextPageTemplate("content"))
    story.append(PageBreak())

    # ── The working order at a glance ────────────────────────────────────────────
    story.append(Paragraph("The working order", styles["h_section"]))
    story.append(Paragraph(
        "The whole pack on one page, so you can find where you are without paging "
        "through it.", styles["note"],
    ))
    story.append(Spacer(1, 3 * mm))
    for i, q in enumerate(ordered, start=1):
        tags = q.get("tags", {})
        story.append(Paragraph(
            f"<b>{i}.</b>&nbsp; {esc(q['question'])} "
            f"<font color='#6E675A' size='8'>— {esc(str(tags.get('tier', '')))}, "
            f"{esc(str(tags.get('effort', '')))}</font>",
            styles["toc"],
        ))
    story.append(PageBreak())

    # ── The questions ────────────────────────────────────────────────────────────
    for i, q in enumerate(ordered, start=1):
        block = [
            Paragraph(f"{i} OF {len(ordered)}", styles["q_num"]),
            Paragraph(esc(q["question"]), styles["q_title"]),
        ]
        if q.get("description"):
            block.append(Paragraph(esc(q["description"]), styles["q_sub"]))
        block.append(Paragraph(tag_line(q.get("tags", {})), styles["q_tags"]))
        # Keep the heading with at least the first slab of its answer, so a question
        # never sits alone at the foot of a page.
        story.append(KeepTogether(block))
        story.append(Paragraph(esc(q["answer"]), styles["body"]))
        story.append(Spacer(1, 7 * mm))

    doc.build(story)
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--domain", choices=sorted(DOMAIN_TITLES), help="Build one domain.")
    parser.add_argument("--all", action="store_true", help="Build every domain.")
    args = parser.parse_args()

    if not args.domain and not args.all:
        parser.error("pass --domain <name> or --all")

    all_questions = json.loads(QUESTIONS_JSON.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    targets = sorted(DOMAIN_TITLES) if args.all else [args.domain]
    for domain in targets:
        subset = [q for q in all_questions if q.get("domain") == domain]
        if not subset:
            print(f"  {domain}: no questions, skipped")
            continue
        out = OUT_DIR / f"practicable-{DOMAIN_SLUGS[domain]}-question-pack.pdf"
        build_pack(domain, subset, out)
        size = out.stat().st_size
        flag = "" if len(subset) >= 20 else "   <-- thin: see docs/pricing.md before publishing"
        print(f"  {domain:<12} {len(subset):>3} questions  {size:>8,} bytes  {out.name}{flag}")


if __name__ == "__main__":
    main()
