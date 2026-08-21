"""Mux direct-upload for lesson video (week3_plan.md Phase 5 step 1).

Today an editor pastes a Mux asset id/playback id copied from the Mux dashboard
(`PUT /admin/lessons/{lesson_id}/video`, `courses.py`) — that endpoint's own docstring
already names this as "isolated" precisely so it could be swapped for a real upload
flow later. This file is that swap: `POST /admin/media/upload-url` hands the browser a
Mux direct-upload URL (no Mux secret ever reaches the frontend), and `GET
/admin/media/{upload_id}` polls Mux for the honest `Uploading -> Processing -> Ready`
state `UploadField` (§20.4) renders. Once ready, the admin still calls the existing
`PUT /admin/lessons/{lesson_id}/video` to attach it to a lesson — that endpoint's
contract (mux_asset_id + mux_playback_id) doesn't change, so nothing downstream of it
needed to move.
"""
import asyncio

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import require_admin
from app.db.models import Media, User
from app.db.session import get_session
from app.integrations.mux_client import create_direct_upload, generate_mux_playback_token, get_asset, get_upload_status

router = APIRouter()


class MediaUploadUrlOut(BaseModel):
    upload_id: str
    upload_url: str


@router.post("/admin/media/upload-url", response_model=MediaUploadUrlOut)
async def create_media_upload_url(admin: User = Depends(require_admin)):
    try:
        data = await asyncio.to_thread(create_direct_upload)
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Mux declined the upload request: {e}")
    return MediaUploadUrlOut(upload_id=data["id"], upload_url=data["url"])


class MediaStatusOut(BaseModel):
    # "uploading" (Mux hasn't seen the file yet) | "processing" (asset encoding) |
    # "ready" | "error" — UploadField's own state machine, not Mux's raw vocabulary,
    # so the frontend has one status enum regardless of which Mux resource it came from.
    status: str
    mux_asset_id: str | None = None
    mux_playback_id: str | None = None
    duration_seconds: int | None = None
    error_message: str | None = None


class PlaybackTokenIn(BaseModel):
    """Phase 8 (8D-1): Request for a signed playback token.

    Phase 8 (8D-3/8D-5): `asset_id` is optional so existing callers keep working, but
    every real call site now sends it — it's what lets this endpoint tell the four
    admin-preview failure modes apart (8D-5) instead of returning a bare token and
    leaving Mux's own player to fail silently on whichever one actually happened.
    """
    playback_id: str
    asset_id: str | None = None


class PlaybackTokenOut(BaseModel):
    """Phase 8 (8D-1/8D-3/8D-5): Signed JWT plus the live Mux asset state.

    `state` is one of "ready" | "encoding" | "asset_error" | "asset_unknown" — the
    four admin-preview states 8D-3/8D-5 name, distinct from a token-request failure
    (which this endpoint reports as a 4xx/5xx, not a 200 with a state field, since
    that failure happens before any asset is even looked up).
    """
    token: str
    state: str
    message: str | None = None


@router.post("/admin/media/playback-token", response_model=PlaybackTokenOut)
async def get_playback_token(
    payload: PlaybackTokenIn,
    admin: User = Depends(require_admin),
):
    """Phase 8 (8D-1): Generate a signed playback token for admin video playback.

    Admin users need to preview videos in the admin panel without purchasing them.
    This endpoint generates a short-lived signed JWT that Mux accepts for playback.

    Phase 8 (8D-3/8D-5): also checks the asset's live Mux status when `asset_id` is
    given, so the preview can distinguish "still encoding" from "ready" from "Mux
    lost the asset" — `Media.status` in the database is set optimistically at attach
    time (see `set_lesson_video`) and is not kept in sync with Mux afterward, so it
    cannot answer this on its own; the legacy paste-a-playback-id flow in particular
    never confirms the asset finished encoding before attaching it.
    """
    try:
        token = await asyncio.to_thread(generate_mux_playback_token, payload.playback_id)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not payload.asset_id:
        return PlaybackTokenOut(token=token, state="ready")

    try:
        asset = await asyncio.to_thread(get_asset, payload.asset_id)
    except requests.RequestException:
        # Asset id unknown to Mux (deleted, or never a real asset — a fat-fingered
        # legacy paste). Distinct from the token itself failing, which is a 5xx above.
        return PlaybackTokenOut(
            token=token, state="asset_unknown",
            message="Mux doesn't recognize this asset id. It may have been deleted.",
        )

    if asset["status"] == "errored":
        return PlaybackTokenOut(
            token=token, state="asset_error",
            message="Mux couldn't encode this video.",
        )
    if asset["status"] != "ready":
        return PlaybackTokenOut(
            token=token, state="encoding",
            message="Video is still encoding.",
        )

    return PlaybackTokenOut(token=token, state="ready")


