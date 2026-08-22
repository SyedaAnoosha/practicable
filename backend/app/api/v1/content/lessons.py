"""The member learning interface's data: one endpoint returns the lesson's content plus
the whole course outline, so /learn/:courseSlug/:lessonSlug renders its sidebar without a
second round trip. Video and download URLs stay on separate short-lived endpoints, minted
only after the entitlement check rather than embedded in this payload.
"""
import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_current_user_optional
from app.core.entitlements import ResourceType, has_access_to, has_access_to_or_admin
from app.db.models import (
    Course,
    CourseProgress,
    Lesson,
    LessonBlock,
    LessonBlockType,
    LessonProgress,
    Media,
    Module,
    ModuleQuestion,
    Question,
    Template,
    User,
)
from app.db.session import get_session
from app.integrations.mux_client import generate_mux_playback_token
from app.integrations.storage_client import download_file, generate_presigned_url, upload_file
from app.services.download_events import record_download_event
from app.services.stamping import get_or_stamp, is_stampable
from app.services.link_rate_limit import check_and_record as check_link_rate

router = APIRouter()


def _lesson_type_value(lesson_type) -> str:
    return lesson_type.value if hasattr(lesson_type, "value") else lesson_type


async def _lesson_entitled(*, lesson: Lesson, user_id: Optional[str], session: AsyncSession) -> bool:
    """No free-preview bypass — lessons and video are never free.

    Deliberately plain — no admin bypass. Used for the course-outline sidebar's per-lesson
    `locked` icon, which is cosmetic navigation state, not a decision about whether
    protected content (body/video/file) is served. Writing an audited bypass row for every
    lesson in a sidebar an admin happens to scroll past would flood the audit log with
    events that reveal nothing sensitive; the routes that actually serve content
    (`get_playback_token`, `get_lesson_download_url`, `mark_lesson_complete`, and the
    single "current lesson" body below) use `_lesson_entitled_or_admin` instead.
    """
    if not user_id:
        return False
    return await has_access_to(
        user_id=uuid.UUID(user_id), resource_type=ResourceType.LESSON, resource_id=lesson.id, session=session
    )


async def _lesson_entitled_or_admin(*, lesson: Lesson, user: Optional[User], session: AsyncSession) -> bool:
    """The content-serving counterpart to `_lesson_entitled` above, with an audited
    admin bypass. Takes the resolved `User`, not just an id string."""
    if not user:
        return False
    return await has_access_to_or_admin(
        user=user, resource_type=ResourceType.LESSON, resource_id=lesson.id, session=session
    )


class PlaybackTokenOut(BaseModel):
    playback_id: str
    token: str


class LessonDownloadOut(BaseModel):
    file_name: str
    file_size_bytes: int
    # True when the underlying template is the free lead magnet — downloadable even by
    # a visitor who hasn't bought the course.
    is_free: bool = False


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
    """A question attached to the module — always public, so it carries no lock state."""
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


class LessonBlockOut(BaseModel):
    """One ordered piece of the lesson's content. `body`/`download` above stay populated
    too for backfilled single-block lessons, but new mixed-content lessons exist only
    here, as a sequence.

    No URL or Mux token is ever embedded: a `video`/`file` block's content is minted on
    demand from `id` via its own playback-token/download-url endpoint — check, then
    mint, never embed a link that outlives the check that authorized it.
    """

    id: str
    block_type: str
    sort_order: int
    # text / callout only.
    heading: Optional[str] = None
    text_body: Optional[str] = None
    prose_sanitized: Optional[str] = None  # Phase 8 (8E): sanitized HTML, null for plain text
    # video only — readiness, nothing else; the token comes from its own endpoint.
    video_ready: Optional[bool] = None
    # file only — mirrors LessonDownloadOut; the URL comes from its own endpoint.
    file_name: Optional[str] = None
    file_size_bytes: Optional[int] = None
    file_is_free: Optional[bool] = None


