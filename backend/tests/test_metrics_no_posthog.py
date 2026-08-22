"""The analytics page depends on nothing external — proven, not reasoned (ledger row 44g).

W4-R10's 2026-08-17 amendment is explicit: *"The page depends on nothing external. Every
one of the five metrics is answerable from Postgres alone, and `/admin/metrics` renders
correctly with no PostHog project key, no `phx_` query key"* — and its acceptance says
**"Proven by test, not by reasoning — this is the whole point of the amendment."**

Row 44g stayed open because no such test existed. The situation is now actually stronger
than the row asks for: `app/integrations/posthog_client.py` was deleted outright, so
there is no code path left that *could* read a key. That is easy to regress silently,
though — one well-meaning "let's enrich the metrics page" import would reintroduce the
dependency the amendment removed, and every existing test would still pass.

So this asserts the absence itself. It is a structural test rather than a behavioural one
on purpose: behaviour cannot distinguish "no key needed" from "a key happens to be set in
this environment", which is exactly the trap the amendment was written against.
"""
import io
import tokenize
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
APP_ROOT = BACKEND_ROOT / "app"

# Matched case-insensitively. `phx_` is PostHog's own query-key prefix, which the
# amendment names by hand.
POSTHOG_MARKERS = ("posthog", "phx_")


def _python_sources():
    for path in APP_ROOT.rglob("*.py"):
        if "__pycache__" in path.parts:
            continue
        yield path


def _code_text(source: str) -> str:
    """Source with comments and string literals stripped, leaving executable code.

    Prose is deliberately exempt rather than banned: `metrics.py`'s own module docstring
    says *"No PostHog dependency"*, which is a statement of the very property this file
    exists to protect. A check that failed on the sentence describing the rule would push
    the next person to delete the explanation rather than keep the rule. Only code counts.
    """
    skip = {tokenize.COMMENT, tokenize.STRING, tokenize.NL, tokenize.NEWLINE, tokenize.INDENT}
    try:
        return " ".join(
            tok.string
            for tok in tokenize.generate_tokens(io.StringIO(source).readline)
            if tok.type not in skip
        )
    except Exception:
        # An unparseable file is not something this test should quietly mask.
        return source


def test_no_backend_code_references_posthog():
    """No server code imports, reads or names PostHog. Comments and docstrings exempt."""
    offenders = []
    for path in _python_sources():
        code = _code_text(path.read_text(encoding="utf-8", errors="replace")).lower()
        for marker in POSTHOG_MARKERS:
            if marker in code:
                offenders.append(f"{path.relative_to(BACKEND_ROOT)} contains {marker!r} in code")
    assert not offenders, (
        "W4-R10's amendment requires the metrics page to depend on nothing external:\n  "
        + "\n  ".join(offenders)
    )


def test_the_posthog_client_module_is_gone():
    """Named explicitly so its reintroduction is a decision, not an accident."""
    assert not (APP_ROOT / "integrations" / "posthog_client.py").exists()


def test_no_posthog_setting_exists_on_config():
    """A settings field is how the dependency would creep back in first — it would look
    harmless right up until a metric started reading it."""
    from app.core.config import settings

    leaked = [name for name in type(settings).model_fields if "posthog" in name.lower()]
    assert not leaked, f"PostHog settings reintroduced: {leaked}"


@pytest.mark.asyncio
async def test_metrics_endpoint_answers_with_no_external_service(admin_client):
    """The behavioural half: the page returns every field it promises, computed from
    Postgres alone."""
    resp = await admin_client.get("/admin/metrics")
    assert resp.status_code == 200, resp.text
    body = resp.json()

    names = {m["name"] for m in body["metrics"]}
    assert {"second_purchase_rate", "free_to_paid_conversion", "refund_rate"} & names, names

    # Top-level JSON keys are camelCase (the Pydantic alias_generator); the metric
    # `name` values inside `metrics` stay snake_case. Both are asserted here, and the
    # two casings are deliberate, not a drift.
    for field in (
        "revenueGrossCents",
        "revenueRefundedCents",
        "revenueNetCents",
        "enrollmentSplits",
        "productRankings",
        "downloadLinksIssued",
        "courseEnrollmentRankings",
        "recommendationClicks",
    ):
        assert field in body, f"{field} missing from /admin/metrics"
