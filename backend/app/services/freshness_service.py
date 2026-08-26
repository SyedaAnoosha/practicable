"""Content freshness (#16) — computed server-side, once, for every surface.

The admin needs to know which sold artefacts have gone stale. `last_reviewed_at` already
exists on `templates` (migration 013) and is added to `courses` by migration 035; this
module turns that timestamp into a status the admin screens render directly.

**Three states, not two.** `unknown` is not `stale`. A template nobody has ever reviewed
and a template reviewed fourteen months ago are different facts and the admin acts on
them differently — the first needs a first pass, the second needs a re-read. Collapsing
them into one "needs attention" badge throws away the distinction the admin is trying to
make. This is the same rule the rest of this codebase already follows for every unset
evidence field (week4_plan.md §20.1: unknown is null, zero is 0, and the two are
different).

**Computed here rather than in TypeScript**, following `admin/promotions.py`'s `status`
field: date arithmetic done twice in two languages drifts, and the second copy is the one
nobody tests. The admin screens receive a string and render it.

The admin screens alone make freshness *pull-only*: a warning exists only when an admin
happens to load the list. improvements.md §16 asks for "automatic warnings", so this
module also owns the push half — a scan that turns stale/unknown findings into Notification
rows for every admin (via `create_admin_freshness_notifications`), deduplicated so repeat
scans don't spam. It reuses the peer `notification_service` infrastructure; it does not
build a parallel notification path.

The third §16 signal — "question has high traffic but low related-product conversion" —
is approximated by `find_low_conversion_questions`. It is an approximation by necessity:
question-page views are not tracked anywhere and no purchase carries per-question
attribution, so "traffic" reads as search volume matching the question's title
(`FilterEvent`) and "conversion" as routed-product clicks from that question's page
(`RecommendationEvent`, surface="question"). Both ledgers are anonymous by design, which
is exactly what makes this computable at all without new tracking.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Course,
    FilterEvent,
    Notification,
    Question,
    RecommendationEvent,
    Role,
    Template,
    User,
)

# 12 months, the threshold docs/improvements.md §16 names outright ("Template hasn't been
# reviewed for 12 months"). Expressed in days rather than via dateutil's relative months:
# the exact day a review tips from fresh to stale is not a fact anyone depends on, and a
# fixed window keeps this module dependency-free.
STALE_AFTER = timedelta(days=365)

FreshnessStatus = Literal["fresh", "stale", "unknown"]


@dataclass(frozen=True)
class Freshness:
    """The computed verdict plus the sentence the admin screen shows.

    `message` is None for `fresh` on purpose: there is nothing to warn about, and a
    badge that renders for every row is a badge nobody reads.
    """

    status: FreshnessStatus
    message: Optional[str]


_FRESH = Freshness(status="fresh", message=None)
_UNKNOWN = Freshness(
    status="unknown",
    message="Never reviewed — no review date has been recorded.",
)


def compute_freshness(
    last_reviewed_at: Optional[datetime],
    *,
    now: Optional[datetime] = None,
) -> Freshness:
    """Fresh / stale / unknown for one piece of content.

    `now` is injectable so a test can pin the clock instead of constructing dates
    relative to the real one, which makes the boundary cases readable.

    Naive datetimes are treated as UTC rather than raising. Postgres returns aware
    values for a `timestamptz` column, but a row written by a test factory or an older
    fixture can carry a naive one, and `aware - naive` is a `TypeError` that would 500
    the entire admin template list over a display-only field. The coercion is the
    correct reading: every timestamp this app stores is UTC.
    """
    if last_reviewed_at is None:
        return _UNKNOWN

    reference = now or datetime.now(timezone.utc)
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=timezone.utc)

    reviewed = last_reviewed_at
    if reviewed.tzinfo is None:
        reviewed = reviewed.replace(tzinfo=timezone.utc)

    age = reference - reviewed
    if age <= STALE_AFTER:
        return _FRESH

    months = int(age.days // 30)
    return Freshness(
        status="stale",
        message=f"Last reviewed {months} months ago — due for review.",
    )


# ── The push half (#16 "automatic warnings") ─────────────────────────────────────
#
# Thresholds for find_low_conversion_questions. Both are judgement calls dressed as
# constants so a future tuning is a one-line diff rather than an archaeology dig:
#   - MIN_SEARCH_TRAFFIC: below this a question simply hasn't been searched enough for
#     "high traffic" to be a fair description of anything.
#   - MAX_RECOMMENDATION_CLICKS: at or below this, a question's routed products are
#     effectively not being followed despite demonstrated reader interest.
MIN_SEARCH_TRAFFIC = 10
MAX_RECOMMENDATION_CLICKS = 2


def _normalize(text: str) -> str:
    """Lowercase, collapse whitespace, and drop terminal punctuation so 'Do I need
    cyber insurance?' matches the title 'do i need cyber insurance'."""
    cleaned = " ".join(text.lower().split())
    return cleaned.rstrip("?!. ")


