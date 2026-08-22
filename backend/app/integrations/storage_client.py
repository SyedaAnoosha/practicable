from functools import lru_cache

import boto3
from botocore.client import Config

from app.core.config import settings


@lru_cache
def _get_s3_client():
    """Built lazily, on first real use, so the app still starts before storage
    credentials are configured — an eager boto3.client(...) validates the endpoint URL
    at import. Supabase Storage's S3-compatible API (Project Settings → Storage → S3
    Connection) behaves like any other S3 provider.
    """
    return boto3.client(
        's3',
        endpoint_url=settings.supabase_storage_s3_endpoint,
        aws_access_key_id=settings.supabase_storage_access_key_id,
        aws_secret_access_key=settings.supabase_storage_secret_access_key,
        config=Config(signature_version='s3v4'),
        region_name=settings.supabase_storage_region,
    )


def generate_presigned_url(key: str, expiry_seconds: int = 60) -> str:
    """Generate a presigned URL for downloading a file from Supabase Storage."""
    return _get_s3_client().generate_presigned_url(
        'get_object',
        Params={'Bucket': settings.supabase_storage_bucket_name, 'Key': key},
        ExpiresIn=expiry_seconds,
    )


def generate_presigned_upload_url(*, key: str, content_type: str, expiry_seconds: int = 300) -> str:
    """A presigned PUT URL the browser writes directly to (week3_plan.md Phase 5 step
    2), so a large template pack no longer has to be buffered in memory and proxied
    through this API (`upload_file`'s MAX_UPLOAD_BYTES ceiling).

    `upload_file`'s own docstring records the original reasoning for keeping writes
    behind an admin-guarded endpoint ("this bucket holds paid artefacts"). That still
    holds here: this URL is only ever handed out by a `require_admin` route, the same
    gate as the proxy-upload it supplements — the difference is where the bytes flow,
    not who is allowed to ask for the URL. `content_type` is bound into the signature,
    so a PUT with a different Content-Type header is rejected by S3 itself, not just
    by this app's own validation.
    """
    return _get_s3_client().generate_presigned_url(
        'put_object',
        Params={'Bucket': settings.supabase_storage_bucket_name, 'Key': key, 'ContentType': content_type},
        ExpiresIn=expiry_seconds,
    )


def upload_file(*, key: str, body: bytes, content_type: str) -> None:
    """Upload bytes to Supabase Storage under `key`, overwriting any existing object.

    Blocking (boto3 has no async client), so callers must use asyncio.to_thread rather
    than stalling the event loop. Deliberately not a presigned browser upload: this
    bucket holds paid artefacts, so writes stay behind an admin-guarded endpoint.
    """
    _get_s3_client().put_object(
        Bucket=settings.supabase_storage_bucket_name,
        Key=key,
        Body=body,
        ContentType=content_type,
    )


def head_object(key: str) -> dict | None:
    """The real, server-verified size/content-type of an object already written to
    Storage — used to confirm a presigned browser upload actually landed rather than
    trusting whatever size the client claims in the confirm call. Returns None if the
    object doesn't exist (the PUT never happened, or happened at a different key)."""
    try:
        resp = _get_s3_client().head_object(Bucket=settings.supabase_storage_bucket_name, Key=key)
    except Exception:
        return None
    return {"content_length": resp.get("ContentLength"), "content_type": resp.get("ContentType")}


def download_file(key: str) -> bytes | None:
    """Download bytes from Supabase Storage. Returns None if the object doesn't exist.

    Blocking (boto3), so callers must use asyncio.to_thread.
    Used by stamping.py to fetch the original file for per-buyer stamping.
    """
    try:
        resp = _get_s3_client().get_object(Bucket=settings.supabase_storage_bucket_name, Key=key)
        return resp["Body"].read()
    except Exception:
        return None


def delete_file(key: str) -> None:
    """Remove an object — used when a replaced template file would otherwise be orphaned."""
    _get_s3_client().delete_object(Bucket=settings.supabase_storage_bucket_name, Key=key)
