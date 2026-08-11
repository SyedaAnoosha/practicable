import enum
from datetime import datetime
from typing import TypeVar
from uuid import UUID, uuid4
from sqlalchemy import DateTime, Enum as SQLEnum, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

_E = TypeVar("_E", bound=enum.Enum)

def str_enum(enum_cls: type[_E], *, name: str, **kw) -> SQLEnum:
    """SQLAlchemy's Enum() sends a Python enum member's .name ("MEMBER") to Postgres
    by default, not its .value ("member") — surprising for `class X(str, enum.Enum)`
    members, which look like plain strings everywhere else. Every enum type in this
    schema (alembic/versions/001_initial_schema.py) was created with lowercase
    values, so the default behaviour fails every insert/update with
    'invalid input value for enum ...: "MEMBER"'. values_callable fixes it at the
    type level, once.

    `name` is required, not inferred, for a second reason: SQLAlchemy also derives the
    Postgres *type* name from the Python class name when none is given — `OrderStatus`
    becomes `orderstatus` (no separator), but the migration created the actual type as
    `order_status` (with one, matching the snake_case convention every other type in
    this schema uses). That mismatch fails with 'type "orderstatus" does not exist' —
    a different symptom from the value-casing bug above, easy to mistake for a typo
    instead of the same "guessed instead of matched" root cause. Forcing every caller
    to pass the real type name (grep alembic/versions/001_initial_schema.py for
    postgresql.ENUM(..., name=...) to confirm it) removes the guess entirely."""
    return SQLEnum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e], **kw)

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class IdMixin:
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
