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

from app.core.deps import require_admin
from app.db.models import User
from app.integrations.mux_client import create_direct_upload, get_asset, get_upload_status

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
