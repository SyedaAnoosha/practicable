"""Admin CRUD for templates, including the actual file upload.

Product spec §8: "As an admin, I want to add a template as a standalone product,
without needing to attach it to a course first."
"""
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
from app.integrations.storage_client import delete_file, upload_file

from .common import ensure_unique_slug, get_or_404, record_audit, slugify

router = APIRouter()

# 25 MB. Templates here are spreadsheets and documents, not video — anything larger is
# almost certainly a mistake (a video dragged into the wrong field), and accepting it
# would mean holding it all in memory to hash and forward to storage.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

# Deliberately an allow-list, not a deny-list of dangerous types. This bucket serves
# files to paying customers; a deny-list silently accepts every extension nobody
# thought to ban, which is the wrong default for user-supplied uploads.
ALLOWED_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx
    "application/vnd.ms-excel",  # .xls
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "application/msword",  # .doc
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # .pptx
    "application/pdf",
    "text/csv",
    "application/zip",
}


class TemplateWriteIn(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str = Field(min_length=1)
    # The free lead magnet (product spec §9). Defaults to False so a template is never
    # accidentally given away by omitting a field.
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
    is_free: bool
    # False until a real file has been uploaded. The editor uses this to block the
    # publish action — publishing a template row with no file behind it would put a
    # buyable product on the site whose download is a 404 after payment.
    has_file: bool


def _to_out(t: Template) -> TemplateOut:
    return TemplateOut(
        id=str(t.id), slug=t.slug, title=t.title, description=t.description,
        file_name=t.file_name, file_size_bytes=t.file_size_bytes,
        mime_type=t.mime_type, published=t.published, is_free=t.is_free,
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
    """Creates the row only. The file arrives via the upload endpoint below, as a
    second step — a multipart create that carried both would make "save my wording
    edit" and "replace the artefact customers download" the same action."""
    # section_id/author_id are NOT NULL on templates but are not an editorial concern —
    # there is one section and one author, and asking a content editor to pick them
    # would be exposing a schema detail as a form field. First row of each is used.
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
    # Slug is not regenerated on retitle — same reasoning as questions: /templates/:id
    # links and any shared URL must keep working.
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
    """Upload or replace the downloadable artefact.

    The bytes are read fully into memory before being forwarded — bounded by
    MAX_UPLOAD_BYTES above, which is what makes that safe. The storage write itself
    runs in a thread because boto3 is blocking, and a 25 MB PUT on the event loop
    would stall every concurrent request on this worker.
    """
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

    # Key includes the template id so two templates can share a filename, and a uuid4
    # so replacing a file writes a NEW object rather than overwriting the old one in
    # place. That matters because download URLs are presigned with a 60s expiry: an
    # in-place overwrite could swap the bytes under a link a customer is mid-download
    # on. The old object is deleted after the row points at the new one.
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
        # Best-effort: the row is already committed and correct. A failed cleanup
        # leaves an orphaned object costing storage, which is strictly better than
        # failing the request after the upload succeeded.
        try:
            await asyncio.to_thread(delete_file, previous_key)
        except Exception:  # noqa: BLE001 — deliberately swallowed, see above
            pass

    return _to_out(template)


class PublishIn(BaseModel):
    published: bool


@router.post("/admin/templates/{template_id}/publish", response_model=TemplateOut)
async def set_published(
    template_id: uuid.UUID,
    payload: PublishIn,
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
    was = template.published
    template.published = payload.published
    await record_audit(
        session, actor=admin,
        action="publish_template" if payload.published else "unpublish_template",
        target_type="template", target_id=template.id,
        context={"from": was, "to": payload.published},
    )
    await session.commit()
    return _to_out(template)
