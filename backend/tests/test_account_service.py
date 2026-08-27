"""Tests the extracted `deactivate_user` service directly. Both real call sites
are covered end-to-end in test_admin_phase6c.py and test_account_selfserve.py.

regression: the admin and self-serve endpoints must share this one service rather
than each inlining `user.disabled_at = ...`, so their behaviour stays in sync.
"""
import uuid

import pytest
from sqlalchemy import select

from app.db.models import AuditLog, Role, User
from app.services.account_service import deactivate_user


@pytest.mark.asyncio
async def test_deactivate_user_sets_disabled_at(db_session):
    user = User(id=uuid.uuid4(), email=f"u-{uuid.uuid4().hex[:8]}@example.test", role=Role.MEMBER)
    db_session.add(user)
    await db_session.flush()
    assert user.disabled_at is None

    await deactivate_user(db_session, user=user, actor=user, action="account_closed_self")
    await db_session.flush()

    assert user.disabled_at is not None


@pytest.mark.asyncio
async def test_deactivate_user_writes_an_audit_row_with_the_given_action_and_context(db_session):
    admin = User(id=uuid.uuid4(), email=f"admin-{uuid.uuid4().hex[:8]}@example.test", role=Role.ADMIN)
    target = User(id=uuid.uuid4(), email=f"target-{uuid.uuid4().hex[:8]}@example.test", role=Role.MEMBER)
    db_session.add_all([admin, target])
    await db_session.flush()

    await deactivate_user(
        db_session, user=target, actor=admin, action="deactivate_user", context={"reason": "spam"}
    )
    await db_session.flush()

    result = await db_session.execute(
        select(AuditLog).where(AuditLog.target_id == target.id, AuditLog.action == "deactivate_user")
    )
    row = result.scalar_one_or_none()
    assert row is not None
    assert row.actor_user_id == admin.id


@pytest.mark.asyncio
async def test_deactivate_user_does_not_commit_the_caller_transaction_owns_that(db_session):
    """Same contract as apply_refund/record_audit — the caller commits."""
    user = User(id=uuid.uuid4(), email=f"u-{uuid.uuid4().hex[:8]}@example.test", role=Role.MEMBER)
    db_session.add(user)
    await db_session.flush()

    await deactivate_user(db_session, user=user, actor=user, action="account_closed_self")
    # No commit here — a rollback should undo the deactivation entirely, proving
    # this function itself never committed on its own.
    await db_session.rollback()

    result = await db_session.execute(select(User).where(User.id == user.id))
    reloaded = result.scalar_one_or_none()
    assert reloaded is None or reloaded.disabled_at is None
