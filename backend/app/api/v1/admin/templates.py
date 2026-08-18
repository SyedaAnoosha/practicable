"""Admin CRUD for templates, including the downloadable file upload."""
import asyncio
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.models import Author, Section, Template, User
from app.db.session import get_session
from app.integrations.storage_client import delete_file, generate_presigned_upload_url, head_object, upload_file

from .common import PublishStateIn, apply_publish_state_or_422, ensure_unique_slug, get_or_404, record_audit, slugify

router = APIRouter()

# Templates are documents, not video. Uploads are buffered in memory, so this bound is
# what keeps that safe.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

# An allow-list rather than a deny-list: this bucket serves files to paying customers.
ALLOWED_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx
    "application/vnd.ms-excel",  # .xls
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "application/msword",  # .doc
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # .pptx
    "application/vnd.ms-powerpoint",  # .ppt
    "application/pdf",
    "text/csv",
    "application/zip",
}


class TemplateWriteIn(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str = Field(min_length=1)
    # Defaults to False so a template is never given away by omitting a field.
    is_free: bool = False


class TemplateOut(BaseModel):
    id: str
    slug: str
    title: str
    description: str
    file_name: str
    file_size_bytes: int
    mime_type: str
    published: bool
    publish_state: str
    is_free: bool
    # False until a file has been uploaded; the editor uses it to block publishing, which
    # would otherwise put a buyable product on the site whose download 404s after payment.
    has_file: bool


def _to_out(t: Template) -> TemplateOut:
    return TemplateOut(
        id=str(t.id), slug=t.slug, title=t.title, description=t.description,
        file_name=t.file_name, file_size_bytes=t.file_size_bytes,
        mime_type=t.mime_type, published=t.published, publish_state=t.publish_state.value, is_free=t.is_free,
        has_file=bool(t.storage_key),
    )


@router.get("/admin/templates", response_model=list[TemplateOut])
async def list_templates(session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(select(Template).order_by(Template.title))).scalars().all()
    return [_to_out(t) for t in rows]


@router.get("/admin/templates/{template_id}", response_model=TemplateOut)
async def get_template(template_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    return _to_out(await get_or_404(session, Template, template_id, "Template"))


@router.post("/admin/templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: TemplateWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Creates the row only. The file arrives via the upload endpoint below, so that
    editing wording and replacing the customer-facing artefact stay separate actions."""
    # section_id/author_id are NOT NULL but aren't an editorial concern — there is one of
    # each, and asking an editor to pick would expose a schema detail as a form field.
    section_id = (await session.execute(select(Section.id).limit(1))).scalar_one_or_none()
    author_id = (await session.execute(select(Author.id).limit(1))).scalar_one_or_none()
    if section_id is None or author_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "missing_prerequisites",
                    "message": "A section and an author must exist before templates can be created.",
                }
            },
        )

    template = Template(
        slug=await ensure_unique_slug(session, Template, slugify(payload.title)),
        title=payload.title,
        description=payload.description,
        section_id=section_id,
        author_id=author_id,
        storage_key="",
        file_name="",
        file_size_bytes=0,
        mime_type="",
        published=False,
        is_free=payload.is_free,
    )
    session.add(template)
    await session.flush()
    await record_audit(
        session, actor=admin, action="create_template", target_type="template",
        target_id=template.id, context={"title": template.title},
    )
    await session.commit()
    return _to_out(template)


@router.put("/admin/templates/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: uuid.UUID,
    payload: TemplateWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    template = await get_or_404(session, Template, template_id, "Template")
    template.title = payload.title
    template.description = payload.description
    template.is_free = payload.is_free
    # Slug is not regenerated on retitle, so shared URLs keep working.
    await record_audit(
        session, actor=admin, action="update_template", target_type="template",
        target_id=template.id, context={"title": template.title, "is_free": template.is_free},
    )
    await session.commit()
    return _to_out(template)


@router.post("/admin/templates/{template_id}/file", response_model=TemplateOut)
async def upload_template_file(
    template_id: uuid.UUID,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Upload or replace the downloadable artefact. Bytes are buffered in memory (bounded
    by MAX_UPLOAD_BYTES) and written in a thread, since boto3 would block the event loop."""
    template = await get_or_404(session, Template, template_id, "Template")

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "empty_file", "message": "That file is empty."}},
        )
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": {
                    "code": "file_too_large",
                    "message": f"Files must be under {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
                }
            },
        )
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "error": {
                    "code": "unsupported_type",
                    "message": f"{content_type} isn't an accepted template format.",
                }
            },
        )

    # The template id lets two templates share a filename; the uuid4 means a replacement
    # writes a new object rather than swapping bytes under an already-presigned download
    # link. The old object is deleted after the row points at the new one.
    previous_key = template.storage_key
    safe_name = slugify(file.filename or "template") or "template"
    new_key = f"templates/{template.id}/{uuid.uuid4().hex}-{safe_name}"

    await asyncio.to_thread(upload_file, key=new_key, body=content, content_type=content_type)

    template.storage_key = new_key
    template.file_name = file.filename or safe_name
    template.file_size_bytes = len(content)
    template.mime_type = content_type
    await record_audit(
        session, actor=admin, action="upload_template_file", target_type="template",
        target_id=template.id,
        context={"file_name": template.file_name, "bytes": len(content), "replaced": bool(previous_key)},
    )
    await session.commit()

    if previous_key and previous_key != new_key:
        # Best-effort: the row is already committed. An orphaned object beats failing a
        # request whose upload succeeded.
        try:
            await asyncio.to_thread(delete_file, previous_key)
        except Exception:  # noqa: BLE001 — deliberately swallowed, see above
            pass

    return _to_out(template)


