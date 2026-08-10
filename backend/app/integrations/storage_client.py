from functools import lru_cache

import boto3
from botocore.client import Config

from app.core.config import settings


@lru_cache
def _get_s3_client():
    """Built lazily, on first real use — not at import time. Storage credentials are a
    Phase 3 requirement; the app (health check, auth, Day 1-2 work) must still start
    without them configured yet, which an eager module-level boto3.client(...) call
    prevents (it validates the endpoint URL immediately).

    Supabase Storage exposes an S3-compatible API separate from its JS SDK/REST API —
    Project Settings -> Storage -> S3 Connection gives the endpoint, region, and lets
    you generate an access key id/secret pair scoped to storage (not the service role
    key). boto3 talks to it exactly like any other S3-compatible provider.
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
