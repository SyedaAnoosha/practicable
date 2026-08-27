"""Single place that writes `publish_state` and `published` together. Migration 012's
CHECK constraint (`published = (publish_state = 'published')`) means the two columns
can never disagree in the database — but that
constraint only *rejects* a bad write, it does not *compose* the right one. Three admin
endpoints (questions, templates, courses/lessons) each toggle publish state; without
this module each would hand-roll its own "set both fields" logic, and the third one to
be written wrong is a matter of when, not if. One function, three callers.
"""
from __future__ import annotations

from app.db.base import PublishState


def resolve_publish_state(*, published: bool, publish_state: PublishState | None) -> PublishState:
    """`publish_state` wins when the caller supplies it explicitly — the
    `PublishStateChip` UI always does, since it is the only client that can express
    `in_review`/`archived`. When it is omitted, the state is derived from the legacy
    boolean, so a bare `{"published": true}` request body the existing tests
    and any older client already send keeps behaving exactly as before.

    Raises `ValueError` if both are given and disagree — the same rule migration 012's
    CHECK constraint enforces at the database layer, surfaced here as a normal 4xx
    instead of a raw constraint-violation 500.
    """
    if publish_state is not None:
        if (publish_state == PublishState.PUBLISHED) != published:
            raise ValueError(
                f"published={published} disagrees with publish_state="
                f"'{publish_state.value}' — the two must agree."
            )
        return publish_state
    return PublishState.PUBLISHED if published else PublishState.DRAFT


def apply_publish_state(entity, *, published: bool, publish_state: PublishState | None) -> PublishState:
    """Resolves and writes both columns on `entity` in one call. Returns the resolved
    state so the caller's audit-log `context` can record it alongside the old value.

    Order matters: `entity.published` is set *first*, which fires
    `PublishStateMixin`'s validator and auto-derives `publish_state` as
    published/draft — then `entity.publish_state` is set explicitly, overriding that
    derived value when the caller asked for `in_review`/`archived`. Reversed, the
    validator would silently clobber the explicit choice."""
    state = resolve_publish_state(published=published, publish_state=publish_state)
    entity.published = published
    entity.publish_state = state
    return state
