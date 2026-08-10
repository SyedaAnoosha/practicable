import enum
from datetime import datetime
from typing import TypeVar
from uuid import UUID, uuid4
from sqlalchemy import DateTime, Enum as SQLEnum, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

_E = TypeVar("_E", bound=enum.Enum)

def str_enum(enum_cls: type[_E], **kw) -> SQLEnum:
    """SQLAlchemy's Enum() sends a Python enum member's .name ("MEMBER") to Postgres
    by default, not its .value ("member") — surprising for `class X(str, enum.Enum)`
    members, which look like plain strings everywhere else. Every enum type in this
    schema (alembic/versions/001_initial_schema.py) was created with lowercase
    values, so the default behaviour fails every insert/update with
    'invalid input value for enum ...: "MEMBER"'. values_callable fixes it at the
    type level, once, instead of every mapped_column(SQLEnum(...)) call needing to
    remember to pass it."""
    return SQLEnum(enum_cls, values_callable=lambda e: [m.value for m in e], **kw)

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class IdMixin:
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
