from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_current_user_id
from app.core.entitlements import resolve_product_ids
from app.db.models import (
    Course,
    Domain,
    Lesson,
    LessonProgress,
    Module,
    ProductContent,
    Question,
    Role,
    Template,
    User,
)
from app.db.session import get_session
import uuid

router = APIRouter()


class EntitlementsOut(BaseModel):
    product_ids: list[str]


class ProfileOut(BaseModel):
    id: str
    email: str
    name: Optional[str]
    role: str
    is_admin: bool


@router.get("/me/profile", response_model=ProfileOut)
async def get_my_profile(user: User = Depends(get_current_user)):
    """The signed-in user's own profile, including role.

    `is_admin` exists so the frontend can decide whether to render the Admin link at
    all. It is a *convenience*, never a control: every /admin/* route is independently
    guarded by require_admin server-side, so hiding the link is cosmetic and forging
    this response gains nothing (BACKEND.md §5 / week1_plan.md Non-negotiable #3 —
    client-side checks are UX, the server is the boundary).
    """
    return ProfileOut(
        id=str(user.id), email=user.email, name=user.name,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        is_admin=user.role == Role.ADMIN,
    )


@router.get("/me/entitlements", response_model=EntitlementsOut)
async def get_my_entitlements(
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """DESIGN.md §29.4: the success page polls this every 1.5s for up to 20s after a
    Stripe redirect, since the webhook that actually creates the entitlement can
    arrive after the user is already back on our site. Returns every product the
    user currently holds — the frontend just checks whether the one it's waiting on
    is in the list."""
    product_ids = await resolve_product_ids(user_id=uuid.UUID(user_id), session=session)
    return EntitlementsOut(product_ids=[str(pid) for pid in product_ids])


# ─────────────────────────────────────────────────────────────────────────────
# My Library — product spec §2 steps 6/9 and §9's "'My Library' panel: purchased
# items across all types, clearly labeled, with progress and resume where relevant".
#
# One endpoint, not three, deliberately: the spec's point is that a buyer sees ONE
# place holding differently-shaped things, so the grouping by type belongs in the
# response rather than in three separate client fetches the page then has to
# reassemble (and race). Everything here is derived from entitlements → products →
# product_contents, so a new content type added to that polymorphic table appears
# here by extending this one function, not by adding an endpoint.
# ─────────────────────────────────────────────────────────────────────────────


class LibraryCourseOut(BaseModel):
    kind: Literal["course"] = "course"
    slug: str
    title: str
    subtitle: Optional[str]
    total_lessons: int
    completed_lessons: int
    percentage_complete: int
    # The next lesson to open. None means every owned lesson is complete — the page
    # shows "Completed" rather than a Continue button. Note this counts only lessons
    # the user is actually entitled to, so a partially-owned course reports progress
    # against what they bought, never against lessons they can't open (which would
    # strand them at 60% forever with no way to finish).
    resume_lesson_slug: Optional[str]
    resume_lesson_title: Optional[str]


class LibraryTemplateOut(BaseModel):
    kind: Literal["template"] = "template"
    id: str
    slug: str
    title: str
    description: str
    file_name: str


class LibraryReferenceOut(BaseModel):
    kind: Literal["reference"] = "reference"
    slug: str
    title: str
    domain: str


class LibraryOut(BaseModel):
    courses: list[LibraryCourseOut]
    templates: list[LibraryTemplateOut]
    reference: list[LibraryReferenceOut]
    # True when the user holds no entitlements at all — lets the page distinguish
    # "you haven't bought anything yet" (an empty state with a route into the
    # storefront) from "your library failed to load", which are different messages.
    is_empty: bool


@router.get("/me/library", response_model=LibraryOut)
async def get_my_library(
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """Everything this user has bought, grouped by content type, with course progress
    and a resume point."""
    uid = uuid.UUID(user_id)
    product_ids = await resolve_product_ids(user_id=uid, session=session)
    if not product_ids:
        return LibraryOut(courses=[], templates=[], reference=[], is_empty=True)

    # One query for every grant across every product the user holds, then bucket by
    # content_type in Python — cheaper and simpler than three near-identical queries.
    grants = await session.execute(
        select(ProductContent.content_type, ProductContent.content_id).where(
            ProductContent.product_id.in_(product_ids)
        )
    )
    owned: dict[str, set[uuid.UUID]] = {}
    for content_type, content_id in grants.all():
        owned.setdefault(content_type, set()).add(content_id)

    # ── Courses, reached through the lessons the user owns ───────────────────────
    # A course is "in your library" when you own at least one of its lessons. There is
    # no direct course entitlement in the common case: products grant lessons, and the
    # course is what those lessons belong to.
    courses: list[LibraryCourseOut] = []
    owned_lesson_ids = owned.get("lesson", set())
    if owned_lesson_ids:
        rows = (
            await session.execute(
                select(Lesson, Module, Course)
                .join(Module, Module.id == Lesson.module_id)
                .join(Course, Course.id == Module.course_id)
                .where(
                    Lesson.id.in_(owned_lesson_ids),
                    Lesson.published.is_(True),
                    Course.published.is_(True),
                )
                .order_by(Module.sort_order, Lesson.sort_order)
            )
        ).all()

        completed_ids = set(
            (
                await session.execute(
                    select(LessonProgress.lesson_id).where(
                        LessonProgress.user_id == uid,
                        LessonProgress.lesson_id.in_(owned_lesson_ids),
                        LessonProgress.completed.is_(True),
                    )
                )
            )
            .scalars()
            .all()
        )

        # Rows arrive already ordered by module then lesson, so the first incomplete
        # lesson encountered per course IS the resume point — no second sort needed.
        by_course: dict[uuid.UUID, dict] = {}
        for lesson, _module, course in rows:
            entry = by_course.setdefault(
                course.id,
                {"course": course, "total": 0, "done": 0, "resume": None},
            )
            entry["total"] += 1
            if lesson.id in completed_ids:
                entry["done"] += 1
            elif entry["resume"] is None:
                entry["resume"] = lesson

        for entry in by_course.values():
            course, total, done = entry["course"], entry["total"], entry["done"]
            resume = entry["resume"]
            courses.append(
                LibraryCourseOut(
                    slug=course.slug,
                    title=course.title,
                    subtitle=course.subtitle,
                    total_lessons=total,
                    completed_lessons=done,
                    # Integer percent, floored — a course is only ever shown as 100%
                    # when every owned lesson is genuinely complete, never by rounding.
                    percentage_complete=(done * 100 // total) if total else 0,
                    resume_lesson_slug=resume.slug if resume else None,
                    resume_lesson_title=resume.title if resume else None,
                )
            )
        courses.sort(key=lambda c: c.title)

    # ── Templates ────────────────────────────────────────────────────────────────
    templates: list[LibraryTemplateOut] = []
    if owned.get("template"):
        rows = (
            (
                await session.execute(
                    select(Template)
                    .where(Template.id.in_(owned["template"]), Template.published.is_(True))
                    .order_by(Template.title)
                )
            )
            .scalars()
            .all()
        )
        templates = [
            LibraryTemplateOut(
                id=str(t.id), slug=t.slug, title=t.title,
                description=t.description, file_name=t.file_name,
            )
            for t in rows
        ]

    # ── Reference (question_set grants) ──────────────────────────────────────────
    # Question bodies are free to read for everyone (DESIGN.md §21.3), so this section
    # is not an access list — it's the record of what a purchase included, which is
    # what makes a receipt verifiable later. It is also the seam that domain reference
    # packs would arrive through if they are ever sold: same content_type, more rows.
    reference: list[LibraryReferenceOut] = []
    if owned.get("question_set"):
        rows = (
            await session.execute(
                select(Question, Domain)
                .join(Domain, Domain.id == Question.domain_id)
                .where(Question.id.in_(owned["question_set"]), Question.published.is_(True))
                .order_by(Question.title)
            )
        ).all()
        reference = [
            LibraryReferenceOut(slug=q.slug, title=q.title, domain=d.name) for q, d in rows
        ]

    return LibraryOut(
        courses=courses,
        templates=templates,
        reference=reference,
        is_empty=not (courses or templates or reference),
    )
