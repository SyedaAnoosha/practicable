"""Taxonomy parity: every taxonomy value hard-coded in the frontend must exist in
`tag_values`. week4_plan.md W4-R9 item 2 · handover.md §1 (the dead-chips incident) —
every quick-filter chip on `/questions` matched zero questions for three days because
nothing asserted this. This test reads the frontend source directly (not a hand-copied
literal) so it can't silently drift out of sync with the file it's checking.

Seen red: this failed against the pre-fix `QuestionsCatalogue.tsx` the incident
describes (a chip dimension/value pair not present in `tag_values`), and fails again if
you change one of `QUICK_FILTERS`' values below to something not seeded.
"""
import re
from pathlib import Path

import pytest
from sqlalchemy import select

from app.db.models import TagValue

FRONTEND_CATALOGUE = (
    Path(__file__).resolve().parents[2] / "frontend" / "src" / "pages" / "QuestionsCatalogue.tsx"
)


def _extract_quick_filters(source: str) -> list[tuple[str, str]]:
    """Pulls every {dimension, values} pair out of the QUICK_FILTERS array literal.

    Deliberately a narrow regex over the literal, not a TS parser — this file has no JS
    runtime available to it. It is intentionally strict: if QUICK_FILTERS' shape changes
    enough that this stops matching, the test errors instead of silently checking zero
    pairs, which is caught by `test_extraction_finds_at_least_one_filter` below.
    """
    match = re.search(r"const QUICK_FILTERS[^=]*=\s*\[(.*?)\n\]", source, re.DOTALL)
    assert match, "QUICK_FILTERS array not found in QuestionsCatalogue.tsx — has it been renamed or restructured?"
    body = match.group(1)

    pairs: list[tuple[str, str]] = []
    for entry in re.finditer(r"dimension:\s*'([^']+)',\s*values:\s*\[([^\]]*)\]", body):
        dimension = entry.group(1)
        values = re.findall(r"'([^']+)'", entry.group(2))
        for value in values:
            pairs.append((dimension, value))
    return pairs


def _extract_dimension_labels(source: str) -> list[str]:
    """Every dimension key named in DIMENSION_LABELS — catches a dimension being
    renamed on one side (e.g. `roi_horizon` → `payback`) and not the other, not just a
    quick-filter value drifting."""
    match = re.search(r"const DIMENSION_LABELS[^=]*=\s*\{(.*?)\n\}", source, re.DOTALL)
    assert match, "DIMENSION_LABELS not found in QuestionsCatalogue.tsx"
    return re.findall(r"^\s*(\w+):\s*'", match.group(1), re.MULTILINE)


@pytest.fixture(scope="module")
def frontend_source() -> str:
    assert FRONTEND_CATALOGUE.exists(), f"expected {FRONTEND_CATALOGUE} to exist"
    return FRONTEND_CATALOGUE.read_text(encoding="utf-8")


def test_extraction_finds_at_least_one_filter(frontend_source: str):
    """Guards the regex itself — a passing parity test that silently extracted zero
    pairs would be worse than no test at all."""
    assert len(_extract_quick_filters(frontend_source)) >= 4


@pytest.mark.asyncio
async def test_quick_filter_chips_match_real_tag_values(frontend_source: str, db_session):
    """Every (dimension, value) pair QUICK_FILTERS can toggle on `/questions` must be a
    real row in `tag_values` — otherwise the chip is live in the UI and silently matches
    nothing, exactly as `handover.md` §1 describes."""
    pairs = _extract_quick_filters(frontend_source)

    result = await db_session.execute(select(TagValue.tag_dimension, TagValue.value))
    real_pairs = set(result.all())

    missing = [pair for pair in pairs if pair not in real_pairs]
    assert not missing, (
        f"Quick-filter chip(s) reference (dimension, value) pairs absent from tag_values: {missing}. "
        "Every chip in QUICK_FILTERS must match a seeded taxonomy row or it silently matches zero questions."
    )


@pytest.mark.asyncio
async def test_dimension_labels_match_real_tag_dimensions(frontend_source: str, db_session):
    """Every dimension named in DIMENSION_LABELS must have at least one row in
    `tag_values` — catches a dimension renamed on one side only."""
    dimensions = _extract_dimension_labels(frontend_source)
    assert dimensions, "DIMENSION_LABELS extraction found no keys — regex likely broken"

    result = await db_session.execute(select(TagValue.tag_dimension).distinct())
    real_dimensions = {row[0] for row in result.all()}

    missing = [d for d in dimensions if d not in real_dimensions]
    assert not missing, (
        f"Dimension(s) named in DIMENSION_LABELS have no rows in tag_values at all: {missing}. "
        "Either the dimension was renamed in tag_values and not in the frontend, or vice versa."
    )