@router.get("/admin/media/{upload_id}", response_model=MediaStatusOut)
async def get_media_status(upload_id: str, admin: User = Depends(require_admin)):
    """Polled by `UploadField` every 5s (§20.4) until `ready` or `error`. Two Mux
    resources, checked in sequence: the upload (has the asset been CREATED yet) then
    the asset (has it finished ENCODING) — a video is not playable the moment Mux
    acknowledges the upload, only once the asset itself reports ready.
    """
    try:
        upload = await asyncio.to_thread(get_upload_status, upload_id)
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Mux declined the status check: {e}")

    if upload["status"] == "errored":
        return MediaStatusOut(status="error", error_message="Mux couldn't process that upload.")
    if upload["status"] == "cancelled":
        return MediaStatusOut(status="error", error_message="The upload was cancelled.")
    if upload["status"] != "asset_created" or not upload.get("asset_id"):
        return MediaStatusOut(status="uploading")

    try:
        asset = await asyncio.to_thread(get_asset, upload["asset_id"])
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Mux declined the asset check: {e}")

    if asset["status"] == "errored":
        return MediaStatusOut(status="error", error_message="Mux couldn't encode that video.")
    if asset["status"] != "ready":
        return MediaStatusOut(status="processing", mux_asset_id=asset["id"])

    playback_ids = asset.get("playback_ids") or []
    signed = next((p["id"] for p in playback_ids if p.get("policy") == "signed"), None)
    if not signed:
        # Should not happen — every asset here is created with playback_policy:
        # ["signed"] — but a video with no playable id is not "ready" by this app's
        # own definition, whatever Mux's own status field says.
        return MediaStatusOut(status="error", error_message="No signed playback id was issued for this asset.")

    return MediaStatusOut(
        status="ready",
        mux_asset_id=asset["id"],
        mux_playback_id=signed,
        duration_seconds=round(asset["duration"]) if asset.get("duration") else None,
    )


class MediaLibraryRowOut(BaseModel):
    """Phase 8 (8D-4): one uploaded video, wherever it's used (or not yet used)."""
    id: str
    mux_asset_id: str | None
    mux_playback_id: str | None
    status: str
    duration_seconds: int | None
    lesson_id: str
    lesson_title: str
    lesson_slug: str
    created_at: str


@router.get("/admin/media", response_model=list[MediaLibraryRowOut])
async def list_media(session: AsyncSession = Depends(get_session)):
    """Phase 8 (8D-4): the third `TokenizedVideoPreview` placement — every uploaded
    video in one place, including one attached via the legacy paste-a-playback-id
    flow (`PUT /admin/lessons/{lesson_id}/video`) where `status` was set to `ready`
    without Mux ever confirming the asset finished encoding, which is exactly the case
    the playback-token endpoint's live Mux check (8D-3) exists to catch when this row
    is actually previewed.

    No live Mux call per row here — a list of N videos doing N Mux round trips would
    be slow and is not what this view needs; each row's live encoding state is
    checked when its own preview is opened, the same as the lesson/block editors.
    """
    rows = (
        await session.execute(
            select(Media).options(selectinload(Media.lesson)).order_by(Media.created_at.desc())
        )
    ).scalars().all()
    return [
        MediaLibraryRowOut(
            id=str(m.id),
            mux_asset_id=m.mux_asset_id,
            mux_playback_id=m.mux_playback_id,
            status=m.status.value,
            duration_seconds=m.duration_seconds,
            lesson_id=str(m.lesson_id),
            lesson_title=m.lesson.title,
            lesson_slug=m.lesson.slug,
            created_at=m.created_at.isoformat(),
        )
        for m in rows
    ]
