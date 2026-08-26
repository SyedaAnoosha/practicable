"""Allow `question` as a notification entity_type.

Migration 034 constrained notifications to template/course/pack because those were the
only entities anything notified about. The freshness scan (#16) now warns admins about
*questions* whose search traffic far outruns their routed-product clicks, which is a
notification about a question like the others are about templates. Widening the allow-
list rather than shoehorning the finding into `entity_type='course'`: a constraint that
silently lies about what a row points at is worse than no constraint.

`notification_type` was never constrained (034 line 24: plain String(50)), so the new
`low_conversion_question` / `content_freshness_warning` type strings need nothing there.

Downgrade restores 034's exact tuple; it will fail if any `question` rows exist, which is
the correct behaviour — a downgrade that silently deletes notifications nobody authorised
it to delete would be worse than one that demands a decision first.
"""
import sqlalchemy as sa
from alembic import op

revision = "039"
down_revision = "038"
branch_labels = None
depends_on = None

_OLD_ALLOWED = "entity_type IN ('template', 'course', 'pack')"
_NEW_ALLOWED = "entity_type IN ('template', 'course', 'pack', 'question')"


def upgrade() -> None:
    op.drop_constraint("ck_notifications_entity_type", "notifications", type_="check")
    op.create_check_constraint("ck_notifications_entity_type", "notifications", _NEW_ALLOWED)


def downgrade() -> None:
    op.drop_constraint("ck_notifications_entity_type", "notifications", type_="check")
    op.create_check_constraint("ck_notifications_entity_type", "notifications", _OLD_ALLOWED)
