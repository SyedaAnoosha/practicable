"""Content freshness (#16) and template version notifications (#6).

Two features that share one trigger — an admin editing a template — and one rule:
**unknown is not stale**. A template nobody has reviewed and a template reviewed
fourteen months ago need different actions from the admin, so the API reports them as
different states rather than collapsing both into "needs attention".

The notification half is tested for what it must NOT do as carefully as what it must:
a version that did not actually change must not notify, a refunded owner must not be
notified, and a reader who opted out of product updates must not be notified on either
channel. An opt-out honoured only on email while an in-app row appears anyway is not an
opt-out.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.db.models import Entitlement, GrantedVia, Notification, Template
from app.services.freshness_service import STALE_AFTER, compute_freshness


# ── The computation itself ───────────────────────────────────────────────────────

NOW = datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc)


def test_never_reviewed_is_unknown_not_stale():
    """The distinction the whole feature turns on. A NULL review date is an absence of
    information, not evidence of age — reporting it as `stale` would tell the admin the
    content was reviewed and has since aged, which is a different (and false) claim."""
    result = compute_freshness(None, now=NOW)
    assert result.status == "unknown"
    assert result.status != "stale"
    assert result.message is not None, "an unknown-freshness row still needs a warning to show"


def test_recently_reviewed_is_fresh_and_warns_about_nothing():
    result = compute_freshness(NOW - timedelta(days=30), now=NOW)
    assert result.status == "fresh"
    assert result.message is None, (
        "a fresh row must carry no warning — a badge that renders on every row is a "
        "badge nobody reads"
    )


def test_older_than_the_threshold_is_stale():
    result = compute_freshness(NOW - STALE_AFTER - timedelta(days=1), now=NOW)
    assert result.status == "stale"
    assert result.message is not None


def test_exactly_at_the_threshold_is_still_fresh():
    """The boundary is inclusive: 365 days to the second has not yet exceeded 12 months.
    Pinned so a later refactor cannot flip it silently — the exact day matters to nobody,
    but a test asserting *some* defined behaviour stops the boundary drifting unnoticed."""
    assert compute_freshness(NOW - STALE_AFTER, now=NOW).status == "fresh"


def test_a_naive_timestamp_does_not_explode():
    """Postgres returns aware datetimes for a timestamptz column, but a row written by a
    test factory or an older fixture can carry a naive one, and `aware - naive` raises
    TypeError. That would 500 the entire admin template list over a display-only field,
    so naive input is read as UTC instead."""
    naive = (NOW - timedelta(days=400)).replace(tzinfo=None)
    assert compute_freshness(naive, now=NOW).status == "stale"


# ── The admin surface ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_admin_template_list_reports_all_three_states(
    admin_client, content_graph, db_session
):
    """The list is where an admin notices staleness, so the state has to arrive with the
    rows rather than requiring a click into each one."""
    content_graph.paid_template.last_reviewed_at = datetime.now(timezone.utc) - timedelta(days=800)
    content_graph.free_template.last_reviewed_at = datetime.now(timezone.utc)
    await db_session.flush()

    resp = await admin_client.get("/admin/templates")
    assert resp.status_code == 200, resp.text
    by_id = {row["id"]: row for row in resp.json()}

    stale = by_id[str(content_graph.paid_template.id)]
    assert stale["freshness_status"] == "stale"
    assert stale["freshness_warning"] is not None

    fresh = by_id[str(content_graph.free_template.id)]
    assert fresh["freshness_status"] == "fresh"
    assert fresh["freshness_warning"] is None

    unknown = by_id[str(content_graph.pack_pdf.id)]  # never given a review date
    assert unknown["freshness_status"] == "unknown"


@pytest.mark.asyncio
async def test_mark_reviewed_stamps_now_and_clears_the_warning(
    admin_client, content_graph, db_session, asserts_commit
):
    """The one-click answer to a warning, and it must actually persist — an uncommitted
    stamp would clear the badge in the response and leave it stale in the database."""
    template = content_graph.paid_template
    template.last_reviewed_at = datetime.now(timezone.utc) - timedelta(days=800)
    await db_session.flush()

    with asserts_commit():
        resp = await admin_client.post(f"/admin/templates/{template.id}/mark-reviewed")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["freshness_status"] == "fresh"
    assert body["freshness_warning"] is None
    assert body["last_reviewed_at"] is not None


@pytest.mark.asyncio
async def test_mark_reviewed_writes_an_audit_row(admin_client, content_graph, db_session):
    """Every admin mutation is audited — this one changes what buyers are told about how
    current the artefact is, so it is not an exception."""
    from app.db.models import AuditLog

    resp = await admin_client.post(
        f"/admin/templates/{content_graph.paid_template.id}/mark-reviewed"
    )
    assert resp.status_code == 200, resp.text

    row = (
        await db_session.execute(
            select(AuditLog)
            .where(AuditLog.action == "mark_template_reviewed")
            .where(AuditLog.target_id == content_graph.paid_template.id)
        )
    ).scalar_one_or_none()
    assert row is not None, "marking content reviewed was not audited"


@pytest.mark.asyncio
async def test_mark_reviewed_does_not_notify_owners(
    admin_client, content_graph, entitled_user, grant, db_session
):
    """Re-reading a template and finding it still correct is not a new version. Notifying
    owners for it would train them to ignore the notice that matters."""
    await grant(entitled_user, content_graph.template_product)

    resp = await admin_client.post(
        f"/admin/templates/{content_graph.paid_template.id}/mark-reviewed"
    )
    assert resp.status_code == 200, resp.text

    count = len(
        (
            await db_session.execute(
                select(Notification).where(Notification.user_id == entitled_user.id)
            )
        ).scalars().all()
    )
    assert count == 0, "marking reviewed sent a version-update notification"


@pytest.mark.asyncio
async def test_courses_carry_freshness_too(admin_client, content_graph, db_session):
    """#16 covers the catalogue, not half of it. A course narrating a regulation goes
    stale the moment the regulation moves."""
    content_graph.course.last_reviewed_at = datetime.now(timezone.utc) - timedelta(days=900)
    await db_session.flush()

    resp = await admin_client.get("/admin/courses")
    assert resp.status_code == 200, resp.text
    row = next(r for r in resp.json() if r["id"] == str(content_graph.course.id))
    assert row["freshness_status"] == "stale"


@pytest.mark.asyncio
async def test_course_mark_reviewed_persists(
    admin_client, content_graph, asserts_commit
):
    with asserts_commit():
        resp = await admin_client.post(
            f"/admin/courses/{content_graph.course.id}/mark-reviewed"
        )
    assert resp.status_code == 200, resp.text
    assert resp.json()["freshness_status"] == "fresh"


# ── #6: version-bump notifications ───────────────────────────────────────────────


def _template_put_body(template: Template, **overrides) -> dict:
    """The editor sends every field on every save, so the tests do too — that is exactly
    the shape that makes an unguarded version check notify on unrelated edits."""
    body = {
        "title": template.title,
        "description": template.description,
        "is_free": template.is_free,
        "page_count": template.page_count,
        "sheet_count": template.sheet_count,
        "is_editable": template.is_editable,
        "has_macros": template.has_macros,
        "min_office_version": template.min_office_version,
        "version": template.version,
        "last_reviewed_at": (
            template.last_reviewed_at.isoformat() if template.last_reviewed_at else None
        ),
    }
    body.update(overrides)
    return body


@pytest.mark.asyncio
async def test_version_bump_notifies_an_active_owner(
    admin_client, content_graph, entitled_user, grant, db_session
):
    """The feature itself: an owner of the template learns the version moved."""
    await grant(entitled_user, content_graph.template_product)
    template = content_graph.paid_template
    template.version = "1.0"
    await db_session.flush()

    with patch(
        "app.services.notification_service.send_notification_email",
        new=AsyncMock(return_value=True),
    ):
        resp = await admin_client.put(
            f"/admin/templates/{template.id}",
            json=_template_put_body(template, version="2.0"),
        )

    assert resp.status_code == 200, resp.text
    note = (
        await db_session.execute(
            select(Notification).where(Notification.user_id == entitled_user.id)
        )
    ).scalar_one_or_none()
    assert note is not None, "an owner was not told the version moved"
    assert note.entity_id == template.id
    assert note.meta["old_version"] == "1.0"
    assert note.meta["new_version"] == "2.0"


@pytest.mark.asyncio
async def test_an_unchanged_version_notifies_nobody(
    admin_client, content_graph, entitled_user, grant, db_session
):
    """The editor sends `version` on every save. Without the equality half of the guard,
    fixing a typo in the description would email every owner."""
    await grant(entitled_user, content_graph.template_product)
    template = content_graph.paid_template
    template.version = "1.0"
    await db_session.flush()

    resp = await admin_client.put(
        f"/admin/templates/{template.id}",
        json=_template_put_body(template, version="1.0", description="Reworded."),
    )
    assert resp.status_code == 200, resp.text

    rows = (
        await db_session.execute(
            select(Notification).where(Notification.user_id == entitled_user.id)
        )
    ).scalars().all()
    assert rows == [], "an unrelated edit notified owners"


@pytest.mark.asyncio
async def test_opted_out_owner_gets_neither_a_row_nor_an_email(
    admin_client, content_graph, entitled_user, grant, db_session
):
    """`notify_product_updates=False` means no product-update notice, on any channel.

    A version bump is not transactional — nothing has happened to this reader's money or
    account — so the opt-out applies to every channel. Suppressing only the email while
    writing the in-app row anyway would honour the opt-out on the channel that is
    easiest to check.
    """
    entitled_user.notify_product_updates = False
    await grant(entitled_user, content_graph.template_product)
    template = content_graph.paid_template
    template.version = "1.0"
    await db_session.flush()

    with patch(
        "app.services.notification_service.send_notification_email",
        new=AsyncMock(return_value=True),
    ) as mail:
        resp = await admin_client.put(
            f"/admin/templates/{template.id}",
            json=_template_put_body(template, version="3.0"),
        )

    assert resp.status_code == 200, resp.text
    rows = (
        await db_session.execute(
            select(Notification).where(Notification.user_id == entitled_user.id)
        )
    ).scalars().all()
    assert rows == [], "an opted-out reader still got an in-app product-update notice"
    mail.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_revoked_owner_is_not_notified(
    admin_client, content_graph, entitled_user, grant, db_session
):
    """A refund revokes rather than deletes, so the row survives — `revoked_at IS NULL`
    is what "owns it" means. A refunded buyer no longer owns the template."""
    ent = await grant(entitled_user, content_graph.template_product)
    ent.revoked_at = datetime.now(timezone.utc)
    ent.revoked_reason = "refund"
    template = content_graph.paid_template
    template.version = "1.0"
    await db_session.flush()

    resp = await admin_client.put(
        f"/admin/templates/{template.id}",
        json=_template_put_body(template, version="4.0"),
    )
    assert resp.status_code == 200, resp.text

    rows = (
        await db_session.execute(
            select(Notification).where(Notification.user_id == entitled_user.id)
        )
    ).scalars().all()
    assert rows == [], "a refunded buyer was notified about a version they no longer own"


@pytest.mark.asyncio
async def test_a_failing_transport_does_not_fail_the_admin_save(
    admin_client, content_graph, entitled_user, grant, db_session
):
    """email_service's contract: a failed send must never undo committed work. The version
    change is the admin's; Mailjet being unreachable is not their problem to see as a 500.
    """
    await grant(entitled_user, content_graph.template_product)
    template = content_graph.paid_template
    template.version = "1.0"
    await db_session.flush()

    with patch(
        "app.services.notification_service.send_notification_email",
        new=AsyncMock(side_effect=RuntimeError("mailjet is down")),
    ):
        resp = await admin_client.put(
            f"/admin/templates/{template.id}",
            json=_template_put_body(template, version="5.0"),
        )

    assert resp.status_code == 200, resp.text
    assert resp.json()["version"] == "5.0"

    note = (
        await db_session.execute(
            select(Notification).where(Notification.user_id == entitled_user.id)
        )
    ).scalar_one_or_none()
    assert note is not None, "the in-app notice should survive an email failure"
    assert note.email_delivered is False