class LessonDetailOut(BaseModel):
    id: str
    slug: str
    title: str
    description: Optional[str]
    lesson_type: str
    body: Optional[str]
    prose_sanitized: Optional[str] = None  # Phase 8 (8E): sanitized HTML, null for plain-text lessons
    download: Optional[LessonDownloadOut]
    blocks: list[LessonBlockOut]
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
    user: Optional[User] = Depends(get_current_user_optional),
):
    """Powers /learn/:courseSlug/:lessonSlug. Public at the API layer; the frontend still
    keeps the /learn route behind the member auth guard."""
    user_id = str(user.id) if user else None
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

    # Decides whether `body` is returned below — unlike the sidebar loop's
    # `_lesson_entitled` calls further down, which only decide a lock icon.
    entitled = await _lesson_entitled_or_admin(lesson=lesson, user=user, session=session)

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

        # Always free, so they ride alongside the lesson list with no lock state.
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

    # Same per-block-type gating as the lesson-level fields below: text/video blocks
    # have no free-preview mechanic, but a `file` block whose template is the free lead
    # magnet stays free wherever it appears, matching `download_out`'s rule below.
    lesson_blocks = (
        (
            await session.execute(
                select(LessonBlock)
                .where(LessonBlock.lesson_id == lesson.id)
                .options(selectinload(LessonBlock.media), selectinload(LessonBlock.template))
                .order_by(LessonBlock.sort_order)
            )
        )
        .scalars()
        .all()
    )
    block_outs: list[LessonBlockOut] = []
    for b in lesson_blocks:
        b_type = _lesson_type_value(b.block_type)
        if b_type in ("text", "callout"):
            if not entitled:
                continue
            block_outs.append(
                LessonBlockOut(
                    id=str(b.id), block_type=b_type, sort_order=b.sort_order,
                    heading=b.heading, text_body=b.text_body,
                    prose_sanitized=b.prose_sanitized,
                )
            )
        elif b_type == "video":
            if not entitled:
                continue
            ready = b.media is not None and b.media.status == "ready" and bool(b.media.mux_playback_id)
            block_outs.append(
                LessonBlockOut(id=str(b.id), block_type=b_type, sort_order=b.sort_order, video_ready=ready)
            )
        elif b_type == "file":
            if not b.template or not (entitled or b.template.is_free):
                continue
            block_outs.append(
                LessonBlockOut(
                    id=str(b.id),
                    block_type=b_type,
                    sort_order=b.sort_order,
                    file_name=b.template.file_name,
                    file_size_bytes=b.template.file_size_bytes,
                    file_is_free=b.template.is_free,
                )
            )

    # A free template stays free wherever it appears — the same file can't be free on
    # /templates and paywalled inside a course. The lesson's own writing is still
    # gated by `entitled`; only the artefact is exempt.
    download_out = None
    if lesson.download_template_id:
        template = (
            await session.execute(select(Template).where(Template.id == lesson.download_template_id))
        ).scalar_one_or_none()
        if template and (entitled or template.is_free):
            download_out = LessonDownloadOut(
                file_name=template.file_name,
                file_size_bytes=template.file_size_bytes,
                is_free=template.is_free,
            )

    return LessonDetailOut(
        id=str(lesson.id),
        slug=lesson.slug,
        title=lesson.title,
        description=lesson.description,
        lesson_type=_lesson_type_value(lesson.lesson_type),
        body=lesson.body if entitled else None,
        prose_sanitized=lesson.prose_sanitized if entitled else None,
        download=download_out,
        blocks=block_outs,
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
    user: User = Depends(get_current_user),
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

    # Checked before Mux is called — a signed URL minted then discarded still existed.
    entitled = await _lesson_entitled_or_admin(lesson=lesson, user=user, session=session)
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
    # Optional so a free template inside a course is downloadable with no account, as on
    # /templates. Paid artefacts still 401 below. The full User, not just the id, so an
    # admin without the entitlement gets the audited bypass rather than a plain 403.
    user: Optional[User] = Depends(get_current_user_optional),
):
    """The download-type lesson's artefact, gated by LESSON entitlement — unless the
    underlying template is the free lead magnet, in which case it's free here too. Must
    agree with templates.py's TEMPLATE-gated path about whether a file costs money.
    """
    lesson = (
        await session.execute(select(Lesson).where(Lesson.id == uuid.UUID(lesson_id)))
    ).scalar_one_or_none()
    if not lesson or not lesson.download_template_id:
        raise HTTPException(status_code=404, detail="No downloadable file on this lesson")

    template = (
        await session.execute(select(Template).where(Template.id == lesson.download_template_id))
    ).scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="File not found")

    # Free means free: no entitlement, no account, no check — same rule as templates.py.
    if not template.is_free:
        if user is None:
            raise HTTPException(
                status_code=401,
                detail={"error": {"code": "not_authenticated", "message": "Sign in to download this file."}},
            )
        entitled = await _lesson_entitled_or_admin(lesson=lesson, user=user, session=session)
        if not entitled:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": {
                        "code": "not_entitled",
                        "message": "This lesson is part of a course you don't have yet.",
                    }
                },
            )

    # Phase 8F step 11: soft rate-limit on link minting. Logs, never blocks.
    if user is not None:
        check_link_rate(str(user.id), str(template.id))

    # Phase 8F (W4-R16): Stamp paid downloads with buyer info.
    # Free templates are never stamped (rule 3); unstampable types served unchanged (rule 2).
    if not template.is_free and user is not None and is_stampable(template.file_name):
        original_bytes = await asyncio.to_thread(download_file, template.storage_key)
        if original_bytes:
            # Find licence tier from the product that grants this template
            from app.db.models import Product, ProductContent
            product_result = await session.execute(
                select(Product).join(ProductContent).where(
                    ProductContent.content_id == template.id,
                    ProductContent.content_type == "template",
                )
            )
            product = product_result.scalar_one_or_none()
            licence_tier = product.licence if product else "standard"

            stamped_bytes = await asyncio.to_thread(
                get_or_stamp,
                original_bytes,
                template_id=str(template.id),
                file_name=template.file_name,
                version=template.version,
                buyer_email=user.email,
                buyer_name=user.name or user.email,
                licence_tier=licence_tier,
                user_id=str(user.id),
            )
            ext = "." + template.file_name.rsplit(".", 1)[-1].lower() if "." in template.file_name else ""
            stamped_key = f"stamped/{template.id}/{template.version or 'unversioned'}/{user.id}{ext}"
            content_type_map = {
                ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".pdf": "application/pdf",
            }
            try:
                await asyncio.to_thread(
                    upload_file,
                    key=stamped_key,
                    body=stamped_bytes,
                    content_type=content_type_map.get(ext, "application/octet-stream"),
                )
                download_url = generate_presigned_url(stamped_key)
            except Exception:
                # Rule 1: stamping failure serves the original file
                download_url = generate_presigned_url(template.storage_key)
        else:
            download_url = generate_presigned_url(template.storage_key)
    else:
        download_url = generate_presigned_url(template.storage_key)

    await record_download_event(session=session, content_type="lesson_file", content_id=template.id, content_slug=template.slug)
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
    user: User = Depends(get_current_user),
):
    """The "Mark complete" button. Recomputes the CourseProgress rollup live, so the
    catalogue's percentage badge and the outline's checkmarks can't drift apart."""
    user_id = str(user.id)
    lesson_uuid = uuid.UUID(lesson_id)
    lesson = (await session.execute(select(Lesson).where(Lesson.id == lesson_uuid))).scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    entitled = await _lesson_entitled_or_admin(lesson=lesson, user=user, session=session)
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


