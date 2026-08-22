"""Shared test fixtures: an isolated DB transaction per test, a JWT dependency override
in place of real Supabase verification, one AsyncClient per actor, and the minimal
content graph the gating suite needs.

Every fixture rolls back via SQLAlchemy 2.0's pattern for testing code that itself calls
`session.commit()`: one outer transaction that's never committed, with
`join_transaction_mode="create_savepoint"` so an inner `commit()` becomes a SAVEPOINT
release. Auth is a synthetic bearer token decoded locally, since Supabase JWTs are ES256
via JWKS and can't be minted here — the Playwright suite exercises the real token path.

Run from `backend/`: `Settings.Config.env_file = ".env"` resolves relative to CWD.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import AsyncIterator, Optional

import pytest
import pytest_asyncio
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.security import VerifiedToken, security, verify_jwt_full, verify_jwt_optional
from app.db.models import (
    Course,
    Domain,
    Entitlement,
    GrantedVia,
    Lesson,
    LessonBlock,
    LessonBlockType,
    LessonType,
    Media,
    MediaStatus,
    Module,
    Product,
    ProductContent,
    Question,
    Role,
    Section,
    Author,
    Template,
    User,
)
from app.db.session import _asyncpg_url, get_session
from main import app

# A SEPARATE engine from the app's own, and deliberately NullPool: a pooled connection
# gets bound to whichever event loop first checks it out, and pytest-asyncio hands each
# test function a fresh loop, so a reused connection fails with "attached to a different
# loop". NullPool opens a fresh connection per `engine.connect()` instead.
_test_engine = create_async_engine(
    _asyncpg_url(settings.database_url),
    poolclass=NullPool,
    connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
)

# ── The fake bearer-token scheme ────────────────────────────────────────────────────
# Format: "test|<user_id>|<email>|<name>". Stateless and self-describing, so a fifth
# kind of actor can mint its own token inline with no shared lookup table.
_FAKE_PREFIX = "test"


def make_fake_token(user_id: uuid.UUID, email: str, name: str = "") -> str:
    return f"{_FAKE_PREFIX}|{user_id}|{email}|{name}"


def _parse_fake_token(raw: str) -> VerifiedToken:
    parts = raw.split("|", 3)
    if len(parts) != 4 or parts[0] != _FAKE_PREFIX:
        raise ValueError("not a fake test token")
    _, user_id, email, name = parts
    # Phase 10 (§10F re-verification, 2026-08-22): require_recent_reauth checks the
    # JWT's `iat` claim. Every fixture-issued test token defaults to "issued right
    # now" — the common case, matching a normal signed-in test client — so existing
    # tests don't need to know about reauth freshness at all. A test specifically
    # proving the stale-token rejection path constructs its own VerifiedToken with an
    # old `issued_at` directly (see test_account_selfserve.py).
    return VerifiedToken(
        user_id=user_id, email=email or None, name=name or None,
        issued_at=int(datetime.now(timezone.utc).timestamp()),
    )


async def _fake_verify_jwt_full(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> VerifiedToken:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        return _parse_fake_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def _fake_verify_jwt_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[VerifiedToken]:
    if credentials is None:
        return None
    try:
        return _parse_fake_token(credentials.credentials)
    except ValueError:
        return None


# ── DB: one real connection per test, in a transaction that is always rolled back ──
# `join_transaction_mode="create_savepoint"` alone isn't enough: a `commit()` inside a
# route ENDS that savepoint, so the `after_transaction_end` listener below restarts one
# immediately — without it, every operation after the first inner commit runs
# unprotected against the outer transaction.
@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    async with _test_engine.connect() as connection:
        await connection.begin()
        await connection.begin_nested()  # the first savepoint; commit()s release/restart this one
        session = AsyncSession(bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint")

        @event.listens_for(session.sync_session, "after_transaction_end")
        def _restart_savepoint(sync_session, transaction):
            if connection.closed:
                return
            if not connection.sync_connection.in_nested_transaction():
                connection.sync_connection.begin_nested()

        yield session
        await session.close()
        await connection.rollback()


@pytest_asyncio.fixture(autouse=True)
async def _override_session_and_auth(db_session: AsyncSession):
    """Point every `Depends(get_session)` at this test's transactional session, and every
    `Depends(verify_jwt_full/optional)` at the fake decoder. Autouse, so no test can
    forget it and silently hit the real JWKS endpoint outside the rollback boundary."""

    async def _get_test_session():
        yield db_session

    app.dependency_overrides[get_session] = _get_test_session
    app.dependency_overrides[verify_jwt_full] = _fake_verify_jwt_full
    app.dependency_overrides[verify_jwt_optional] = _fake_verify_jwt_optional
    yield
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def anon_client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


def _authed_client_factory(user_id: uuid.UUID, email: str, name: str = ""):
    async def _make() -> AsyncIterator[AsyncClient]:
        transport = ASGITransport(app=app)
        token = make_fake_token(user_id, email, name)
        async with AsyncClient(
            transport=transport, base_url="http://testserver", headers={"Authorization": f"Bearer {token}"}
        ) as client:
            yield client

    return _make


# ── The four actors ─────────────────────────────────────────────────────────────────
# Each creates its own `users` row up front (rather than on request) so fixtures can
# reference `.id` before any request is made, plus its own client bound to that identity.


@pytest_asyncio.fixture
async def member_user(db_session: AsyncSession) -> User:
    """Signed in, holds no entitlements."""
    user = User(id=uuid.uuid4(), email=f"member-{uuid.uuid4().hex[:8]}@example.test", role=Role.MEMBER)
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def entitled_user(db_session: AsyncSession) -> User:
    """Signed in, will hold the course product — the actual grant lives in
    test_gating.py, since which product is entitled varies per test."""
    user = User(id=uuid.uuid4(), email=f"buyer-{uuid.uuid4().hex[:8]}@example.test", role=Role.MEMBER)
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    user = User(id=uuid.uuid4(), email=f"admin-{uuid.uuid4().hex[:8]}@example.test", role=Role.ADMIN)
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def member_client(member_user: User) -> AsyncIterator[AsyncClient]:
    async for c in _authed_client_factory(member_user.id, member_user.email)():
        yield c


@pytest_asyncio.fixture
async def entitled_client(entitled_user: User) -> AsyncIterator[AsyncClient]:
    async for c in _authed_client_factory(entitled_user.id, entitled_user.email)():
        yield c


@pytest_asyncio.fixture
async def admin_client(admin_user: User) -> AsyncIterator[AsyncClient]:
    async for c in _authed_client_factory(admin_user.id, admin_user.email)():
        yield c


# ── Minimal content graph ───────────────────────────────────────────────────────────
# One section/author/domain, one course with one module and one gated video lesson, one
# standalone paid template, one free template, one draft lesson. Every slug carries a
# random suffix so it can't collide with real seeded rows visible under READ COMMITTED.


def _slug(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


@pytest_asyncio.fixture
async def content_graph(db_session: AsyncSession):
    """Returns a namespace of the rows most gating cases need. Built once per test, not
    shared across tests, so no case can leak state into another."""

    section = Section(name="Test Section", slug=_slug("section"))
    author = Author(name="Test Author", slug=_slug("author"))
    domain = Domain(name=f"Test Domain {uuid.uuid4().hex[:6]}", slug=_slug("domain"))
    db_session.add_all([section, author, domain])
    await db_session.flush()

    course = Course(
        slug=_slug("course"), title="Gating Test Course", description="d",
        section_id=section.id, author_id=author.id, published=True,
    )
    db_session.add(course)
    await db_session.flush()

    module = Module(title="Module 1", sort_order=0, course_id=course.id)
    db_session.add(module)
    await db_session.flush()

    lesson = Lesson(
        slug=_slug("lesson"), title="Gated Lesson", description="d",
        lesson_type=LessonType.VIDEO,
        body="THE-SECRET-LESSON-BODY-THAT-MUST-NEVER-LEAK",
        module_id=module.id, sort_order=0, published=True,
    )
    db_session.add(lesson)
    await db_session.flush()

    media = Media(
        lesson_id=lesson.id, mux_asset_id="asset_test", mux_playback_id=f"pb_{uuid.uuid4().hex[:12]}",
        status=MediaStatus.READY, duration_seconds=120,
    )
    db_session.add(media)

    draft_lesson = Lesson(
        slug=_slug("draft-lesson"), title="Draft Lesson", description="d",
        lesson_type=LessonType.READING, body="DRAFT-BODY-NEVER-PUBLIC",
        module_id=module.id, sort_order=1, published=False,
    )
    db_session.add(draft_lesson)

    paid_template = Template(
        slug=_slug("paid-template"), title="Paid Template", description="d",
        section_id=section.id, author_id=author.id,
        storage_key=f"test/{uuid.uuid4().hex}.xlsx", file_name="paid.xlsx",
        file_size_bytes=1024, mime_type="application/vnd.ms-excel",
        published=True, is_free=False,
    )
    free_template = Template(
        slug=_slug("free-template"), title="Free Template", description="d",
        section_id=section.id, author_id=author.id,
        storage_key=f"test/{uuid.uuid4().hex}.xlsx", file_name="free.xlsx",
        file_size_bytes=512, mime_type="application/vnd.ms-excel",
        published=True, is_free=True,
    )
    db_session.add_all([paid_template])
    db_session.add_all([free_template])
    await db_session.flush()

    lesson_product = Product(
        slug=_slug("lesson-product"), name="Course Access", description="d",
        stripe_price_id=f"price_test_{uuid.uuid4().hex[:12]}", price_amount=4900, currency="AUD", published=True,
    )
    template_product = Product(
        slug=_slug("template-product"), name="Template Only", description="d",
        stripe_price_id=f"price_test_{uuid.uuid4().hex[:12]}", price_amount=3900, currency="AUD", published=True,
    )
    db_session.add_all([lesson_product, template_product])
    await db_session.flush()

    db_session.add_all([
        ProductContent(product_id=lesson_product.id, content_type="lesson", content_id=lesson.id),
        ProductContent(product_id=template_product.id, content_type="template", content_id=paid_template.id),
    ])
    await db_session.flush()

    # A mixed-content lesson (below) is granted by the SAME `lesson_product` as a second
    # ProductContent row — a course product grants every lesson via one row each.

    # A mixed-content lesson: one text block, one video block, one paid file block, one
    # FREE file block — the free block proves per-block gating, not all-or-nothing.
    mixed_lesson = Lesson(
        slug=_slug("mixed-lesson"), title="Mixed Content Lesson", description="d",
        lesson_type=LessonType.MIXED,
        module_id=module.id, sort_order=2, published=True,
    )
    db_session.add(mixed_lesson)
    await db_session.flush()

    mixed_media = Media(
        lesson_id=mixed_lesson.id, mux_asset_id="asset_mixed_test", mux_playback_id=f"pb_{uuid.uuid4().hex[:12]}",
        status=MediaStatus.READY, duration_seconds=90,
    )
    db_session.add(mixed_media)
    await db_session.flush()

    text_block = LessonBlock(
        lesson_id=mixed_lesson.id, sort_order=0, block_type=LessonBlockType.TEXT,
        heading="Why this matters", text_body="THE-SECRET-BLOCK-BODY-THAT-MUST-NEVER-LEAK",
    )
    video_block = LessonBlock(
        lesson_id=mixed_lesson.id, sort_order=1, block_type=LessonBlockType.VIDEO,
        media_id=mixed_media.id,
    )
    paid_file_block = LessonBlock(
        lesson_id=mixed_lesson.id, sort_order=2, block_type=LessonBlockType.FILE,
        template_id=paid_template.id,
    )
    free_file_block = LessonBlock(
        lesson_id=mixed_lesson.id, sort_order=3, block_type=LessonBlockType.FILE,
        template_id=free_template.id,
    )
    db_session.add_all([text_block, video_block, paid_file_block, free_file_block])
    db_session.add(ProductContent(product_id=lesson_product.id, content_type="lesson", content_id=mixed_lesson.id))
    await db_session.flush()

    # A domain pack: one product carrying one template row (the PDF) plus N question_set
    # rows — same Product/ProductContent shape as any other product, just two
    # content_types on one. `pack_question` proves its questions stay independently free.
    pack_pdf = Template(
        slug=_slug("pack-pdf"), title="Test Domain — question pack (PDF)", description="d",
        section_id=section.id, author_id=author.id,
        storage_key=f"test/{uuid.uuid4().hex}.pdf", file_name="pack.pdf",
        file_size_bytes=4096, mime_type="application/pdf",
        published=True, is_free=False,
    )
    db_session.add(pack_pdf)
    await db_session.flush()

    pack_question = Question(
        slug=_slug("pack-question"), title="A pack question", subtitle="d",
        body="THE-FREE-QUESTION-BODY", preview="preview", domain_id=domain.id, published=True,
    )
    db_session.add(pack_question)
    await db_session.flush()

    pack_product = Product(
        slug=_slug("pack-product"), name="Test Domain Pack", description="d",
        stripe_price_id=f"price_test_{uuid.uuid4().hex[:12]}", price_amount=4900, currency="AUD", published=True,
    )
    db_session.add(pack_product)
    await db_session.flush()
    db_session.add_all([
        ProductContent(product_id=pack_product.id, content_type="template", content_id=pack_pdf.id),
        ProductContent(product_id=pack_product.id, content_type="question_set", content_id=pack_question.id),
    ])
    await db_session.flush()

    class Graph:
        pass

    g = Graph()
    g.section, g.author, g.domain = section, author, domain
    g.course, g.module = course, module
    g.lesson, g.media, g.draft_lesson = lesson, media, draft_lesson
    g.paid_template, g.free_template = paid_template, free_template
    g.lesson_product, g.template_product = lesson_product, template_product
    g.mixed_lesson, g.mixed_media = mixed_lesson, mixed_media
    g.text_block, g.video_block = text_block, video_block
    g.paid_file_block, g.free_file_block = paid_file_block, free_file_block
    g.pack_pdf, g.pack_question, g.pack_product = pack_pdf, pack_question, pack_product
    return g


@pytest_asyncio.fixture
async def grant(db_session: AsyncSession):
    """`await grant(user, product)` — an active entitlement, immediately visible to the
    same transaction. Returns the row so a test can delete it to exercise revocation."""

    async def _grant(user: User, product: Product) -> Entitlement:
        ent = Entitlement(user_id=user.id, product_id=product.id, granted_via=GrantedVia.MANUAL)
        db_session.add(ent)
        await db_session.flush()
        return ent

    return _grant
