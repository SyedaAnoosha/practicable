"""Non-negotiable #10's discipline, applied to the pack's working order.

Two implementations of one rule — `scripts/build_domain_pack.py` (typesets the PDF)
and `app/api/v1/content/packs.py` (serves the same order to the product page) — will
drift exactly like the scoring model would without a shared check. There's no shared
fixture file here the way scoring has `scoring_cases.json`, because both sides sort by
the same three `tag_values` codes rather than consuming an external dataset; the check
that matters is that those code tables, and the tuple they build, stay identical.
"""

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.api.v1.content import packs  # noqa: E402
from scripts import build_domain_pack as pdf  # noqa: E402


# The two modules key the SAME rule on different representations of the same values:
# `packs.py` sorts `tag_values.value` codes (queried from Postgres, seeded by
# db/seed/001), `build_domain_pack.py` sorts the human-readable strings straight out of
# questions.json. This mapping is that seed's own code<->label pairing — the fixed
# point both sides are required to agree with, not an assumption invented here.
_TIER_LABELS = {"f": "Foundational", "t": "Tactical", "s": "Strategic", "x": "Transformational"}
_REG_LABELS = {"h": "High", "m": "Moderate", "l": "Low", "n": "None"}
_EFFORT_LABELS = {"quick": "Quick Win", "mod": "Moderate", "project": "Project", "trans": "Transformation"}


def test_working_order_matches_the_pdf_builder():
    """The two rankings must agree on the RELATIVE ORDER of every value, not share a
    dict shape — they can't, since one is keyed by DB code and the other by the label
    questions.json uses. What must never drift is which value ranks where; a code
    either module forgets to add would silently sort last on one side and not the
    other, so this also asserts both sides cover every label in the mapping above."""
    for db_order, pdf_order, labels in (
        (packs._TIER_ORDER, pdf.TIER_ORDER, _TIER_LABELS),
        (packs._REG_ORDER, pdf.REG_ORDER, _REG_LABELS),
        (packs._EFFORT_ORDER, pdf.EFFORT_ORDER, _EFFORT_LABELS),
    ):
        assert set(db_order) == set(labels), "a DB code exists that this mapping doesn't cover"
        assert set(pdf_order) == set(labels.values()), "a JSON label exists that this mapping doesn't cover"
        for code, label in labels.items():
            assert db_order[code] == pdf_order[label], f"{code!r}/{label!r} rank at different positions"


def test_working_order_ranks_foundations_before_ambition():
    """The rule stated on the PDF cover and the pack page, exercised end to end: a
    Foundational/High-pressure/Quick-Win question outranks a Transformational/
    None-pressure/Project one, regardless of which was authored first."""

    class FakeTag:
        def __init__(self, value):
            self.value = value

    class FakeQuestion:
        def __init__(self, slug):
            self.slug = slug

    early = (FakeQuestion("a"), FakeTag("f"), FakeTag("quick"), FakeTag("h"), "Risk")
    late = (FakeQuestion("z"), FakeTag("x"), FakeTag("project"), FakeTag("n"), "Risk")

    def key(row):
        _q, t, e, r, _d = row
        return (
            packs._TIER_ORDER.get(t.value if t else None, 99),
            packs._REG_ORDER.get(r.value if r else None, 99),
            packs._EFFORT_ORDER.get(e.value if e else None, 99),
            _q.slug,
        )

    assert sorted([late, early], key=key) == [early, late]
