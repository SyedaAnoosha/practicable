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
    # Mailjet is the only transport (week3_plan.md W3-R1) — restored 2026-08-15 after
    # being removed by choice, not because it failed (docs/email.md, docs/gmail.md §9).
    # It reaches an arbitrary real recipient over REST (port 443), which survives
    # Render's outbound-587 block that kills Gmail/Brevo SMTP outright. Any leftover
    # GMAIL_*/BREVO_*/RESEND_* variables in a .env or hosting dashboard are inert (see
    # `extra = "ignore"` below) and should be deleted, not just ignored.
    mailjet_api_key: str = ""
    mailjet_secret_key: str = ""
    # The address verified as a sender in the Mailjet dashboard (Senders, Domains &
    # Dedicated IPs → Senders). Sending from an unverified address is rejected by the
    # API regardless of correct key/secret.
    mailjet_sender_email: str = ""
    mailjet_sender_name: str = "Practicable"
    # The owner/admin inbox — sale alerts, and where any send whose intended recipient
    # cannot be reached is logged against. Never a customer address.
    #
    # Deliberately empty — this file is committed, and a hardcoded default would silently
    # send sale notifications (which quote buyer address and amount) to a stale recipient.
    owner_notification_email: str = ""
    # The deployed frontend origin, for building absolute links inside emails (a mail
    # client has no notion of a relative URL). Defaults to the local Vite dev server;
    # must be set to the real Vercel URL in Render's environment, same treatment as
    # ALLOWED_ORIGIN below.
    frontend_url: str = "http://localhost:5173"
    # ── Analytics ────────────────────────────────────────────────────────────────
    # week2_plan.md Phase 5 / W2-R8. Empty by default so the app boots without it —
    # posthog_client.py no-ops rather than erroring when this isn't set, same pattern
    # as resend_api_key above. Same project key the frontend uses (VITE_POSTHOG_KEY);
    # a project API key is meant to be shared across a project's client and server SDKs.
    posthog_api_key: str = ""
    posthog_host: str = "https://us.i.posthog.com"
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
