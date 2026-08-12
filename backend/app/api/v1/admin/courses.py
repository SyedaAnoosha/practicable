"""Admin CRUD for courses, their modules, and their lessons — including attaching a
Mux video and a downloadable file to a lesson.

Product spec §8: "…add a new question, course, or template — tag it, attach a video or
file, and publish", and "group existing questions into a new domain pack or course, so
growing the catalog doesn't require rebuilding anything."
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.models import (
    Author,
    Course,
    Lesson,
    LessonType,
    Media,
    MediaStatus,
    Module,
    Section,
    Template,
    User,
)
from app.db.session import get_session

from .common import ensure_unique_slug, get_or_404, record_audit, slugify

router = APIRouter()


# ── Courses ──────────────────────────────────────────────────────────────────────

class CourseWriteIn(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str = Field(min_length=1)
    subtitle: Optional[str] = Field(default=None, max_length=500)


class LessonOut(BaseModel):
    id: str
    slug: str
    title: str
    description: Optional[str]
    lesson_type: str
    body: Optional[str]
    sort_order: int
    published: bool
    download_template_id: Optional[str]
    mux_playback_id: Optional[str]
    # A video lesson with no Mux asset attached is a lesson that will render an empty
    # player after purchase. Surfaced so the editor can block publishing it.
    is_ready: bool


class ModuleOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    sort_order: int
    lessons: list[LessonOut]


class CourseRowOut(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: Optional[str]
    published: bool
    module_count: int
    lesson_count: int


class CourseDetailOut(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: Optional[str]
    description: str
    published: bool
    modules: list[ModuleOut]


def _lesson_out(lesson: Lesson, media: Optional[Media]) -> LessonOut:
    playback_id = media.mux_playback_id if media else None
    needs_video = lesson.lesson_type in (LessonType.VIDEO, LessonType.MIXED)
    needs_body = lesson.lesson_type in (LessonType.READING, LessonType.MIXED)
    needs_file = lesson.lesson_type == LessonType.DOWNLOAD
    is_ready = (
        (not needs_video or bool(playback_id))
        and (not needs_body or bool(lesson.body))
        and (not needs_file or lesson.download_template_id is not None)
    )
    return LessonOut(
        id=str(lesson.id), slug=lesson.slug, title=lesson.title,
        description=lesson.description,
        lesson_type=lesson.lesson_type.value if hasattr(lesson.lesson_type, "value") else str(lesson.lesson_type),
        body=lesson.body, sort_order=lesson.sort_order, published=lesson.published,
        download_template_id=str(lesson.download_template_id) if lesson.download_template_id else None,
        mux_playback_id=playback_id, is_ready=is_ready,
    )


@router.get("/admin/courses", response_model=list[CourseRowOut])
async def list_courses(session: AsyncSession = Depends(get_session)):
    courses = (await session.execute(select(Course).order_by(Course.title))).scalars().all()
    if not courses:
        return []
    # Two grouped counts rather than a query per course — the same N+1 shape that made
    # GET /questions take 90 seconds once the catalogue was real.
    module_counts = dict(
        (
            await session.execute(
                select(Module.course_id, func.count()).group_by(Module.course_id)
            )
        ).all()
    )
    lesson_counts = dict(
        (
            await session.execute(
                select(Module.course_id, func.count(Lesson.id))
                .join(Lesson, Lesson.module_id == Module.id)
                .group_by(Module.course_id)
            )
        ).all()
    )
    return [
        CourseRowOut(
            id=str(c.id), slug=c.slug, title=c.title, subtitle=c.subtitle,
            published=c.published,
            module_count=module_counts.get(c.id, 0),
            lesson_count=lesson_counts.get(c.id, 0),
        )
        for c in courses
    ]


@router.get("/admin/courses/{course_id}", response_model=CourseDetailOut)
async def get_course(course_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    course = await get_or_404(session, Course, course_id, "Course")
    modules = (
        (await session.execute(select(Module).where(Module.course_id == course.id).order_by(Module.sort_order)))
        .scalars()
        .all()
    )
    module_ids = [m.id for m in modules]

    lessons_by_module: dict[uuid.UUID, list[Lesson]] = {}
    media_by_lesson: dict[uuid.UUID, Media] = {}
    if module_ids:
        lessons = (
            (
                await session.execute(
                    select(Lesson)
                    .where(Lesson.module_id.in_(module_ids))
                    .order_by(Lesson.sort_order)
                )
            )
            .scalars()
            .all()
        )
        for lesson in lessons:
            lessons_by_module.setdefault(lesson.module_id, []).append(lesson)
        if lessons:
            media_rows = (
                (
                    await session.execute(
                        select(Media).where(Media.lesson_id.in_([lesson.id for lesson in lessons]))
                    )
                )
                .scalars()
                .all()
            )
            media_by_lesson = {m.lesson_id: m for m in media_rows}

    return CourseDetailOut(
        id=str(course.id), slug=course.slug, title=course.title,
        subtitle=course.subtitle, description=course.description, published=course.published,
        modules=[
            ModuleOut(
                id=str(m.id), title=m.title, description=m.description, sort_order=m.sort_order,
                lessons=[
                    _lesson_out(lesson, media_by_lesson.get(lesson.id))
                    for lesson in lessons_by_module.get(m.id, [])
                ],
            )
            for m in modules
        ],
    )


@router.post("/admin/courses", response_model=CourseDetailOut, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    section_id = (await session.execute(select(Section.id).limit(1))).scalar_one_or_none()
    author_id = (await session.execute(select(Author.id).limit(1))).scalar_one_or_none()
    if section_id is None or author_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "missing_prerequisites",
                    "message": "A section and an author must exist before courses can be created.",
                }
            },
        )
    course = Course(
        slug=await ensure_unique_slug(session, Course, slugify(payload.title)),
        title=payload.title, subtitle=payload.subtitle, description=payload.description,
        section_id=section_id, author_id=author_id, published=False,
    )
    session.add(course)
    await session.flush()
    await record_audit(
        session, actor=admin, action="create_course", target_type="course",
        target_id=course.id, context={"title": course.title},
    )
    await session.commit()
    return await get_course(course.id, session)


@router.put("/admin/courses/{course_id}", response_model=CourseDetailOut)
async def update_course(
    course_id: uuid.UUID,
    payload: CourseWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    course = await get_or_404(session, Course, course_id, "Course")
    course.title = payload.title
    course.subtitle = payload.subtitle
    course.description = payload.description
    await record_audit(
        session, actor=admin, action="update_course", target_type="course",
        target_id=course.id, context={"title": course.title},
    )
    await session.commit()
    return await get_course(course_id, session)


class PublishIn(BaseModel):
    published: bool


@router.post("/admin/courses/{course_id}/publish", response_model=CourseDetailOut)
async def set_course_published(
    course_id: uuid.UUID,
    payload: PublishIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    course = await get_or_404(session, Course, course_id, "Course")
    was = course.published
    course.published = payload.published
    await record_audit(
        session, actor=admin,
        action="publish_course" if payload.published else "unpublish_course",
        target_type="course", target_id=course.id, context={"from": was, "to": payload.published},
    )
    await session.commit()
    return await get_course(course_id, session)


# ── Modules ──────────────────────────────────────────────────────────────────────

class ModuleWriteIn(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: Optional[str] = None
    sort_order: Optional[int] = None


@router.post("/admin/courses/{course_id}/modules", response_model=CourseDetailOut, status_code=status.HTTP_201_CREATED)
async def create_module(
    course_id: uuid.UUID,
    payload: ModuleWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    course = await get_or_404(session, Course, course_id, "Course")
    # Default to the end of the list. Asking an editor to type a sort order for a
    # module they're appending is exposing an implementation detail as a form field.
    sort_order = payload.sort_order
    if sort_order is None:
        highest = (
            await session.execute(
                select(func.max(Module.sort_order)).where(Module.course_id == course.id)
            )
        ).scalar()
        sort_order = (highest or 0) + 1
    module = Module(
        course_id=course.id, title=payload.title,
        description=payload.description, sort_order=sort_order,
    )
    session.add(module)
    await session.flush()
    await record_audit(
        session, actor=admin, action="create_module", target_type="module",
        target_id=module.id, context={"course": course.slug, "title": module.title},
    )
    await session.commit()
    return await get_course(course_id, session)


@router.put("/admin/modules/{module_id}", response_model=CourseDetailOut)
async def update_module(
    module_id: uuid.UUID,
    payload: ModuleWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    module = await get_or_404(session, Module, module_id, "Module")
    module.title = payload.title
    module.description = payload.description
    if payload.sort_order is not None:
        module.sort_order = payload.sort_order
    await record_audit(
        session, actor=admin, action="update_module", target_type="module",
        target_id=module.id, context={"title": module.title},
    )
    await session.commit()
    return await get_course(module.course_id, session)


# ── Lessons ──────────────────────────────────────────────────────────────────────

class LessonWriteIn(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    lesson_type: LessonType
    description: Optional[str] = None
    # Required in practice for reading/mixed lessons; validated on publish, not on
    # save, so a draft can be written across several sittings.
    body: Optional[str] = None
    download_template_id: Optional[uuid.UUID] = None
    sort_order: Optional[int] = None


async def _course_id_for_lesson(session: AsyncSession, lesson: Lesson) -> uuid.UUID:
    module = await session.get(Module, lesson.module_id)
    return module.course_id


@router.post("/admin/modules/{module_id}/lessons", response_model=CourseDetailOut, status_code=status.HTTP_201_CREATED)
async def create_lesson(
    module_id: uuid.UUID,
    payload: LessonWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    module = await get_or_404(session, Module, module_id, "Module")
    if payload.download_template_id is not None:
        await get_or_404(session, Template, payload.download_template_id, "Template")

    sort_order = payload.sort_order
    if sort_order is None:
        highest = (
            await session.execute(
                select(func.max(Lesson.sort_order)).where(Lesson.module_id == module.id)
            )
        ).scalar()
        sort_order = (highest or 0) + 1

    lesson = Lesson(
        slug=await ensure_unique_slug(session, Lesson, slugify(payload.title)),
        title=payload.title, description=payload.description,
        lesson_type=payload.lesson_type, body=payload.body,
        download_template_id=payload.download_template_id,
        module_id=module.id, sort_order=sort_order, published=False,
    )
    session.add(lesson)
    await session.flush()
    await record_audit(
        session, actor=admin, action="create_lesson", target_type="lesson",
        target_id=lesson.id, context={"module": str(module.id), "title": lesson.title},
    )
    await session.commit()
    return await get_course(module.course_id, session)


@router.put("/admin/lessons/{lesson_id}", response_model=CourseDetailOut)
async def update_lesson(
    lesson_id: uuid.UUID,
    payload: LessonWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    lesson = await get_or_404(session, Lesson, lesson_id, "Lesson")
    if payload.download_template_id is not None:
        await get_or_404(session, Template, payload.download_template_id, "Template")
    lesson.title = payload.title
    lesson.description = payload.description
    lesson.lesson_type = payload.lesson_type
    lesson.body = payload.body
    lesson.download_template_id = payload.download_template_id
    if payload.sort_order is not None:
        lesson.sort_order = payload.sort_order
    await record_audit(
        session, actor=admin, action="update_lesson", target_type="lesson",
        target_id=lesson.id, context={"title": lesson.title},
    )
    await session.commit()
    return await get_course(await _course_id_for_lesson(session, lesson), session)


class LessonVideoIn(BaseModel):
    """Mux ids, pasted from the Mux dashboard after an upload there.

    Deliberately NOT a video upload endpoint. Mux's own direct-upload flow hands the
    browser a one-time signed URL and handles multi-GB resumable transfer, retries and
    encoding; proxying video bytes through this API would be strictly worse at all
    three and would tie up a worker for the length of the upload. Pasting the asset/
    playback id is the honest interim: it's two fields, it works today, and it leaves
    the direct-upload integration as an isolated later change to this one endpoint.
    """
    mux_asset_id: str = Field(min_length=1, max_length=255)
    mux_playback_id: str = Field(min_length=1, max_length=255)
    duration_seconds: Optional[int] = None


@router.put("/admin/lessons/{lesson_id}/video", response_model=CourseDetailOut)
async def set_lesson_video(
    lesson_id: uuid.UUID,
    payload: LessonVideoIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    lesson = await get_or_404(session, Lesson, lesson_id, "Lesson")
    media = (
        await session.execute(select(Media).where(Media.lesson_id == lesson.id))
    ).scalar_one_or_none()
    if media is None:
        media = Media(lesson_id=lesson.id)
        session.add(media)
    media.mux_asset_id = payload.mux_asset_id
    media.mux_playback_id = payload.mux_playback_id
    media.duration_seconds = payload.duration_seconds
    media.status = MediaStatus.READY
    await record_audit(
        session, actor=admin, action="set_lesson_video", target_type="lesson",
        target_id=lesson.id, context={"playback_id": payload.mux_playback_id},
    )
    await session.commit()
    return await get_course(await _course_id_for_lesson(session, lesson), session)


@router.post("/admin/lessons/{lesson_id}/publish", response_model=CourseDetailOut)
async def set_lesson_published(
    lesson_id: uuid.UUID,
    payload: PublishIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Publishing is refused unless the lesson actually has its content.

    This is the check that stops the most expensive failure mode in the product: a
    published video lesson with no Mux asset renders an empty player to someone who
    just paid for the course, and nothing else in the system would catch it.
    """
    lesson = await get_or_404(session, Lesson, lesson_id, "Lesson")
    if payload.published:
        media = (
            await session.execute(select(Media).where(Media.lesson_id == lesson.id))
        ).scalar_one_or_none()
        out = _lesson_out(lesson, media)
        if not out.is_ready:
            missing = {
                LessonType.VIDEO: "a video",
                LessonType.MIXED: "a video and written body",
                LessonType.READING: "a written body",
                LessonType.DOWNLOAD: "a downloadable file",
            }.get(lesson.lesson_type, "its content")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": {
                        "code": "lesson_incomplete",
                        "message": f"Add {missing} before publishing this lesson.",
                    }
                },
            )
    was = lesson.published
    lesson.published = payload.published
    await record_audit(
        session, actor=admin,
        action="publish_lesson" if payload.published else "unpublish_lesson",
        target_type="lesson", target_id=lesson.id, context={"from": was, "to": payload.published},
    )
    await session.commit()
    return await get_course(await _course_id_for_lesson(session, lesson), session)
