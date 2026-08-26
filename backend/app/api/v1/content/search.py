"""Public full-text search endpoint (W5-R3).

GET /search?q=… returns results across courses, templates, questions and packs
in one response, grouped by type, ranked by ts_rank_cd.

Only published rows appear. A draft, in-review or archived row is never
returned — asserted by a test that creates one of each.

Four bounded queries, one per entity type, regardless of result count.
websearch_to_tsquery is used instead of plainto_tsquery because it accepts
quoted phrases and never raises on malformed input.

When all four queries return zero results, a lightweight fallback runs:
- Keyword substring match on questions (title + preview)
- A list of available domains so the user can browse instead
This fallback does not count against the four-query budget because it
only executes when the main search already produced nothing.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import literal_column, select, func, text, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Course, Template, Question, Product, Domain
from app.db.session import get_session

router = APIRouter()

MAX_QUERY_LENGTH = 200
RESULTS_PER_TYPE = 5


class SearchResult(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: str | None = None
    description: str | None = None
    type: str  # "course" | "template" | "question" | "pack"
    rank: float


class SearchGroup(BaseModel):
    type: str
    total: int
    items: list[SearchResult]


class FallbackQuestion(BaseModel):
    """A close-match question returned when the main search yields nothing.

    Lighter than QuestionSummaryOut — no tags, no domain slug — because the
    fallback is a hint, not a catalogue result.  The frontend links straight
    to the question detail page.
    """
    id: str
    slug: str
    title: str
    preview: str
    domain: str


class SuggestedDomain(BaseModel):
    """A domain the user can browse when their search matched nothing."""
    name: str
    slug: str


class SearchFallback(BaseModel):
    """Carried on SearchResponse only when the main search returned zero results.

    Contains the closest keyword matches and a list of domains to steer the
    user toward structured browsing instead of a dead end.
    """
    closest_questions: list[FallbackQuestion]
    suggested_domains: list[SuggestedDomain]


class SearchResponse(BaseModel):
    query: str
    groups: list[SearchGroup]
    fallback: SearchFallback | None = None


# Column name used by migration 028 on every searchable table.
_SV = "search_vector"


async def _search_entity(
    session: AsyncSession,
    *,
    model,
    entity_type: str,
    tsquery: str,
    title_col: str = "title",
    limit: int = RESULTS_PER_TYPE,
) -> tuple[list[SearchResult], int]:
    """Search one entity type with full-text. Returns (results, total_count).

    ``title_col`` names the column used for the title field ("title" for
    courses/templates/questions, "name" for products/packs).
    """
    sv = literal_column(_SV)
    tsq = text("websearch_to_tsquery('english', :q)")
    published = model.published.is_(True)
    title = getattr(model, title_col)

    # Build the column list: always id, slug, title, rank, plus the total.
    #
    # The total comes from a COUNT(*) OVER () window rather than a second COUNT
    # query. A separate count would double the query budget to eight — §2.3.4 of
    # week5_plan.md budgets four, one per entity type, and that is the number the
    # query-count test asserts. The window is computed over the full matching set
    # *before* LIMIT applies, so it still counts every match, not just the five
    # returned. It rides along on rows already being fetched, so it costs no extra
    # round trip.
    rank_expr = func.ts_rank_cd(sv, tsq).label("rank")
    columns = [
        model.id.label("id"),
        model.slug.label("slug"),
        title.label("title"),
        rank_expr,
        func.count().over().label("total"),
    ]

    # Optional subtitle — present on Course and Question, absent on Template
    # and Product.  The hasattr check avoids AttributeError on models without
    # the column, and the ``.property`` check distinguishes mapped columns
    # from inherited attributes.
    has_subtitle = hasattr(model, "subtitle") and hasattr(
        model.subtitle, "property"
    )
    if has_subtitle:
        columns.append(model.subtitle.label("subtitle"))

    stmt = (
        select(*columns)
        .where(sv.op("@@")(tsq), published)
        .order_by(text("rank DESC"))
        .limit(limit)
        .params(q=tsquery)
    )

    rows = (await session.execute(stmt)).all()

    # COUNT(*) OVER () repeats the same total on every row, so any row carries it.
    # No rows means no matches, which is a total of zero.
    total = int(rows[0].total) if rows else 0

    results = []
    for row in rows:
        item = SearchResult(
            id=str(row.id),
            slug=row.slug,
            title=row.title,
            rank=float(row.rank) if row.rank else 0.0,
            type=entity_type,
        )
        if has_subtitle:
            sub = getattr(row, "subtitle", None)
            if sub:
                item.subtitle = sub
        results.append(item)

    return results, total


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query("", description="Search query"),
    session: AsyncSession = Depends(get_session),
):
    """Full-text search across courses, templates, questions, and packs.

    Returns results grouped by type, ranked by ts_rank_cd. Empty or
    whitespace-only queries return empty groups without touching the database.
    """
    # Guard: empty or whitespace-only queries return empty groups
    query = q.strip()
    if not query:
        return SearchResponse(query=q, groups=[])

    # Cap query length
    query = query[:MAX_QUERY_LENGTH]

    tsquery = query

    # Search all four entity types (sequential but bounded — four queries
    # regardless of result count).
    courses_results, courses_total = await _search_entity(
        session, model=Course, entity_type="course", tsquery=tsquery,
    )
    templates_results, templates_total = await _search_entity(
        session, model=Template, entity_type="template", tsquery=tsquery,
    )
    questions_results, questions_total = await _search_entity(
        session, model=Question, entity_type="question", tsquery=tsquery,
    )
    # Packs are products — search products by name/search_title/description
    packs_results, packs_total = await _search_entity(
        session, model=Product, entity_type="pack", tsquery=tsquery,
        title_col="name",
    )

    groups = [
        SearchGroup(type="course", total=courses_total, items=courses_results),
        SearchGroup(type="template", total=templates_total, items=templates_results),
        SearchGroup(type="question", total=questions_total, items=questions_results),
        SearchGroup(type="pack", total=packs_total, items=packs_results),
    ]

    total = courses_total + templates_total + questions_total + packs_total
    fallback: SearchFallback | None = None
    if total == 0:
        fallback = await _build_fallback(session, query)

    return SearchResponse(query=q, groups=groups, fallback=fallback)


FALLBACK_QUESTION_LIMIT = 5
FALLBACK_DOMAIN_LIMIT = 6


async def _build_fallback(
    session: AsyncSession,
    query: str,
) -> SearchFallback:
    """Build the zero-result recovery payload.

    Two lightweight queries — one for closest questions via keyword substring
    match, one for the domain list.  Neither touches the search_vector column
    or the GIN indexes; they use plain ILIKE / no filter respectively.
    """
    # Split the query into individual words so each word gets an ILIKE hit.
    # "AI governance" becomes two conditions: title ILIKE '%ai%' OR title ILIKE
    # '%governance%'.  This surfaces questions that share *any* word with the
    # query, not all of them — a broad net is better than a tight miss.
    words = [w for w in query.split() if w]
    word_filters = []
    for word in words:
        pattern = f"%{word}%"
        word_filters.append(Question.title.ilike(pattern))
        word_filters.append(Question.preview.ilike(pattern))

    closest_questions: list[FallbackQuestion] = []
    if word_filters:
        rows = (
            await session.execute(
                select(Question.id, Question.slug, Question.title, Question.preview, Domain.name)
                .join(Domain, Question.domain_id == Domain.id)
                .where(Question.published.is_(True), or_(*word_filters))
                .order_by(Question.title)
                .limit(FALLBACK_QUESTION_LIMIT)
            )
        ).all()
        closest_questions = [
            FallbackQuestion(
                id=str(r.id), slug=r.slug, title=r.title,
                preview=r.preview, domain=r.name,
            )
            for r in rows
        ]

    domain_rows = (
        await session.execute(
            select(Domain.name, Domain.slug)
            .order_by(Domain.name)
            .limit(FALLBACK_DOMAIN_LIMIT)
        )
    ).all()
    suggested_domains = [SuggestedDomain(name=r.name, slug=r.slug) for r in domain_rows]

    return SearchFallback(
        closest_questions=closest_questions,
        suggested_domains=suggested_domains,
    )
