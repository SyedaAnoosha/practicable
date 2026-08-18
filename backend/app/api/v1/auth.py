"""Password reset — the request half. The reset itself (choosing a new password) never
touches this backend: Supabase's client-side `updateUser` handles it directly once the
browser holds the recovery session the emailed link establishes (RS 6.3 — FastAPI only
verifies Supabase JWTs, it never issues or mutates sessions itself).

Why this endpoint exists instead of calling `supabase.auth.resetPasswordForEmail()`
straight from the frontend: that call sends Supabase's own built-in email, which is
unbranded and — until Mailjet is configured as Supabase's SMTP relay in its own
dashboard, a separate manual step — goes out over Supabase's default mailer rather than
through our transport. `admin.generate_link()` produces the identical link *without*
sending anything, so this route can mail it ourselves via `password_reset.html.j2` and
Mailjet, consistent with the other five (week3_plan.md W3-R1 Phase 1).
"""

import logging

from fastapi import APIRouter
from pydantic import BaseModel, EmailStr
from supabase import acreate_client

from app.core.config import settings
from app.services.email_service import send_password_reset_email

logger = logging.getLogger(__name__)

router = APIRouter()

# Supabase's default expiry for a recovery link (Auth → Email Templates → the
# project's configured OTP expiry, commonly 3600s unless changed in the dashboard).
# Stated here so the email and this comment can't drift silently — if the project's
# actual setting differs, update both together.
RESET_LINK_EXPIRES_IN = "1 hour"


class RequestResetIn(BaseModel):
    email: EmailStr


class RequestResetOut(BaseModel):
    ok: bool = True


@router.post("/auth/request-password-reset", response_model=RequestResetOut)
async def request_password_reset(body: RequestResetIn):
    """Public, no auth. Always returns ok — deliberately vague about whether the address
    has an account, the same reasoning /leads and /contact are public without leaking
    who's registered. A real failure (Supabase down, generate_link erroring for a reason
    other than "no such user") is logged, not surfaced to the caller.

    The frontend's /reset-password route must be in Supabase's Auth → URL Configuration
    → Redirect URLs allow-list, or Supabase silently falls back to the dashboard's Site
    URL instead of `redirect_to` below — a one-time dashboard check, not something this
    endpoint can verify or fix itself.
    """
    try:
        admin_client = await acreate_client(settings.supabase_url, settings.supabase_service_role_key)
        redirect_to = f"{settings.frontend_url.rstrip('/')}/reset-password"
        response = await admin_client.auth.admin.generate_link(
            {
                "type": "recovery",
                "email": body.email,
                "options": {"redirect_to": redirect_to},
            }
        )
        reset_url = response.properties.action_link
        sent = await send_password_reset_email(
            to_email=body.email, reset_url=reset_url, expires_in=RESET_LINK_EXPIRES_IN
        )
        if not sent:
            logger.error("Password reset link generated for %s but the email did not send.", body.email)
    except Exception as e:
        # Covers "no user with that email" (Supabase raises for this) as well as a
        # genuine outage — both must look identical to the caller.
        logger.warning("Password reset request for %s did not complete: %s", body.email, e)

    return RequestResetOut()