def _query_matches_question(query_text: str, title: str) -> bool:
    """Whether one search belongs to one question's traffic.

    Containment in either direction on the normalized strings: readers type subsets of
    the title ("cyber insurance" ⊂ "do i need cyber insurance?") and occasionally the
    whole thing plus noise. Not substring-on-raw because punctuation and casing would
    both split matches; not token-overlap because short tokens ("i", "a") would match
    nearly everything.
    """
    q = _normalize(query_text)
    t = _normalize(title)
    if not q or not t:
        return False
    return q in t or t in q


async def scan_stale_content(session: AsyncSession) -> dict[str, list[dict[str, Any]]]:
    """Run compute_freshness over every template and course; report only what needs action.

    Fresh rows are omitted entirely: a warning list containing every healthy artefact is
    a list nobody reads past day two. Returns slugs/titles alongside ids so the admin UI
    can render findings without a second lookup.
    """
    findings: dict[str, list[dict[str, Any]]] = {
        "stale_templates": [],
        "unknown_templates": [],
        "stale_courses": [],
        "unknown_courses": [],
    }

    templates = (await session.execute(select(Template))).scalars().all()
    for template in templates:
        verdict = compute_freshness(template.last_reviewed_at)
        if verdict.status == "fresh":
            continue
        findings[f"{verdict.status}_templates"].append(
            {"id": template.id, "slug": template.slug, "title": template.title}
        )

    courses = (await session.execute(select(Course))).scalars().all()
    for course in courses:
        verdict = compute_freshness(course.last_reviewed_at)
        if verdict.status == "fresh":
            continue
        findings[f"{verdict.status}_courses"].append(
            {"id": course.id, "slug": course.slug, "title": course.title}
        )

    return findings


async def find_low_conversion_questions(
    session: AsyncSession,
    *,
    min_search_traffic: int = MIN_SEARCH_TRAFFIC,
    max_recommendation_clicks: int = MAX_RECOMMENDATION_CLICKS,
) -> list[dict[str, Any]]:
    """§16's third signal, approximated: high search interest, near-zero routed clicks.

    Traffic side: FilterEvent search queries matched to questions by title containment.
    Conversion side: RecommendationEvent rows with surface="question" grouped by
    question_slug — a click there IS the related-product conversion this product has.

    Matching is done in Python, not SQL: the join is fuzzy (containment across two
    normalized free-text columns), and the ledger tables are anonymous aggregates kept
    deliberately tiny relative to real content tables. If either ever grows large enough
    that this loop matters, the honest fix is recording question_id at write time, not
    optimizing a guess.
    """
    # Per-question routed-product clicks, keyed by slug. Slugs only — the event table
    # stores no ids by design (see recommendation_event.py's docstring).
    click_rows = await session.execute(
        select(RecommendationEvent.question_slug, func.count(RecommendationEvent.id))
        .where(RecommendationEvent.surface == "question")
        .where(RecommendationEvent.question_slug.isnot(None))
        .group_by(RecommendationEvent.question_slug)
    )
    clicks_by_slug: dict[str, int] = {
        slug: count for slug, count in click_rows.all() if slug
    }

    # Search volume per distinct query string.
    query_rows = await session.execute(
        select(FilterEvent.query_text, func.count(FilterEvent.id))
        .where(FilterEvent.query_text.isnot(None))
        .where(FilterEvent.query_text != "")
        .group_by(FilterEvent.query_text)
    )
    searches_by_query: dict[str, int] = {
        query: count for query, count in query_rows.all() if query
    }

    published = (
        await session.execute(select(Question).where(Question.published.is_(True)))
    ).scalars().all()

    flagged: list[dict[str, Any]] = []
    for question in published:
        searches = sum(
            count
            for query, count in searches_by_query.items()
            if _query_matches_question(query, question.title)
        )
        if searches < min_search_traffic:
            continue
        clicks = clicks_by_slug.get(question.slug, 0)
        if clicks > max_recommendation_clicks:
            continue
        flagged.append(
            {
                "id": question.id,
                "slug": question.slug,
                "title": question.title,
                "searches": searches,
                "clicks": clicks,
            }
        )

    # Loudest first: the admin works this list top-down or not at all.
    flagged.sort(key=lambda f: (-f["searches"], f["clicks"]))
    return flagged


