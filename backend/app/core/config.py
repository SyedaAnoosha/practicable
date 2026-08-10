from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # The Postgres connection string (Supabase project settings → Database → Connection
    # string → URI). This is NOT the same value as supabase_url below — that's the
    # REST/Auth API URL (https://xxxx.supabase.co), which is not a Postgres DSN and
    # cannot be turned into one by string-replacing the scheme. BACKEND.md §10 lists
    # these as two separate settings for exactly this reason.
    database_url: str
    supabase_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    supabase_jwt_audience: str = "authenticated"
    stripe_secret_key: str
    stripe_webhook_secret: str
    mux_token_id: str
    mux_token_secret: str
    # Separate credential pair from the two above: mux_token_id/secret authenticate
    # calls to the Mux *API* (basic auth — creating assets, uploads). Signed playback
    # JWTs are RS256, signed with a *signing key*'s private key (Mux dashboard ->
    # Settings -> Signing Keys), verified by Mux against the matching public key it
    # holds — not the same secret as mux_token_secret. Optional with an empty default
    # so the app still boots before these are provisioned; app/integrations/mux_client.py
    # raises a clear error at call time instead, not at import time.
    mux_signing_key_id: str = ""
    mux_signing_key_private: str = ""
    # Supabase Storage's S3-compatible API (Project Settings -> Storage -> S3
    # Connection) — a different credential pair from supabase_service_role_key above,
    # scoped to storage only. Swapped in for Cloudflare R2: no card required on the
    # free tier (1GB storage / 2GB bandwidth), and it's the same Supabase project
    # already in use for Postgres/Auth, so one fewer external account to manage.
    supabase_storage_s3_endpoint: str
    supabase_storage_region: str
    supabase_storage_access_key_id: str
    supabase_storage_secret_access_key: str
    supabase_storage_bucket_name: str
    resend_api_key: str
    allowed_origin: str = "http://localhost:5173"

    class Config:
        env_file = ".env"

settings = Settings()
