import enum
from datetime import datetime
from typing import TypeVar
from uuid import UUID, uuid4
from sqlalchemy import DateTime, Enum as SQLEnum, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, validates

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

class PublishState(str, enum.Enum):
    """Shared by questions/courses/lessons/templates/products (migration 012,
    week3_plan.md Phase 5 step 4) — one enum, not five near-identical ones, since a
    lesson's `in_review` and a template's `in_review` mean the same thing and a typo'd
    fifth spelling on one table is exactly the drift a shared type rules out."""
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    PUBLISHED = "published"
    ARCHIVED = "archived"

class PublishStateMixin:
    """Adds `publish_state` (migration 012) to any model that already has a `published`
    boolean, and keeps the two in sync automatically — so no existing write site (a
    test fixture, a seed script's ORM path, an endpoint nobody touched this phase) has
    to know the new column exists. This is what actually delivers Phase 5 step 4's
    explicit requirement — "so the 53 existing tests and every read path keep
    working" — the migration's CHECK constraint alone only *rejects* a bad write, it
    doesn't make the old ones correct.

    `entity.published = True/False`, however it's set (constructor kwarg or a plain
    attribute assignment, anywhere in the codebase, at any time), derives
    `publish_state` as published/draft. A caller that needs `in_review` or `archived`
    sets `.publish_state` explicitly *after* setting `.published`
    (`app/core/publish_state.py:apply_publish_state` does exactly this, in that order)
    — the validator only overwrites `publish_state` at the moment `published` itself is
    assigned, so a later explicit assignment always wins.
    """
    publish_state: Mapped["PublishState"] = mapped_column(
        str_enum(PublishState, name="publish_state"), default=PublishState.DRAFT, nullable=False,
    )

    @validates("published")
    def _sync_publish_state_from_published(self, key: str, value: bool) -> bool:
        self.publish_state = PublishState.PUBLISHED if value else PublishState.DRAFT
        return value


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class CreatedAtMixin:
    """`created_at` only, for append-only rows that are created and deleted but never
    edited (`bookmarks`, migration 030).

    It exists so such a table can't be given `TimestampMixin` out of habit: that adds an
    `updated_at` the migration never created, and SQLAlchemy then names the missing
    column in every INSERT. `bookmarks` shipped that way — the failure surfaced through
    the endpoint's broad `except` as a 409 "already bookmarked" on a learner's *first*
    bookmark, which reads like a working duplicate guard rather than a broken table.
    """
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class IdMixin:
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
