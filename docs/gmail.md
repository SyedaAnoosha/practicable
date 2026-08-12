# Gmail SMTP setup

How to make Practicable send its receipt and sale-notification emails through your own
Gmail account. Last updated: 2026-08-11.

This is the **first transport** the backend tries. If it's configured and working,
nothing else runs.

---

## 1. Why this exists

A real test order on 2026-08-11 delivered both of its emails from
`onboarding@resend.dev` — meaning the send fell all the way through Mailjet and Brevo
to the Resend last resort. Resend's sandbox sender can only deliver to the one address
the Resend account is registered under, so:

- the **buyer** received nothing at all, and
- the **owner** received two emails, one of which was the buyer's receipt
  ("Thank you for your purchase") arriving unlabelled in the wrong inbox.

Gmail SMTP with an App Password is the one transport available here that needs no
provider account review, no verified domain, and can reach an arbitrary real recipient
today.

(The misdirection itself is also fixed independently: if a send ever falls through to
Resend again, the redirected copy now arrives subject-prefixed
`[Not delivered to buyer]` with a red banner naming the address that did *not* receive
it. See `app/services/email_service.py`.)

---

## 2. What you need

| Thing | Where it goes |
|---|---|
| Your Gmail address | `GMAIL_USER` |
| A 16-character **App Password** (not your account password) | `GMAIL_APP_PASSWORD` |

Google **blocks your real account password over SMTP**. The "Less secure app access"
toggle that older tutorials mention was removed permanently in May 2022. An App
Password is the only username/password path that still works.

---

## 3. Step 1 — Turn on 2-Step Verification

App Passwords do not exist on an account without it; the menu item simply won't appear.

1. Go to [myaccount.google.com/security](https://myaccount.google.com/security)
2. Under **How you sign in to Google**, click **2-Step Verification**
3. Follow the prompts to finish setup

---

## 4. Step 2 — Generate the App Password

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   (if it 404s or says unavailable, 2-Step Verification isn't fully active yet)
2. Give it a name — `Practicable backend` is fine. The name is only a label for you.
3. Click **Create**
4. **Copy the 16 characters immediately.** Google shows it once and never again. If you
   lose it, delete that entry and generate a new one — there's no way to reveal it.

Google displays it in four spaced groups, like `abcd efgh ijkl mnop`.
**Remove the spaces.** Paste it as `abcdefghijklmnop`.

---

## 5. Step 3 — Put it in `backend/.env`

```bash
GMAIL_USER=effectiverm.australia@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
```

Then **restart the backend.** Settings are read once at process start, so an already-
running server will not pick up new `.env` values — a stale process is itself a likely
contributor to the original failure, since the Mailjet credentials in `.env` test fine
from a fresh process.

`.env` is already in `.gitignore`. Confirm before committing anything:

```powershell
git check-ignore backend/.env    # should print the path
```

---

## 6. Step 4 — Verify it actually sends

From `backend/`, with the venv active:

```powershell
.venv\Scripts\python.exe -c "
import asyncio
from app.services.email_service import _send
asyncio.run(_send(
    to_email='YOUR_TEST_ADDRESS@example.com',
    subject='Practicable SMTP test',
    html='<p>If you are reading this, Gmail SMTP works.</p>',
    text='If you are reading this, Gmail SMTP works.',
    context='manual smtp test',
))
"
```

Send it to an address that is **not** the Gmail account itself — delivering to your own
inbox proves less than you'd think, and the whole point is reaching a real buyer.

Check the sender on the received mail. If it says `onboarding@resend.dev`, Gmail did
not run and the send fell through the chain again; check the log line the failure
printed.

---

## 7. Two Gmail behaviours that will surprise you

**You cannot choose the From address.** On a personal Gmail account, Google rewrites
the From header to the authenticated account. Setting `noreply@practicable.com.au`
gets silently replaced with your `@gmail.com` address on every message. Only the
*display name* survives — that's `GMAIL_SENDER_NAME`, which is why there is no
`GMAIL_SENDER_EMAIL` setting to configure.

If a custom sending domain matters (it does eventually, for deliverability and for
looking like a business), that needs Google Workspace or a domain-verified provider —
not this transport.

**A first send from a new server IP can be blocked.** It works locally, then fails on
Render with the same credentials, because Gmail's abuse checks see a login from an
unfamiliar country. The fix is a one-time manual visit to
[accounts.google.com/DisplayUnlockCaptcha](https://accounts.google.com/DisplayUnlockCaptcha)
while signed in as that account, then retry. No code change will resolve it.

---

## 8. Deploying to Render

`backend/render.yaml` declares both keys with `sync: false`, so they are never
committed. Adding a key to that file only creates the slot on a **fresh** Blueprint
deploy — an already-running service needs each one added by hand once in
Render → your service → **Environment** (see `RUNNING.md` §6.3).

Also confirm outbound port **587** is reachable from the service. A firewalled 587
raises a socket timeout rather than an SMTP error; the code catches `OSError` as well
as `SMTPException` for exactly that reason, so it degrades to the next transport
instead of crashing the Stripe webhook.

---

## 9. Where this sits in the chain

`app/services/email_service.py` tries four transports in order, each only if the one
before it is unconfigured or fails:

| # | Transport | Reaches a real buyer? | Status |
|---|---|---|---|
| 1 | **Gmail SMTP** | Yes | Configure via this document |
| 2 | Mailjet (REST) | Yes | Credentials valid; verified sending 2026-08-11 |
| 3 | Brevo (SMTP relay) | Yes | Dormant — account activation still pending |
| 4 | Resend | **No** — sandbox address only | Last resort; redirects to owner, clearly labelled |

Leaving `GMAIL_USER`/`GMAIL_APP_PASSWORD` blank skips tier 1 entirely and changes
nothing else — the tiers below still run exactly as before.

The whole chain is deliberately non-raising (`BACKEND.md` §6.1): a failed email must
never undo an already-committed order, so every failure is a `logger.error`, not an
exception. **That means a silent email failure is only visible in the logs** — if a
buyer reports not receiving a receipt, the backend log is the place to look.

---

## 10. If credentials leak

- **App Password:** delete it at
  [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) and
  generate a fresh one. Revoking is instant and breaks only this integration.
- Then update `.env` locally and the Render environment variable, and restart.

## 11. A note on the long term

Google's own documentation says App Passwords "are not recommended and are unnecessary
in most cases", and pushes developers toward OAuth 2.0. There is no announced
retirement date, but this is a pragmatic transport, not a permanent one. The realistic
end state for a product selling to real customers is a verified sending domain
(`@practicable.com.au`) on a transactional provider — at which point tier 1 here gets
deleted rather than migrated.