_FRESHNESS_NOTIFICATION_TYPE = "content_freshness_warning"
_CONVERSION_NOTIFICATION_TYPE = "low_conversion_question"


async def create_admin_freshness_notifications(
    session: AsyncSession,
    *,
    min_search_traffic: int = MIN_SEARCH_TRAFFIC,
    max_recommendation_clicks: int = MAX_RECOMMENDATION_CLICKS,
) -> dict[str, Any]:
    """Turn scan findings into Notification rows for every admin, deduplicated.

    Dedup rule: skip a row when the same admin still has an *unread* notification of the
    same type for the same entity. Read-and-dismissed warnings may re-fire on the next
    scan — that's the point of dismissing one: it clears the slate for the next honest
    signal, and content that is still stale will warn again rather than silently staying
    stale forever because one scan once mentioned it.

    No commit here, matching notification_service's contract: the calling endpoint owns
    the transaction, so a failed scan takes its notifications down with it.
    """
    admins = (
        await session.execute(select(User).where(User.role == Role.ADMIN))
    ).scalars().all()
    if not admins:
        return {"notifications_created": 0, "recipients": 0}

    findings = await scan_stale_content(session)
    low_conversion = await find_low_conversion_questions(
        session,
        min_search_traffic=min_search_traffic,
        max_recommendation_clicks=max_recommendation_clicks,
    )

    # One round trip for every unread freshness/conversion row these admins hold, then
    # dedupe against the set in memory — N admins × M findings is a fan-out, and a
    # per-candidate EXISTS query inside the loop would make it N×M round trips.
    existing_rows = (
        await session.execute(
            select(Notification.user_id, Notification.notification_type, Notification.entity_id)
            .where(Notification.user_id.in_([admin.id for admin in admins]))
            .where(
                Notification.notification_type.in_(
                    [_FRESHNESS_NOTIFICATION_TYPE, _CONVERSION_NOTIFICATION_TYPE]
                )
            )
            .where(Notification.read.is_(False))
        )
    ).all()
    existing = {(user_id, ntype, entity_id) for user_id, ntype, entity_id in existing_rows}

    created = 0

    def _queue(entity_type: str, entity_id: uuid.UUID, title: str, message: str, action_url: str, meta: dict[str, Any]) -> None:
        nonlocal created
        for admin in admins:
            key = (admin.id, _type_for(entity_type), entity_id)
            if key in existing:
                continue
            existing.add(key)
            session.add(
                Notification(
                    user_id=admin.id,
                    notification_type=_type_for(entity_type),
                    entity_type=entity_type,
                    entity_id=entity_id,
                    title=title,
                    message=message,
                    action_url=action_url,
                    meta=meta,
                )
            )
            created += 1

    def _type_for(entity_type: str) -> str:
        return _CONVERSION_NOTIFICATION_TYPE if entity_type == "question" else _FRESHNESS_NOTIFICATION_TYPE

    for group, entity_type, noun, url_base in (
        ("stale_templates", "template", "template", "/admin/templates"),
        ("unknown_templates", "template", "template", "/admin/templates"),
        ("stale_courses", "course", "course", "/admin/courses"),
        ("unknown_courses", "course", "course", "/admin/courses"),
    ):
        for item in findings[group]:
            never = group.startswith("unknown")
            _queue(
                entity_type=entity_type,
                entity_id=item["id"],
                title=(
                    f"Never reviewed: {item['title']}"
                    if never
                    else f"Stale content: {item['title']}"
                ),
                message=(
                    f"The {noun} '{item['title']}' has no recorded review date. "
                    "Schedule a first review."
                    if never
                    else f"The {noun} '{item['title']}' was last reviewed more than 12 months ago. "
                    "It is due for review."
                ),
                action_url=url_base,
                meta={"slug": item["slug"], "status": group.rsplit("_", 1)[0]},
            )

    for item in low_conversion:
        _queue(
            entity_type="question",
            entity_id=item["id"],
            title=f"Low conversion: {item['title']}",
            message=(
                f"Question '{item['title']}' has high search traffic ({item['searches']} "
                f"searches) but only {item['clicks']} related-product clicks. Its routed "
                "products may need better matching."
            ),
            action_url="/admin/questions",
            meta={"slug": item["slug"], "searches": item["searches"], "clicks": item["clicks"]},
        )

    await session.flush()

    summary = {
        "stale_templates": len(findings["stale_templates"]),
        "unknown_templates": len(findings["unknown_templates"]),
        "stale_courses": len(findings["stale_courses"]),
        "unknown_courses": len(findings["unknown_courses"]),
        "low_conversion_questions": len(low_conversion),
        "recipients": len(admins),
        "notifications_created": created,
    }
    return summary
