"""Discovery scoring.

A strict AND across filters can return nothing, so filtering is a RANKING, not a gate:
each active constraint contributes graded credit — 2 points for an exact match, 1 for
the adjacent value on that dimension's ordinal scale, 0 beyond that — and a question is
"exact" only when every active constraint scored the full 2 points.

This file and `frontend/src/lib/scoring.ts` implement the identical rule in two
languages. Neither hard-codes the ordinal scale; both read `sort_order` from the tag
data they're handed, so the owner can reorder or extend a scale from the DB with no
deploy. A shared fixture (`tests/fixtures/scoring_cases.json`) keeps the two from
silently diverging.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Union

EXACT_POINTS = 2
CLOSE_POINTS = 1

# Single-valued, ordinally scaled dimensions — a question has at most one tag on
# each, and "adjacent" is a meaningful idea because the scale has an order.
ORDINAL_DIMENSIONS = ("effort", "duration", "cost", "roi_horizon", "regulator_pressure")

# Multi-valued, categorical (overlap, not distance) dimensions — `tier` is single-
# valued per question but the filter can name several acceptable values (a checkbox
# group), so it's scored the same way as `leadership_traits`.
MULTI_DIMENSIONS = ("tier", "leadership_traits")


@dataclass(frozen=True)
class TagRef:
    """The scoring-relevant slice of a tag_values row. `sort_order` is this value's
    position on its dimension's ordinal scale — the only thing distance is computed
    from, never a hard-coded rank."""

    dimension: str
    value: str
    display_label: str
    sort_order: int


@dataclass(frozen=True)
class ScorableQuestion:
    """Everything `score_question` needs about one question — deliberately not the ORM
    row or an API model, so this module can be unit-tested with plain data."""

    id: str
    domain_slug: str
    # One TagRef per ordinal/tier dimension, keyed by dimension name.
    tags: dict[str, TagRef]
    # The one genuinely multi-valued per-question dimension.
    leadership_traits: tuple[TagRef, ...] = ()


@dataclass(frozen=True)
class QuestionFilters:
    domain: Optional[str] = None
    effort: Optional[str] = None
    duration: Optional[str] = None
    cost: Optional[str] = None
    roi_horizon: Optional[str] = None
    regulator_pressure: Optional[str] = None
    tier: tuple[str, ...] = ()
    leadership_traits: tuple[str, ...] = ()

    def active_count(self) -> int:
        count = 1 if self.domain else 0
        for dim in ORDINAL_DIMENSIONS:
            if getattr(self, dim):
                count += 1
        if self.tier:
            count += 1
        if self.leadership_traits:
            count += 1
        return count


@dataclass(frozen=True)
class Miss:
    """One constraint this question did not exactly satisfy — what the close-match
    badge (DESIGN.md §19.3) is built from. `distance` is `1` for the adjacent case,
    `None` for "far or unknown" (both score 0 — the badge doesn't need to tell them
    apart, only exact-vs-not does)."""

    dimension: str
    requested: Union[str, tuple[str, ...]]  # str for ordinal/domain dimensions, tuple for multi-select
    actual: Optional[Union[str, tuple[str, ...]]]
    distance: Optional[int]


@dataclass(frozen=True)
class ScoredQuestion:
    question: ScorableQuestion
    score: int
    active_constraints: int
    exact_count: int
    is_exact: bool
    misses: list[Miss]


def _ordinal_distance(requested_tag: Optional[TagRef], actual_tag: Optional[TagRef]) -> Optional[int]:
    """`None` whenever either side has no tag on this dimension — no credit, never a
    crash."""
    if requested_tag is None or actual_tag is None:
        return None
    d = abs(requested_tag.sort_order - actual_tag.sort_order)
    return d if d <= 1 else None


def score_question(
    question: ScorableQuestion,
    filters: QuestionFilters,
    tag_lookup: dict[tuple[str, str], TagRef],
) -> ScoredQuestion:
    """`tag_lookup` resolves a filter's requested (dimension, value) pair to its
    TagRef — the caller builds it once from every tag_values row, not per call."""
    score = 0
    active_constraints = 0
    exact_count = 0
    misses: list[Miss] = []

    for dim in ORDINAL_DIMENSIONS:
        requested_value = getattr(filters, dim)
        if not requested_value:
            continue
        active_constraints += 1
        requested_tag = tag_lookup.get((dim, requested_value))
        actual_tag = question.tags.get(dim)
        distance = _ordinal_distance(requested_tag, actual_tag)
        if distance == 0:
            exact_count += 1
            score += EXACT_POINTS
        elif distance == 1:
            score += CLOSE_POINTS
            misses.append(Miss(dim, requested_value, actual_tag.value if actual_tag else None, 1))
        else:
            misses.append(Miss(dim, requested_value, actual_tag.value if actual_tag else None, None))

    if filters.domain:
        active_constraints += 1
        if question.domain_slug == filters.domain:
            exact_count += 1
            score += EXACT_POINTS
        else:
            misses.append(Miss("domain", filters.domain, question.domain_slug, None))

    for dim in MULTI_DIMENSIONS:
        requested = getattr(filters, dim)
        if not requested:
            continue
        active_constraints += 1
        if dim == "tier":
            tier_tag = question.tags.get("tier")
            actual = [tier_tag.value] if tier_tag else []
        else:
            actual = [t.value for t in question.leadership_traits]
        overlap = [v for v in requested if v in actual]
        if len(overlap) == len(requested):
            exact_count += 1
            score += EXACT_POINTS
        elif overlap:
            score += CLOSE_POINTS
            misses.append(Miss(dim, requested, tuple(actual), 1))
        else:
            misses.append(Miss(dim, requested, tuple(actual), None))

    return ScoredQuestion(
        question=question,
        score=score,
        active_constraints=active_constraints,
        exact_count=exact_count,
        # exact means every active constraint was satisfied exactly, not merely that
        # nothing landed in the adjacent bucket.
        is_exact=active_constraints > 0 and exact_count == active_constraints,
        misses=misses,
    )


def partition_questions(
    questions: list[ScorableQuestion],
    filters: QuestionFilters,
    tag_lookup: dict[tuple[str, str], TagRef],
) -> tuple[list[ScoredQuestion], list[ScoredQuestion], bool]:
    """Returns `(exact, close, has_filters)`, both sorted by score descending.

    `questions` should already be in the caller's desired tie-break order (title,
    typically) — Python's sort is stable, so equal-score rows keep that order rather
    than this function needing its own secondary key.
    """
    has_filters = filters.active_count() > 0

    if not has_filters:
        neutral = [
            ScoredQuestion(question=q, score=0, active_constraints=0, exact_count=0, is_exact=True, misses=[])
            for q in questions
        ]
        return neutral, [], False

    scored = [score_question(q, filters, tag_lookup) for q in questions]
    exact = sorted((s for s in scored if s.is_exact), key=lambda s: -s.score)
    # A question scoring zero shares nothing with the query and is not returned at all.
    close = sorted((s for s in scored if not s.is_exact and s.score > 0), key=lambda s: -s.score)
    return exact, close, True


def rank_relaxation_candidates(
    questions: list[ScorableQuestion],
    filters: QuestionFilters,
) -> list[str]:
    """Zero-result recovery: rank the active filter dimensions by how few questions
    each admits on its own, most restrictive first. Computed, not hard-coded, so it
    reflects how the taxonomy actually behaves rather than a guess that goes stale.
    """
    active_dims: list[str] = []
    if filters.domain:
        active_dims.append("domain")
    for dim in ORDINAL_DIMENSIONS:
        if getattr(filters, dim):
            active_dims.append(dim)
    if filters.tier:
        active_dims.append("tier")
    if filters.leadership_traits:
        active_dims.append("leadership_traits")

    def admits(dim: str) -> int:
        if dim == "domain":
            return sum(1 for q in questions if q.domain_slug == filters.domain)
        if dim == "tier":
            return sum(1 for q in questions if (t := q.tags.get("tier")) and t.value in filters.tier)
        if dim == "leadership_traits":
            wanted = set(filters.leadership_traits)
            return sum(1 for q in questions if wanted & {t.value for t in q.leadership_traits})
        requested_value = getattr(filters, dim)
        return sum(1 for q in questions if (t := q.tags.get(dim)) and t.value == requested_value)

    return sorted(active_dims, key=admits)