# ── Block-scoped content endpoints ─────────────────────────────────────────────────
# Entitlement is checked once per lesson, not per block, but each video block still
# mints its own short-lived Mux token and each file block its own presigned URL. The
# lesson-scoped endpoints above still work for every backfilled single-block lesson;
# these are the new path for a lesson with more than one video or file block.


@router.get("/lesson-blocks/{block_id}/playback-token", response_model=PlaybackTokenOut)
async def get_block_playback_token(
    block_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Block-scoped counterpart to /lessons/{lesson_id}/playback-token. Entitlement is
    checked against the block's parent lesson — buying a lesson unlocks every block —
    but the Mux token is minted for this block's own media row."""
    block = (
        await session.execute(
            select(LessonBlock)
            .where(LessonBlock.id == uuid.UUID(block_id))
            .options(selectinload(LessonBlock.media), selectinload(LessonBlock.lesson))
        )
    ).scalar_one_or_none()
    if not block or block.block_type != LessonBlockType.VIDEO:
        raise HTTPException(status_code=404, detail="Video block not found")

    media = block.media
    if not media or not media.mux_playback_id:
        raise HTTPException(status_code=404, detail="Video not ready")
    if media.status != "ready":
        raise HTTPException(status_code=400, detail="Video still processing")

    # Checked before Mux is called — a signed URL minted then discarded still existed.
    entitled = await _lesson_entitled_or_admin(lesson=block.lesson, user=user, session=session)
    if not entitled:
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "not_entitled", "message": "This lesson is part of a course you don't have yet."}},
        )

    token = generate_mux_playback_token(media.mux_playback_id)
    return PlaybackTokenOut(playback_id=media.mux_playback_id, token=token)


@router.get("/lesson-blocks/{block_id}/download-url", response_model=LessonDownloadUrlOut)
async def get_block_download_url(
    block_id: str,
    session: AsyncSession = Depends(get_session),
    # Optional for the same reason as the lesson-scoped endpoint: a free-template file
    # block is downloadable with no account at all.
    user: Optional[User] = Depends(get_current_user_optional),
):
    """Block-scoped counterpart to /lessons/{lesson_id}/download-url — same free-template
    exception and entitlement-on-the-parent-lesson rule as get_block_playback_token."""
    block = (
        await session.execute(
            select(LessonBlock)
            .where(LessonBlock.id == uuid.UUID(block_id))
            .options(selectinload(LessonBlock.template), selectinload(LessonBlock.lesson))
        )
    ).scalar_one_or_none()
    if not block or block.block_type != LessonBlockType.FILE:
        raise HTTPException(status_code=404, detail="File block not found")

    template = block.template
    if not template:
        raise HTTPException(status_code=404, detail="File not found")

    if not template.is_free:
        if user is None:
            raise HTTPException(
                status_code=401,
                detail={"error": {"code": "not_authenticated", "message": "Sign in to download this file."}},
            )
        entitled = await _lesson_entitled_or_admin(lesson=block.lesson, user=user, session=session)
        if not entitled:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": {
                        "code": "not_entitled",
                        "message": "This lesson is part of a course you don't have yet.",
                    }
                },
            )

    download_url = generate_presigned_url(template.storage_key)
    await record_download_event(session=session, content_type="lesson_file", content_id=template.id, content_slug=template.slug)
    return LessonDownloadUrlOut(
        download_url=download_url, file_name=template.file_name, file_size_bytes=template.file_size_bytes
    )
