"""Notification service for template version updates (#6).

Handles creating notifications for users when templates they own have new versions,
and manages email delivery of notifications.
"""
import logging
from datetime import datetime, timezone
from typing import Optional
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Notification, User, Entitlement, ProductContent, Template
from app.services.email_service import send_notification_email

logger = logging.getLogger(__name__)


async def create_template_version_notification(
    session: AsyncSession,
    template_id: uuid.UUID,
    old_version: Optional[str],
    new_version: str,
) -> int:
    """Create notifications for all users who own this template when version changes.

    Returns the number of notifications created.
    """
    # Find all users who have an entitlement to this template
    # (via a product that includes this template)
    template_content = await session.execute(
        select(ProductContent.product_id)
        .where(ProductContent.content_type == "template")
        .where(ProductContent.content_id == template_id)
    )
    product_ids = [row[0] for row in template_content.all()]

    if not product_ids:
        # Template is not linked to any product (e.g., free template)
        return 0

    # Get template details for the notification message
    template = await session.execute(
        select(Template).where(Template.id == template_id)
    )
    template = template.scalar_one_or_none()
    if not template:
        return 0

    # The owners of this template: an active (never-revoked) entitlement to any product
    # carrying it. Selecting the User rows rather than bare ids because the opt-out gate
    # below needs each owner's own preference, and a second query per user to fetch it
    # would be one round trip per owner on what is already a fan-out.
    #
    # `revoked_at IS NULL` is what "active" means here (entitlement.py's own rule: a
    # refund revokes rather than deletes). A refunded buyer no longer owns the template
    # and must not be told its version moved.
    owners = (
        await session.execute(
            select(User)
            .join(Entitlement, Entitlement.user_id == User.id)
            .where(Entitlement.product_id.in_(product_ids))
            .where(Entitlement.revoked_at.is_(None))
            .distinct()
        )
    ).scalars().all()

    if not owners:
        return 0

    # A version bump is a product update, NOT transactional mail — nothing has happened
    # to this reader's money or account, so the product-updates preference gates it.
    # The gate is applied to the *notification row itself*, not just the email:
    # writing an in-app row for a reader who asked not to hear about product updates
    # would honour the opt-out only on the channel that is easiest to check, which is
    # the dishonest half of an opt-out.
    notifications_created = 0
    for user in owners:
        if not user.notify_product_updates:
            continue
        previous = f" Previous version: {old_version}." if old_version else ""
        notification = Notification(
            user_id=user.id,
            notification_type="template_version_update",
            entity_type="template",
            entity_id=template_id,
            title=f"New version available: {template.title}",
            message=(
                f"A new version ({new_version}) of your template "
                f"'{template.title}' is now available.{previous}"
            ),
            action_url=f"/templates/{template.slug}",
            meta={
                "template_id": str(template_id),
                "template_title": template.title,
                "old_version": old_version,
                "new_version": new_version,
            },
        )
        session.add(notification)
        notifications_created += 1

    # No commit here. This is called from an admin endpoint inside that endpoint's
    # transaction, and `get_session` never commits — the endpoint owns the commit, so a
    # failure anywhere in the mutation takes the notifications down with it rather than
    # leaving owners told about a version bump that was rolled back.
    await session.flush()
    logger.info(
        "Created %d notifications (of %d owners) for template %s version change from %s to %s",
        notifications_created,
        len(owners),
        template_id,
        old_version,
        new_version,
    )

    return notifications_created


async def deliver_notification_email(
    session: AsyncSession,
    notification: Notification,
) -> bool:
    """Send an email for a notification and mark it as delivered.

    Returns True if the email was sent successfully.
    """
    # Get user details
    user = await session.execute(
        select(User).where(User.id == notification.user_id)
    )
    user = user.scalar_one_or_none()
    if not user or not user.email:
        return False

    success = await send_notification_email(
        to_email=user.email,
        subject=notification.title,
        message=notification.message,
        action_url=notification.action_url,
    )

    if success:
        notification.email_delivered = True
        notification.email_delivered_at = datetime.now(timezone.utc)
        # Flush, not commit: the caller owns the transaction (see
        # create_template_version_notification's own note).
        await session.flush()
        logger.info(
            "Email delivered for notification %s to user %s",
            notification.id,
            user.id,
        )
    else:
        logger.warning(
            "Failed to deliver email for notification %s to user %s",
            notification.id,
            user.id,
        )

    return success


async def deliver_pending_notification_emails(
    session: AsyncSession,
    template_id: uuid.UUID,
) -> int:
    """Email every not-yet-delivered notification for one template. Returns the count
    actually accepted by the transport.

    Split from row creation rather than folded into it because the two have opposite
    failure rules. The rows are part of the admin's mutation and must roll back with it;
    the sends are not, and must never be able to fail the mutation — `send_notification_
    email` returns False rather than raising (email_service's own contract: "a failed
    send must not undo an already-committed order"), and this loop keeps going, so one
    bad address cannot cost the other owners their notice.

    Called AFTER the endpoint commits, so an email never announces a version bump that
    was subsequently rolled back — the one ordering that cannot be undone, since a sent
    email is not recallable.
    """
    pending = (
        await session.execute(
            select(Notification)
            .where(Notification.entity_type == "template")
            .where(Notification.entity_id == template_id)
            .where(Notification.notification_type == "template_version_update")
            .where(Notification.email_delivered.is_(False))
        )
    ).scalars().all()

    delivered = 0
    for notification in pending:
        if await deliver_notification_email(session, notification):
            delivered += 1

    if pending:
        # This commit is correct and is not the caller's: it persists only the
        # `email_delivered` bookkeeping, after the mutation itself is already durable.
        # Without it the flags are discarded and a later run re-emails everyone.
        await session.commit()

    return delivered


async def get_user_notifications(
    session: AsyncSession,
    user_id: uuid.UUID,
    unread_only: bool = False,
    limit: int = 50,
) -> list[Notification]:
    """Get notifications for a user, optionally filtered by read status."""
    query = select(Notification).where(Notification.user_id == user_id)

    if unread_only:
        query = query.where(Notification.read.is_(False))

    query = query.order_by(Notification.created_at.desc()).limit(limit)

    result = await session.execute(query)
    return list(result.scalars().all())


async def mark_notification_read(
    session: AsyncSession,
    notification_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    """Mark a notification as read for a user.

    Returns True if the notification was found and updated.
    """
    result = await session.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notification = result.scalar_one_or_none()

    if not notification:
        return False

    notification.read = True
    await session.commit()
    return True


async def mark_all_notifications_read(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> int:
    """Mark all notifications as read for a user.

    Returns the number of notifications updated.
    """
    from sqlalchemy import update

    result = await session.execute(
        update(Notification)
        .where(Notification.user_id == user_id)
        .where(Notification.read.is_(False))
        .values(read=True)
        # Without this, rows already loaded in this session keep their stale `read`
        # value and a caller that re-serialises them after this call reports unread
        # notifications it just marked read.
        .execution_options(synchronize_session="fetch")
    )
    await session.commit()
    return result.rowcount
