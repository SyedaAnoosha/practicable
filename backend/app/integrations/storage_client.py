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


def delete_file(key: str) -> None:
    """Remove an object — used when a replaced template file would otherwise be orphaned."""
    _get_s3_client().delete_object(Bucket=settings.supabase_storage_bucket_name, Key=key)
