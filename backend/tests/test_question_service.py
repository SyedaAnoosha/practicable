"""Reads tests/fixtures/scoring_cases.json — the same file frontend/src/lib/
scoring.test.ts reads — and asserts app/services/question_service.py agrees with
every case (Non-negotiable #10). Not part of the gating suite: this is scoring
correctness, not an entitlement boundary.

week2_plan.md Phase 3 step 2/§57.6's explicit list is covered here: the v1 "one
exact + one far" bug, one exact + one adjacent, zero active filters, an unknown tag
value, and multi-select partial overlap — plus several more real-shape cases.
"""
import json
from pathlib import Path

import pytest

from app.services.question_service import (
    QuestionFilters,
    ScorableQuestion,
    TagRef,
    partition_questions,
    rank_relaxation_candidates,
    score_question,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "scoring_cases.json"
FIXTURE = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def _tag_lookup() -> dict[tuple[str, str], TagRef]:
    return {
        (t["dimension"], t["value"]): TagRef(
            dimension=t["dimension"], value=t["value"], display_label=t["display_label"], sort_order=t["sort_order"]
        )
        for t in FIXTURE["tag_values"]
    }


TAG_LOOKUP = _tag_lookup()


def _build_question(case_question: dict) -> ScorableQuestion:
    tags: dict[str, TagRef] = {}
    for dim, value in case_question.get("tags", {}).items():
        tag = TAG_LOOKUP.get((dim, value))
        # A question is allowed to carry a tag value not in the lookup (the "unknown
        # value" case) — construct a standalone TagRef so scoring still sees SOME
        # actual value to compare against (mirrors a real row referencing a
        # tag_values id that still exists but wasn't in the filter's own scale).
        tags[dim] = tag or TagRef(dimension=dim, value=value, display_label=value, sort_order=-999)
    traits = tuple(
        TAG_LOOKUP.get(("leadership_traits", v))
        or TagRef(dimension="leadership_traits", value=v, display_label=v, sort_order=-999)
        for v in case_question.get("leadership_traits", [])
    )
    return ScorableQuestion(id="q1", domain_slug=case_question["domain"], tags=tags, leadership_traits=traits)


def _build_filters(case_filters: dict) -> QuestionFilters:
    return QuestionFilters(
        domain=case_filters.get("domain"),
        effort=case_filters.get("effort"),
        duration=case_filters.get("duration"),
        cost=case_filters.get("cost"),
        roi_horizon=case_filters.get("roi_horizon"),
        regulator_pressure=case_filters.get("regulator_pressure"),
        tier=tuple(case_filters.get("tier", [])),
        leadership_traits=tuple(case_filters.get("leadership_traits", [])),
    )


@pytest.mark.parametrize("case", FIXTURE["cases"], ids=[c["name"] for c in FIXTURE["cases"]])
def test_scoring_case(case: dict):
    question = _build_question(case["question"])
    filters = _build_filters(case["filters"])
    result = score_question(question, filters, TAG_LOOKUP)
    expected = case["expected"]

    assert result.score == expected["score"]
    assert result.active_constraints == expected["active_constraints"]
    assert result.exact_count == expected["exact_count"]
    assert result.is_exact == expected["is_exact"]
    assert [{"dimension": m.dimension, "distance": m.distance} for m in result.misses] == expected["misses"]


# ── Partition-level behaviour — not fixture-driven, since it's about the LIST of
# questions and their ordering, not one question's score in isolation. §57.6's
# "zero active filters -> everything exact, original order preserved" specifically.


def _q(id_: str, domain: str, **tags: str) -> ScorableQuestion:
    resolved = {dim: TAG_LOOKUP[(dim, value)] for dim, value in tags.items()}
    return ScorableQuestion(id=id_, domain_slug=domain, tags=resolved)


def test_partition_with_no_filters_returns_everything_as_exact_in_original_order():
    questions = [_q("a", "risk"), _q("b", "risk"), _q("c", "risk")]
    exact, close, has_filters = partition_questions(questions, QuestionFilters(), TAG_LOOKUP)
    assert has_filters is False
    assert close == []
    assert [s.question.id for s in exact] == ["a", "b", "c"]
    assert all(s.is_exact for s in exact)


def test_partition_splits_exact_and_close_and_drops_zero_score():
    questions = [
        _q("exact", "risk", effort="quick"),
        _q("close", "risk", effort="moderate"),  # adjacent -> close
        _q("far", "risk", effort="transformation"),  # far -> score 0, dropped entirely
    ]
    filters = QuestionFilters(effort="quick")
    exact, close, has_filters = partition_questions(questions, filters, TAG_LOOKUP)
    assert has_filters is True
    assert [s.question.id for s in exact] == ["exact"]
    assert [s.question.id for s in close] == ["close"]


def test_partition_sorts_by_score_descending_and_preserves_input_order_on_ties():
    # Both tagged "moderate" against a "quick" filter -> identical (close) scores;
    # stable sort keeps them in the order they were passed in (the caller's own
    # tie-break, e.g. title order — this module deliberately has no opinion on it).
    questions = [_q("second", "risk", effort="moderate"), _q("first", "risk", effort="moderate")]
    filters = QuestionFilters(effort="quick")
    _, close, _ = partition_questions(questions, filters, TAG_LOOKUP)
    assert [s.question.id for s in close] == ["second", "first"]


def test_rank_relaxation_candidates_orders_most_restrictive_first():
    # duration=under_2_weeks admits only "a"; cost=low admits "a" and "b" — duration
    # is the tighter constraint and must be suggested first.
    questions = [
        _q("a", "risk", duration="under_2_weeks", cost="low"),
        _q("b", "risk", duration="over_6_months", cost="low"),
        _q("c", "risk", duration="over_6_months", cost="high"),
    ]
    filters = QuestionFilters(duration="under_2_weeks", cost="low")
    ranked = rank_relaxation_candidates(questions, filters)
    assert ranked[0] == "duration"
