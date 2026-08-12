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
    # ── Email ────────────────────────────────────────────────────────────────────
    # [OWNER-DECIDED 2026-08-12] One transport: Resend. The Gmail, Mailjet and Brevo
    # settings that used to sit here were removed with their tiers — see the module
    # note at the top of app/services/email_service.py for what each one was and why
    # it went, including the fact that Mailjet was working when it was removed.
    #
    # Any GMAIL_*/MAILJET_*/BREVO_* variables still present in a .env or a hosting
    # dashboard are now inert rather than an error: `extra = "ignore"` below means an
    # undeclared key is skipped instead of crashing the app at import. Worth deleting
    # them from the deployed environment anyway, so the next person reading that list
    # doesn't conclude those transports are live.
    resend_api_key: str = ""
    # The owner/admin inbox. Now load-bearing for ALL email, not just sale alerts:
    # while the store is Resend-only, buyer receipts are redirected here too, because
    # Resend's sandbox sender can only deliver to the address its own account is
    # registered under. This value must therefore equal that Resend account address, or
    # every send returns a 403.
    #
    # Deliberately empty, like every other credential-shaped field here. No real address
    # is hardcoded: this file is committed, and a default address is one that silently
    # applies in environments nobody configured. It previously defaulted to a real
    # address that turned out to be a customer's — a privacy defect, since sale
    # notifications quote the buyer's address and what they paid. Empty means
    # email_service.py logs loudly and sends nothing, rather than guessing a recipient.
    owner_notification_email: str = ""
    # Comma-separated when there's more than one real frontend origin (e.g. a stable
    # Vercel production alias plus a preview-deployment URL, or www/non-www) — a bare
    # single value still works since split(",") on a string with no comma just
    # returns a one-element list. CORSMiddleware's preflight check is an exact string
    # match against this list (scheme + host, no trailing slash), so a mismatch here
    # is what produces the "400 Disallowed CORS origin" seen on OPTIONS requests.
    allowed_origin: str = "http://localhost:5173"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origin.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        # pydantic-settings defaults to rejecting any .env variable that isn't a
        # declared field (unlike plain pydantic, which ignores extras by default) —
        # every ad-hoc key added to .env for a dashboard/testing credential
        # (RESEND_FULL_ACCESS_API_KEY, etc.) that isn't wired into a Settings field
        # yet would otherwise crash the app at import time.
        extra = "ignore"

settings = Settings()
