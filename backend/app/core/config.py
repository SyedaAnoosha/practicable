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
    # ── Gmail SMTP, the first transport tried (docs/gmail.md) ───────────────────
    # Added 2026-08-11 after a real order delivered both of its emails from
    # `onboarding@resend.dev` — i.e. the send fell all the way through Mailjet and
    # Brevo to the Resend last resort, whose sandbox sender can only reach the
    # account owner, so the *buyer* received nothing and the owner got two emails.
    # Gmail SMTP with an app password is the one transport here that needs no
    # provider account review and can reach an arbitrary real recipient today.
    #
    # gmail_app_password is the 16-character App Password from
    # myaccount.google.com/apppasswords (NOT the account password — Google rejects
    # that over SMTP), with the spaces Google displays it with removed. Requires
    # 2-Step Verification on the account first. Both blank = tier skipped entirely,
    # so this is inert until real credentials are supplied.
    gmail_user: str = ""
    gmail_app_password: str = ""
    # Gmail rewrites the From header to the authenticated account on personal
    # accounts, so this is a display name only — the address will be gmail_user
    # whatever is set here (docs/gmail.md).
    gmail_sender_name: str = "Practicable"

    # Receipt/sale-notification emails — live path is now Mailjet (docs/email.md):
    # confirmed live, it sends to an arbitrary real recipient immediately, no domain
    # and no pending account review — unlike every other free provider tried before it
    # (Resend: sandbox-only recipient; Postmark: blocks signup without a work-domain
    # email; Brevo: account-wide "not yet activated" until manual approval; SendGrid:
    # documented compliance-review holds on new accounts; MailerSend: hard 2-recipient
    # trial cap). Basic-auth REST API (api key : secret key), not SMTP.
    mailjet_api_key: str = ""
    mailjet_secret_key: str = ""
    # Brevo kept as the second fallback (its activation ticket may still clear), and
    # Resend as the last resort (docs/email.md) — resend_api_key kept below, dormant
    # for its own tier, purely so removing any one provider is a one-line change
    # rather than a rebuild.
    resend_api_key: str = ""
    # Despite the name (matches BREVO_API_KEY already in .env/Render — not renamed to
    # avoid the churn of updating both), this holds Brevo's *SMTP key*
    # (xsmtpsib-... — Settings -> SMTP & API -> SMTP tab), not the HTTP API key
    # (xkeysib-...). email_service.py sends over SMTP relay (smtp-relay.brevo.com:587),
    # not Brevo's REST API, because that's the credential type actually on file.
    brevo_api_key: str = ""
    # The SMTP tab's "Login" value (format xxxxxx@smtp-brevo.com) — a distinct
    # credential from both brevo_api_key above and brevo_sender_email below, and NOT
    # derivable from either. Confirmed directly: authenticating with
    # brevo_sender_email as the login failed with "535 Authentication failed" against
    # the real relay. Same dashboard page as brevo_api_key.
    brevo_smtp_login: str = ""
    brevo_sender_email: str = ""
    brevo_sender_name: str = "Practicable"
    # Where the "you made a sale" notification goes (app/services/email_service.py's
    # send_sale_notification_email) — the owner's own inbox, NOT a buyer's.
    #
    # Deliberately empty, like every other credential-shaped field in this file. No real
    # address is hardcoded here: this file is committed, and a default address is a
    # default that silently applies in environments nobody configured.
    #
    # [2026-08-12] It previously defaulted to a real address that turned out to be a
    # *customer's*, contradicting the line above it. That is a privacy defect, not a
    # cosmetic one — every sale notification quotes the buyer's email address and what
    # they paid, so one customer would receive other customers' purchase details. Empty
    # is the safe default: email_service.py skips the notification and logs loudly
    # rather than sending owner-only data to a guessed recipient.
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
