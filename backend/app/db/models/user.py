from sqlalchemy import String, Boolean, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin
import enum
import uuid

class Role(str, enum.Enum):
    MEMBER = "member"
    ADMIN = "admin"

class User(Base, TimestampMixin):
    __tablename__ = "users"

    # Deliberately NOT IdMixin's auto-generated uuid4 default. This id IS the Supabase
    # auth user id (auth.users.id — the JWT's `sub` claim), set explicitly when the
    # local profile row is first created (app/core/deps.py get_current_user), never
    # randomly generated. Every other table's user_id foreign key (orders,
    # entitlements, lesson_progress...) is compared directly against auth.uid() in
    # this project's own RLS policies (db/seed/002_enable_rls.sql) — that only holds
    # if users.id equals the Supabase auth id exactly, with no separate mapping column.
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)

    # Profile fields
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    role: Mapped[Role] = mapped_column(SQLEnum(Role), default=Role.MEMBER, nullable=False)
