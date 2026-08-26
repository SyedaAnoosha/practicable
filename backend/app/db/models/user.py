from datetime import datetime

from sqlalchemy import String, Boolean, DateTime
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin, str_enum
import enum
import uuid

class Role(str, enum.Enum):
    MEMBER = "member"
    ADMIN = "admin"

class User(Base, TimestampMixin):
    __tablename__ = "users"

    # Deliberately NOT IdMixin's uuid4 default: this id IS the Supabase auth user id
    # (the JWT's `sub`), set explicitly on first sight in deps.get_current_user. The RLS
    # policies compare user_id foreign keys against auth.uid() directly, which only holds
    # if this equals the Supabase id exactly, with no mapping column.
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)

    # Profile fields
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    role: Mapped[Role] = mapped_column(str_enum(Role, name="role"), default=Role.MEMBER, nullable=False)

    # Stamped on every authenticated request in app.core.deps.get_current_user.
    # Feeds the admin metrics "active users" query (app/api/v1/admin/metrics.py).
    last_sign_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Phase 6C: soft-deactivation. Wired into the entitlements gate
    # (core/entitlements.py) so a deactivated user's existing entitlements are
    # refused at the same choke point as every other access check.
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Phase 10E: notification preferences (week4_plan.md §10E step 1).
    # Two named columns, not a JSONB blob. Transactional mail (receipt, access
    # granted, password reset, security alerts) is NEVER gated by these flags.
    notify_marketing: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sa.false())
    notify_product_updates: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sa.true())
    # Sound notification preference — plays a subtle chime when new notifications
    # arrive. Defaults to True so existing users hear notifications by default;
    # the preference page lets them disable it.
    notify_sound: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sa.true())
