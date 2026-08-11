"""The member learning interface's data (DESIGN.md §24.1): one endpoint returns the
lesson's own content plus the whole course's outline, so /learn/:courseSlug/
:lessonSlug renders its sidebar without a second round trip. Video/download URLs stay
separate, short-lived endpoints (signed Mux token, presigned S3 URL) — minted only
after the entitlement check, never embedded in the detail payload itself.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id, get_current_user_id_optional
from app.core.entitlements import ResourceType, has_access_to
from app.db.models import Course, CourseProgress, Lesson, LessonProgress, Media, Module, ModuleQuestion, Question, Template
from app.db.session import get_session
from app.integrations.mux_client import generate_mux_playback_token
from app.integrations.storage_client import generate_presigned_url

router = APIRouter()


def _lesson_type_value(lesson_type) -> str:
    return lesson_type.value if hasattr(lesson_type, "value") else lesson_type


async def _lesson_entitled(*, lesson: Lesson, user_id: Optional[str], session: AsyncSession) -> bool:
    """No free-preview bypass (explicit product decision, 2026-08-11): lessons and
    video are never free — purely a real, per-product entitlement check."""
    if not user_id:
        return False
    return await has_access_to(
        user_id=uuid.UUID(user_id), resource_type=ResourceType.LESSON, resource_id=lesson.id, session=session
    )


class PlaybackTokenOut(BaseModel):
    playback_id: str
    token: str


class LessonDownloadOut(BaseModel):
    file_name: str
    file_size_bytes: int


class LessonNavOut(BaseModel):
    slug: str
    title: str


class SidebarLessonOut(BaseModel):
    id: str
    slug: str
    title: str
    lesson_type: str
    sort_order: int
    locked: bool
    completed: bool
    is_current: bool


class SidebarQuestionOut(BaseModel):
    """A question attached to the module (ModuleQuestion) — always free/public, so it
    carries no locked/completed state the way a lesson row does."""
    id: str
    slug: str
    title: str
    sort_order: int


class SidebarModuleOut(BaseModel):
    id: str
    title: str
    sort_order: int
    lessons: list[SidebarLessonOut]
    questions: list[SidebarQuestionOut]


class LessonDetailOut(BaseModel):
    id: str
    slug: str
    title: str
    description: Optional[str]
    lesson_type: str
    body: Optional[str]
    download: Optional[LessonDownloadOut]
    has_video: bool
    entitled: bool
    completed: bool
    course_slug: str
    course_title: str
    progress_percent: int
    modules: list[SidebarModuleOut]
    previous: Optional[LessonNavOut]
    next: Optional[LessonNavOut]


@router.get("/courses/{course_slug}/lessons/{lesson_slug}", response_model=LessonDetailOut)
async def get_lesson_in_course(
    course_slug: str,
    lesson_slug: str,
    session: AsyncSession = Depends(get_session),
    user_id: Optional[str] = Depends(get_current_user_id_optional),
):
    """Powers /learn/:courseSlug/:lessonSlug. Public at the API layer (so a
    free-preview lesson is reachable logged-out too), same as /questions/:slug —
    the frontend still keeps the actual /learn route behind the member auth guard for
    now, since nothing else in the app supports anonymous content consumption yet."""
    course = (
        await session.execute(select(Course).where(Course.slug == course_slug, Course.published.is_(True)))
    ).scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    lesson = (
        await session.execute(select(Lesson).where(Lesson.slug == lesson_slug, Lesson.published.is_(True)))
    ).scalar_one_or_none()
    if not lesson or not lesson.module_id:
        raise HTTPException(status_code=404, detail="Lesson not found")

    module = (await session.execute(select(Module).where(Module.id == lesson.module_id))).scalar_one_or_none()
    if not module or module.course_id != course.id:
        raise HTTPException(status_code=404, detail="Lesson not found in this course")

    entitled = await _lesson_entitled(lesson=lesson, user_id=user_id, session=session)

    modules = (
        (await session.execute(select(Module).where(Module.course_id == course.id).order_by(Module.sort_order)))
        .scalars()
        .all()
    )

    completed_lesson_ids: set[uuid.UUID] = set()
    if user_id:
        completed_lesson_ids = set(
            (
                await session.execute(
                    select(LessonProgress.lesson_id).where(
                        LessonProgress.user_id == uuid.UUID(user_id),
                        LessonProgress.completed.is_(True),
                    )
                )
            )
            .scalars()
            .all()
        )

    flat_lessons: list[Lesson] = []
    sidebar_modules: list[SidebarModuleOut] = []
    for m in modules:
        m_lessons = (
            (
                await session.execute(
                    select(Lesson)
                    .where(Lesson.module_id == m.id, Lesson.published.is_(True))
                    .order_by(Lesson.sort_order)
                )
            )
            .scalars()
            .all()
        )
        sidebar_lessons: list[SidebarLessonOut] = []
        for l in m_lessons:
            flat_lessons.append(l)
            l_entitled = await _lesson_entitled(lesson=l, user_id=user_id, session=session)
            sidebar_lessons.append(
                SidebarLessonOut(
                    id=str(l.id),
                    slug=l.slug,
                    title=l.title,
                    lesson_type=_lesson_type_value(l.lesson_type),
                    sort_order=l.sort_order,
                    locked=not l_entitled,
                    completed=l.id in completed_lesson_ids,
                    is_current=l.id == lesson.id,
                )
            )

        # Questions attached to this module (ModuleQuestion) — always free, so they
        # ride alongside the lesson list with no lock state of their own.
        module_question_rows = (
            (
                await session.execute(
                    select(ModuleQuestion, Question)
                    .join(Question, Question.id == ModuleQuestion.question_id)
                    .where(ModuleQuestion.module_id == m.id, Question.published.is_(True))
                    .order_by(ModuleQuestion.sort_order)
                )
            )
            .all()
        )
        sidebar_questions = [
            SidebarQuestionOut(id=str(q.id), slug=q.slug, title=q.title, sort_order=mq.sort_order)
            for mq, q in module_question_rows
        ]

        sidebar_modules.append(
            SidebarModuleOut(
                id=str(m.id), title=m.title, sort_order=m.sort_order, lessons=sidebar_lessons, questions=sidebar_questions
            )
        )

    idx = next((i for i, l in enumerate(flat_lessons) if l.id == lesson.id), None)
    previous = None
    nxt = None
    if idx is not None:
        if idx > 0:
            p = flat_lessons[idx - 1]
            previous = LessonNavOut(slug=p.slug, title=p.title)
        if idx < len(flat_lessons) - 1:
            n = flat_lessons[idx + 1]
            nxt = LessonNavOut(slug=n.slug, title=n.title)

    progress_percent = 0
    if flat_lessons:
        progress_percent = round(
            100 * len(completed_lesson_ids & {l.id for l in flat_lessons}) / len(flat_lessons)
        )

    media = (await session.execute(select(Media).where(Media.lesson_id == lesson.id))).scalar_one_or_none()

    download_out = None
    if entitled and lesson.download_template_id:
        template = (
            await session.execute(select(Template).where(Template.id == lesson.download_template_id))
        ).scalar_one_or_none()
        if template:
            download_out = LessonDownloadOut(file_name=template.file_name, file_size_bytes=template.file_size_bytes)

    return LessonDetailOut(
        id=str(lesson.id),
        slug=lesson.slug,
        title=lesson.title,
        description=lesson.description,
        lesson_type=_lesson_type_value(lesson.lesson_type),
        body=lesson.body if entitled else None,
        download=download_out,
        has_video=media is not None and media.status == "ready",
        entitled=entitled,
        completed=lesson.id in completed_lesson_ids,
        course_slug=course.slug,
        course_title=course.title,
        progress_percent=progress_percent,
        modules=sidebar_modules,
        previous=previous,
        next=nxt,
    )


@router.get("/lessons/{lesson_id}/playback-token", response_model=PlaybackTokenOut)
async def get_playback_token(
    lesson_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """Get signed Mux playback token for a lesson."""

    result = await session.execute(select(Lesson).where(Lesson.id == uuid.UUID(lesson_id)))
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    media_result = await session.execute(select(Media).where(Media.lesson_id == lesson.id))
    media = media_result.scalar_one_or_none()

    if not media or not media.mux_playback_id:
        raise HTTPException(status_code=404, detail="Video not ready")

    if media.status != "ready":
        raise HTTPException(status_code=400, detail="Video still processing")

    # The check runs BEFORE Mux is ever called (BACKEND.md §4.1) — a signed URL minted
    # and then discarded on a failed check is a signed URL that existed, and existing
    # is enough. No free-preview bypass — video is never free (2026-08-11).
    entitled = await _lesson_entitled(lesson=lesson, user_id=user_id, session=session)
    if not entitled:
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "not_entitled", "message": "This lesson is part of a course you don't have yet."}},
        )

    token = generate_mux_playback_token(media.mux_playback_id)

    return PlaybackTokenOut(
        playback_id=media.mux_playback_id,
        token=token,
    )


class LessonDownloadUrlOut(BaseModel):
    download_url: str
    file_name: str
    file_size_bytes: int


@router.get("/lessons/{lesson_id}/download-url", response_model=LessonDownloadUrlOut)
async def get_lesson_download_url(
    lesson_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """The download-type (or mixed-type) lesson's artefact. Gated by LESSON
    entitlement — i.e. by course access — not by whether the same file is also sold
    standalone as a template product (app/api/v1/content/templates.py's
    /templates/{id}/download-url is that separate, TEMPLATE-gated path)."""
    lesson = (
        await session.execute(select(Lesson).where(Lesson.id == uuid.UUID(lesson_id)))
    ).scalar_one_or_none()
    if not lesson or not lesson.download_template_id:
        raise HTTPException(status_code=404, detail="No downloadable file on this lesson")

    entitled = await _lesson_entitled(lesson=lesson, user_id=user_id, session=session)
    if not entitled:
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "not_entitled", "message": "This lesson is part of a course you don't have yet."}},
        )

    template = (
        await session.execute(select(Template).where(Template.id == lesson.download_template_id))
    ).scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="File not found")

    download_url = generate_presigned_url(template.storage_key)
    return LessonDownloadUrlOut(
        download_url=download_url, file_name=template.file_name, file_size_bytes=template.file_size_bytes
    )


class CompleteOut(BaseModel):
    completed: bool
    course_progress_percent: int


@router.post("/lessons/{lesson_id}/complete", response_model=CompleteOut)
async def mark_lesson_complete(
    lesson_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """DESIGN.md §24.1's "Mark complete" button. Also recomputes the course-level
    CourseProgress rollup live — cheap at this data scale, and it means the catalogue's
    "45% complete" badge (§23.2) and the outline's checkmarks never drift apart."""
    lesson_uuid = uuid.UUID(lesson_id)
    lesson = (await session.execute(select(Lesson).where(Lesson.id == lesson_uuid))).scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    entitled = await _lesson_entitled(lesson=lesson, user_id=user_id, session=session)
    if not entitled:
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "not_entitled", "message": "This lesson is part of a course you don't have yet."}},
        )

    now = datetime.now(timezone.utc)
    progress = (
        await session.execute(
            select(LessonProgress).where(
                LessonProgress.user_id == uuid.UUID(user_id), LessonProgress.lesson_id == lesson_uuid
            )
        )
    ).scalar_one_or_none()
    if progress is None:
        session.add(LessonProgress(user_id=uuid.UUID(user_id), lesson_id=lesson_uuid, completed=True, completed_at=now))
    else:
        progress.completed = True
        progress.completed_at = now
    await session.commit()

    course_progress_percent = 0
    if lesson.module_id:
        module = (await session.execute(select(Module).where(Module.id == lesson.module_id))).scalar_one_or_none()
        if module:
            module_ids = (
                (await session.execute(select(Module.id).where(Module.course_id == module.course_id)))
                .scalars()
                .all()
            )
            all_lesson_ids = set(
                (
                    await session.execute(
                        select(Lesson.id).where(Lesson.module_id.in_(module_ids), Lesson.published.is_(True))
                    )
                )
                .scalars()
                .all()
            )
            completed_ids = set(
                (
                    await session.execute(
                        select(LessonProgress.lesson_id).where(
                            LessonProgress.user_id == uuid.UUID(user_id),
                            LessonProgress.completed.is_(True),
                            LessonProgress.lesson_id.in_(all_lesson_ids),
                        )
                    )
                )
                .scalars()
                .all()
            )
            course_progress_percent = round(100 * len(completed_ids) / len(all_lesson_ids)) if all_lesson_ids else 0
            is_complete = course_progress_percent == 100

            course_progress = (
                await session.execute(
                    select(CourseProgress).where(
                        CourseProgress.user_id == uuid.UUID(user_id), CourseProgress.course_id == module.course_id
                    )
                )
            ).scalar_one_or_none()
            if course_progress is None:
                session.add(
                    CourseProgress(
                        user_id=uuid.UUID(user_id),
                        course_id=module.course_id,
                        completed=is_complete,
                        completed_at=now if is_complete else None,
                        percentage_complete=course_progress_percent,
                    )
                )
            else:
                course_progress.percentage_complete = course_progress_percent
                course_progress.completed = is_complete
                if is_complete:
                    course_progress.completed_at = now
            await session.commit()

    return CompleteOut(completed=True, course_progress_percent=course_progress_percent)
