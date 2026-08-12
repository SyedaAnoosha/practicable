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

    `is_admin` only tells the frontend whether to render the Admin link. It is never a
    control: every /admin/* route is independently guarded by require_admin server-side.
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
    """Every product the user currently holds. The checkout success page polls this after
    a Stripe redirect, since the webhook can land after the user is already back."""
    product_ids = await resolve_product_ids(user_id=uuid.UUID(user_id), session=session)
    return EntitlementsOut(product_ids=[str(pid) for pid in product_ids])


# ─────────────────────────────────────────────────────────────────────────────
# My Library — purchased items across all content types, with progress and resume.
# One endpoint rather than three, so the page doesn't have to reassemble (and race)
# separate fetches. Everything derives from entitlements → products → product_contents.
# ─────────────────────────────────────────────────────────────────────────────


class LibraryCourseOut(BaseModel):
    kind: Literal["course"] = "course"
    slug: str
    title: str
    subtitle: Optional[str]
    total_lessons: int
    completed_lessons: int
    percentage_complete: int
    # The next lesson to open; None means everything owned is complete. Counts only
    # entitled lessons, so a partially-owned course reports progress against what was
    # bought rather than stranding the user below 100% with no way to finish.
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
    # Lets the page distinguish "you haven't bought anything yet" from a load failure.
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
    # A course is "in your library" when you own at least one of its lessons — products
    # grant lessons, not courses.
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
                    # Floored, so 100% is never reached by rounding.
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
    # Question bodies are free to read for everyone, so this is not an access list —
    # it's the record of what a purchase included.
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
