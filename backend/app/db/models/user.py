from sqlalchemy import String, Boolean
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
