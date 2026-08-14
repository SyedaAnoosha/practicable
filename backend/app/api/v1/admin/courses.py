"""Admin CRUD for courses, their modules, and their lessons — including attaching a
Mux video and a downloadable file to a lesson, and (week2_plan.md Phase 2) an ordered
sequence of content blocks for mixed-content lessons.
"""
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import require_admin
from app.db.models import (
    Author,
    Course,
    Lesson,
    LessonBlock,
    LessonBlockType,
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


class LessonBlockOut(BaseModel):
    id: str
    block_type: str
    sort_order: int
    # text / callout only.
    heading: Optional[str]
    text_body: Optional[str]
    # video only — the underlying Mux id, so the editor can show whether it's attached.
    media_id: Optional[str]
    mux_playback_id: Optional[str]
    # file only.
    template_id: Optional[str]
    template_file_name: Optional[str]


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
    # A video lesson with no Mux asset renders an empty player after purchase — surfaced
    # so the editor can block publishing it.
    is_ready: bool
    # Ordered content blocks (week2_plan.md Phase 2). Populated for every lesson, not
    # only `mixed` ones — a video/reading/download lesson still carries the one block
    # the migration backfilled it into, so the editor can show it read-only alongside
    # the legacy fields above rather than presenting two disagreeing sources of truth.
    blocks: list[LessonBlockOut]


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


def _enum_value(v) -> str:
    return v.value if hasattr(v, "value") else str(v)


def _block_out(b: LessonBlock) -> LessonBlockOut:
    return LessonBlockOut(
        id=str(b.id), block_type=_enum_value(b.block_type), sort_order=b.sort_order,
        heading=b.heading, text_body=b.text_body,
        media_id=str(b.media_id) if b.media_id else None,
        mux_playback_id=b.media.mux_playback_id if b.media else None,
        template_id=str(b.template_id) if b.template_id else None,
        template_file_name=b.template.file_name if b.template else None,
    )


def _lesson_out(lesson: Lesson, media: Optional[Media], blocks: Optional[list[LessonBlock]] = None) -> LessonOut:
    blocks = blocks or []
    playback_id = media.mux_playback_id if media else None
    if lesson.lesson_type == LessonType.MIXED:
        # A MIXED lesson is authored entirely through blocks (week2_plan.md Phase 2),
        # not the legacy body/media/download_template_id fields, which stay unpopulated
        # for it — and it may legitimately hold more than one video block (more than one
        # Media row sharing this lesson_id), which the legacy single-`media` lookup
        # above cannot represent at all. Readiness is judged block-by-block instead:
        # step 7's rule — zero blocks, an unattached video block, or an unattached file
        # block all block publishing.
        is_ready = bool(blocks) and all(
            (b.block_type != LessonBlockType.VIDEO or (b.media is not None and bool(b.media.mux_playback_id)))
            and (b.block_type != LessonBlockType.FILE or b.template_id is not None)
            for b in blocks
        )
    else:
        needs_video = lesson.lesson_type == LessonType.VIDEO
        needs_body = lesson.lesson_type == LessonType.READING
        needs_file = lesson.lesson_type == LessonType.DOWNLOAD
        is_ready = (
            (not needs_video or bool(playback_id))
            and (not needs_body or bool(lesson.body))
            and (not needs_file or lesson.download_template_id is not None)
        )
    return LessonOut(
        id=str(lesson.id), slug=lesson.slug, title=lesson.title,
        description=lesson.description,
        lesson_type=_enum_value(lesson.lesson_type),
        body=lesson.body, sort_order=lesson.sort_order, published=lesson.published,
        download_template_id=str(lesson.download_template_id) if lesson.download_template_id else None,
        mux_playback_id=playback_id, is_ready=is_ready,
        blocks=[_block_out(b) for b in (blocks or [])],
    )


@router.get("/admin/courses", response_model=list[CourseRowOut])
async def list_courses(session: AsyncSession = Depends(get_session)):
    courses = (await session.execute(select(Course).order_by(Course.title))).scalars().all()
    if not courses:
        return []
    # Two grouped counts rather than a query per course, avoiding an N+1.
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
    blocks_by_lesson: dict[uuid.UUID, list[LessonBlock]] = {}
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
            lesson_ids = [lesson.id for lesson in lessons]
            media_rows = (
                (await session.execute(select(Media).where(Media.lesson_id.in_(lesson_ids))))
                .scalars()
                .all()
            )
            media_by_lesson = {m.lesson_id: m for m in media_rows}

            block_rows = (
                (
                    await session.execute(
                        select(LessonBlock)
                        .where(LessonBlock.lesson_id.in_(lesson_ids))
                        .options(selectinload(LessonBlock.media), selectinload(LessonBlock.template))
                        .order_by(LessonBlock.sort_order)
                    )
                )
                .scalars()
                .all()
            )
            for b in block_rows:
                blocks_by_lesson.setdefault(b.lesson_id, []).append(b)

    return CourseDetailOut(
        id=str(course.id), slug=course.slug, title=course.title,
        subtitle=course.subtitle, description=course.description, published=course.published,
        modules=[
            ModuleOut(
                id=str(m.id), title=m.title, description=m.description, sort_order=m.sort_order,
                lessons=[
                    _lesson_out(lesson, media_by_lesson.get(lesson.id), blocks_by_lesson.get(lesson.id))
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
    # Default to the end of the list, so appending doesn't need a sort-order field.
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
    # Required for reading/mixed lessons, but validated on publish rather than save so a
    # draft can be written across several sittings.
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

    Deliberately not a video upload endpoint: proxying video bytes through this API
    would tie up a worker for the length of the upload, where Mux's own direct-upload
    flow handles resumable transfer, retries and encoding. Swapping to that flow later
    is an isolated change to this one endpoint.
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
    """Publishing is refused unless the lesson actually has its content — otherwise a
    video lesson with no Mux asset renders an empty player to someone who just paid."""
    lesson = await get_or_404(session, Lesson, lesson_id, "Lesson")
    if payload.published:
        # `.first()`, not `scalar_one_or_none()` — a MIXED lesson with more than one
        # video block legitimately has more than one Media row sharing this lesson_id,
        # and this lookup is only ever used for the legacy single-media display/check
        # below, never authoritative for a MIXED lesson (see `_lesson_out`).
        media = (
            (await session.execute(select(Media).where(Media.lesson_id == lesson.id)))
            .scalars()
            .first()
        )
        blocks = (
            (
                await session.execute(
                    select(LessonBlock)
                    .where(LessonBlock.lesson_id == lesson.id)
                    .options(selectinload(LessonBlock.media), selectinload(LessonBlock.template))
                )
            )
            .scalars()
            .all()
        )
        out = _lesson_out(lesson, media, blocks)
        if not out.is_ready:
            missing = {
                LessonType.VIDEO: "a video",
                LessonType.MIXED: "at least one content block, with every video/file block attached",
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


# ── Lesson blocks (week2_plan.md Phase 2) ───────────────────────────────────────────
# Ordered content — text, video, file, callout — for a lesson authored as more than one
# piece. Reordering is up/down buttons, not drag-and-drop, per the plan's explicit
# choice: fewer moving parts, keyboard-operable for free, no drag library dependency.

class LessonBlockWriteIn(BaseModel):
    block_type: LessonBlockType
    # text / callout only.
    heading: Optional[str] = Field(default=None, max_length=500)
    text_body: Optional[str] = None
    # file only — an existing Template row's id (the same rows AdminTemplates.tsx
    # manages), not a new upload here.
    template_id: Optional[uuid.UUID] = None


async def _course_id_for_block(session: AsyncSession, block: LessonBlock) -> uuid.UUID:
    lesson = await get_or_404(session, Lesson, block.lesson_id, "Lesson")
    return await _course_id_for_lesson(session, lesson)


@router.post("/admin/lessons/{lesson_id}/blocks", response_model=CourseDetailOut, status_code=status.HTTP_201_CREATED)
async def create_lesson_block(
    lesson_id: uuid.UUID,
    payload: LessonBlockWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    lesson = await get_or_404(session, Lesson, lesson_id, "Lesson")
    if payload.template_id is not None:
        await get_or_404(session, Template, payload.template_id, "Template")

    highest = (
        await session.execute(select(func.max(LessonBlock.sort_order)).where(LessonBlock.lesson_id == lesson.id))
    ).scalar()
    sort_order = (highest + 1) if highest is not None else 0

    block = LessonBlock(
        lesson_id=lesson.id, sort_order=sort_order, block_type=payload.block_type,
        heading=payload.heading, text_body=payload.text_body, template_id=payload.template_id,
    )
    session.add(block)
    await session.flush()
    await record_audit(
        session, actor=admin, action="create_lesson_block", target_type="lesson_block",
        target_id=block.id, context={"lesson": str(lesson.id), "block_type": payload.block_type.value},
    )
    await session.commit()
    return await get_course(await _course_id_for_lesson(session, lesson), session)


@router.put("/admin/lesson-blocks/{block_id}", response_model=CourseDetailOut)
async def update_lesson_block(
    block_id: uuid.UUID,
    payload: LessonBlockWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    block = await get_or_404(session, LessonBlock, block_id, "Block")
    if payload.template_id is not None:
        await get_or_404(session, Template, payload.template_id, "Template")
    block.block_type = payload.block_type
    block.heading = payload.heading
    block.text_body = payload.text_body
    block.template_id = payload.template_id
    await record_audit(
        session, actor=admin, action="update_lesson_block", target_type="lesson_block",
        target_id=block.id, context={"block_type": payload.block_type.value},
    )
    await session.commit()
    return await get_course(await _course_id_for_block(session, block), session)


@router.delete("/admin/lesson-blocks/{block_id}", response_model=CourseDetailOut)
async def delete_lesson_block(
    block_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    block = await get_or_404(session, LessonBlock, block_id, "Block")
    course_id = await _course_id_for_block(session, block)
    await record_audit(
        session, actor=admin, action="delete_lesson_block", target_type="lesson_block",
        target_id=block.id, context={"lesson": str(block.lesson_id), "block_type": block.block_type.value},
    )
    await session.delete(block)
    await session.commit()
    return await get_course(course_id, session)


class BlockMoveIn(BaseModel):
    direction: Literal["up", "down"]


@router.post("/admin/lesson-blocks/{block_id}/move", response_model=CourseDetailOut)
async def move_lesson_block(
    block_id: uuid.UUID,
    payload: BlockMoveIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Swaps this block's sort_order with its immediate neighbour. A no-op (not an
    error) at either end of the list, so the editor's up/down buttons don't need to
    special-case disabling themselves against a race with another admin's edit."""
    block = await get_or_404(session, LessonBlock, block_id, "Block")
    siblings = (
        (
            await session.execute(
                select(LessonBlock).where(LessonBlock.lesson_id == block.lesson_id).order_by(LessonBlock.sort_order)
            )
        )
        .scalars()
        .all()
    )
    idx = next(i for i, b in enumerate(siblings) if b.id == block.id)
    swap_idx = idx - 1 if payload.direction == "up" else idx + 1

    if 0 <= swap_idx < len(siblings):
        other = siblings[swap_idx]
        # A three-step swap, not a direct exchange: `lesson_blocks` has a UNIQUE
        # (lesson_id, sort_order) constraint (009_lesson_blocks.py), checked immediately
        # per statement in Postgres (not deferred) — writing `other`'s old value onto
        # `block` while `other` still holds it collides mid-flush. -1 is never a real
        # sort_order (backfill and create both start at 0), so it's a safe scratch value.
        block_order, other_order = block.sort_order, other.sort_order
        block.sort_order = -1
        await session.flush()
        other.sort_order = block_order
        await session.flush()
        block.sort_order = other_order
        await record_audit(
            session, actor=admin, action="move_lesson_block", target_type="lesson_block",
            target_id=block.id, context={"direction": payload.direction},
        )
    await session.commit()
    return await get_course(await _course_id_for_block(session, block), session)


class LessonBlockVideoIn(BaseModel):
    """Same shape as `LessonVideoIn` above, scoped to one block instead of one lesson —
    what makes a MIXED lesson with more than one video block possible at all."""
    mux_asset_id: str = Field(min_length=1, max_length=255)
    mux_playback_id: str = Field(min_length=1, max_length=255)
    duration_seconds: Optional[int] = None


@router.put("/admin/lesson-blocks/{block_id}/video", response_model=CourseDetailOut)
async def set_lesson_block_video(
    block_id: uuid.UUID,
    payload: LessonBlockVideoIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    block = await get_or_404(session, LessonBlock, block_id, "Block")
    if block.block_type != LessonBlockType.VIDEO:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "wrong_block_type", "message": "This block is not a video block."}},
        )
    media = (
        (await session.execute(select(Media).where(Media.id == block.media_id))).scalar_one_or_none()
        if block.media_id
        else None
    )
    if media is None:
        # `lesson_id` is a NOT NULL legacy column on `media` (pre-blocks schema) — set to
        # this block's lesson so the row is still valid, but `block.media_id` (set below)
        # is what actually associates it with THIS block, not lesson-wide uniqueness.
        media = Media(lesson_id=block.lesson_id)
        session.add(media)
        await session.flush()
        block.media_id = media.id
    media.mux_asset_id = payload.mux_asset_id
    media.mux_playback_id = payload.mux_playback_id
    media.duration_seconds = payload.duration_seconds
    media.status = MediaStatus.READY
    await record_audit(
        session, actor=admin, action="set_lesson_block_video", target_type="lesson_block",
        target_id=block.id, context={"playback_id": payload.mux_playback_id},
    )
    await session.commit()
    return await get_course(await _course_id_for_block(session, block), session)