class UploadUrlIn(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str
    file_size_bytes: int = Field(gt=0)


class UploadUrlOut(BaseModel):
    upload_url: str
    storage_key: str
    expires_in: int


@router.post("/admin/templates/{template_id}/upload-url", response_model=UploadUrlOut)
async def create_template_upload_url(
    template_id: uuid.UUID,
    payload: UploadUrlIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """week3_plan.md Phase 5 step 2 — a presigned Storage PUT url the browser writes
    directly to, so a large template pack no longer has to be buffered in memory and
    proxied through this API. Type and size are validated here, BEFORE a URL is even
    issued — stated to the editor before a file is chosen, not discovered after a
    failed upload (§20.4). `upload_template_file` above still exists for anything that
    calls it directly; this is the path `UploadField` uses.
    """
    await get_or_404(session, Template, template_id, "Template")  # 404s a bad id early

    if payload.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"error": {"code": "unsupported_type", "message": f"{payload.content_type} isn't an accepted template format."}},
        )
    if payload.file_size_bytes > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"error": {"code": "file_too_large", "message": f"That file is {payload.file_size_bytes / (1024 * 1024):.0f}MB. The ceiling is {MAX_UPLOAD_BYTES // (1024 * 1024)}MB."}},
        )

    safe_name = slugify(payload.file_name) or "template"
    storage_key = f"templates/{template_id}/{uuid.uuid4().hex}-{safe_name}"
    expiry_seconds = 300
    upload_url = generate_presigned_upload_url(key=storage_key, content_type=payload.content_type, expiry_seconds=expiry_seconds)
    return UploadUrlOut(upload_url=upload_url, storage_key=storage_key, expires_in=expiry_seconds)


class UploadConfirmIn(BaseModel):
    storage_key: str
    file_name: str = Field(min_length=1, max_length=255)


@router.post("/admin/templates/{template_id}/upload-url/confirm", response_model=TemplateOut)
async def confirm_template_upload(
    template_id: uuid.UUID,
    payload: UploadConfirmIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Called once the browser's direct PUT to `storage_key` has completed. Verifies
    the object actually landed via a real `HEAD` against Storage — server-verified
    size/type, never the client's own say-so — then updates the row exactly as
    `upload_template_file` does, including deleting the superseded object."""
    template = await get_or_404(session, Template, template_id, "Template")

    meta = await asyncio.to_thread(head_object, payload.storage_key)
    if meta is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "upload_not_found", "message": "That upload hasn't landed in storage yet — try again in a moment."}},
        )
    content_length = meta.get("content_length") or 0
    if content_length > MAX_UPLOAD_BYTES:
        await asyncio.to_thread(delete_file, payload.storage_key)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"error": {"code": "file_too_large", "message": f"That file is {content_length / (1024 * 1024):.0f}MB. The ceiling is {MAX_UPLOAD_BYTES // (1024 * 1024)}MB."}},
        )

    previous_key = template.storage_key
    template.storage_key = payload.storage_key
    template.file_name = payload.file_name
    template.file_size_bytes = content_length
    template.mime_type = meta.get("content_type") or template.mime_type or "application/octet-stream"
    await record_audit(
        session, actor=admin, action="upload_template_file", target_type="template",
        target_id=template.id,
        context={"file_name": template.file_name, "bytes": content_length, "replaced": bool(previous_key), "via": "presigned"},
    )
    await session.commit()

    if previous_key and previous_key != payload.storage_key:
        try:
            await asyncio.to_thread(delete_file, previous_key)
        except Exception:  # noqa: BLE001 — best-effort, row is already committed
            pass

    return _to_out(template)


@router.post("/admin/templates/{template_id}/publish", response_model=TemplateOut)
async def set_published(
    template_id: uuid.UUID,
    payload: PublishStateIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    template = await get_or_404(session, Template, template_id, "Template")
    if payload.published and not template.storage_key:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "no_file",
                    "message": "Upload the template file before publishing it.",
                }
            },
        )
    was_state = template.publish_state.value
    was = template.published
    new_state = apply_publish_state_or_422(template, payload)
    await record_audit(
        session, actor=admin,
        action="publish_template" if payload.published else "unpublish_template",
        target_type="template", target_id=template.id,
        context={"from": was, "to": payload.published, "state_from": was_state, "state_to": new_state.value},
    )
    await session.commit()
    return _to_out(template)
