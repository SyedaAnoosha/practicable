"""Environment-backed application settings. See BACKEND.md §10 for the full list."""

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # The Postgres DSN (Supabase → Database → Connection string → URI). Not the same
    # value as supabase_url below, which is the REST/Auth API URL.
    database_url: str
    supabase_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    supabase_jwt_audience: str = "authenticated"
    stripe_secret_key: str
    stripe_webhook_secret: str
    mux_token_id: str
    mux_token_secret: str
    # Separate pair from the two above: these sign RS256 playback JWTs (Mux → Settings →
    # Signing Keys), while mux_token_* is basic auth for the Mux API. Optional so the app
    # boots before they're provisioned — mux_client.py errors at call time instead.
    mux_signing_key_id: str = ""
    mux_signing_key_private: str = ""
    # Supabase Storage's S3-compatible API (Project Settings → Storage → S3 Connection)
    # — a storage-scoped credential pair, distinct from the service role key above.
    supabase_storage_s3_endpoint: str
    supabase_storage_region: str
    supabase_storage_access_key_id: str
    supabase_storage_secret_access_key: str
    supabase_storage_bucket_name: str
    # ── Email ────────────────────────────────────────────────────────────────────
    # Resend is the only transport. Any leftover GMAIL_*/MAILJET_*/BREVO_* variables in
    # a .env or hosting dashboard are inert (see `extra = "ignore"` below).
    resend_api_key: str = ""
    # The owner/admin inbox, load-bearing for ALL email: Resend's sandbox sender can only
    # deliver to its own account address, so buyer receipts are redirected here too. Must
    # equal the Resend account address or every send returns 403.
    #
    # Deliberately empty — this file is committed, and a hardcoded default would silently
    # send sale notifications (which quote buyer address and amount) to a stale recipient.
    # Empty means email_service.py logs and sends nothing rather than guessing.
    owner_notification_email: str = ""
    # Comma-separated for multiple frontend origins (production alias, previews, www vs
    # non-www); a single value works unchanged. CORS preflight is an exact string match
    # against this list, so a mismatch is what produces "400 Disallowed CORS origin".
    allowed_origin: str = "http://localhost:5173"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origin.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        # pydantic-settings rejects undeclared .env variables by default, which would
        # crash the app at import over any ad-hoc key left in the environment.
        extra = "ignore"

settings = Settings()
