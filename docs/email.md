Good news — checked DNS, and it looks like you may already have options:

practicable.com.au — has active MX records pointing to Microsoft 365 (protection.outlook.com), meaning it's a registered domain with real email hosting already set up. If this is yours, it's the obvious pick — matches the brand name exactly, and .com.au fits the Australian/AUD positioning already locked in.
effectiverm.com — has MX records pointing to Google Workspace, consistent with the owner's existing Google-hosted address.
I can't confirm ownership from DNS alone (MX records just mean someone configured email there), so: which of these do you actually control — i.e., can you get into a DNS management panel (GoDaddy, Cloudflare, Netlify, whoever the registrar/DNS host is) to add TXT/CNAME records? That's what verifying in Resend actually requires.

Once you confirm which one and that you have DNS access, I'll:

Add it via the Resend API myself
Pull back the exact DNS records Resend needs
Give you the exact records to paste into your DNS provider (or if you give me DNS-panel access, add them directly)
Poll Resend until it verifies, then switch email_service.py's from address to match and confirm a real send works
I cant use effectiverm.com. Maybbe you can siggest and give me free alternatives for Resend without asking me any regeistered domains

Every transactional email provider (Resend, SendGrid, Postmark, SES — not just Resend) requires a verified domain before it'll send to arbitrary recipients. That's an anti-spam industry standard, not something to route around. But there are two genuinely free paths depending on what you need right now:

Option 1 — Free, zero domain, works today (testing only)
Resend's sandbox sender (onboarding@resend.dev) is still allowed to send to one address: whatever email the Resend account itself is registered under. I don't know if you have access to that inbox — check Resend dashboard → Account Settings to see what email it is.

If you do: sign up for your Week 1 test purchase using that exact email address, and I'll point email_service.py at onboarding@resend.dev for now. That fully proves the receipt-email code path (webhook → order → email send → arrives) for the Week 1 smoke test, at zero cost. It just can't reach real customers yet.

Option 2 — A free real domain, so real customers can eventually receive email
is-a.dev gives a free subdomain (practicable.is-a.dev) with real DNS control — you manage records by submitting a JSON file to their GitHub repo (a PR, reviewed and merged, so not instant — usually hours). It supports the TXT/MX records Resend needs for verification. Downside: it's a .is-a.dev address, not a standalone brand domain, and updates aren't as fast as a normal DNS panel — fine for proving the flow works, not something to ship a real product on long-term.

My recommendation: Option 1 right now (free, instant, proves Week 1's actual requirement — "a receipt email arrives in a real inbox"), and treat a real paid domain (cheap TLDs run ~$10-15/year) as a pre-launch task rather than a Week 1 blocker — the Week 1 Definition of Done needs an email to arrive, not necessarily to an arbitrary customer's inbox yet.

Real difference between them and Resend — verified via current docs, not memory:

Brevo — actually solves this
Brevo doesn't gate sending on domain ownership at all. It verifies individual sender email addresses, not domains: you add a "from" address (even a personal Gmail), Brevo emails you a confirmation link/code, you click it, and you can send to any recipient, no DNS access needed. Free tier: 300 emails/day, no credit card at signup. This is the one that actually matches what you asked for.

Caveat, to be honest about it: without full domain authentication (DKIM/SPF/DMARC), deliverability is weaker — Gmail/Yahoo's Feb 2024 bulk-sender rules mean unauthenticated mail is more likely to land in spam, especially at higher volume. For Week 1's low-volume real-purchase-receipt use case, single-sender verification should be fine; it's the thing to revisit before real launch volume.

Source: Brevo — Create a new sender

Mailgun — still gated, just differently
No credit card needed to start, but the sandbox domain restricts you to 5 manually-added "Authorized Recipients" — real arbitrary customers still can't receive mail until you add a credit card and a verified custom domain. So it doesn't actually remove the domain requirement, just delays it.

Sources: Mailgun — Authorized Recipients · Mailgun — Free plan

My recommendation: Brevo
It's the only one of the three that lets you send to real, arbitrary buyers today without owning a domain.

Sign up at brevo.com (needs your email to confirm — that part only you can do), then grab an API key from Settings → SMTP & API → API Keys, and send it to me. I'll swap email_service.py from Resend to Brevo, trigger single-sender verification for whatever "from" address you want to use, and test a real send end-to-end — same as I did with Mux and Supabase Storage.

---

## Implementation status

**Update — switched to Brevo's SMTP relay, not the REST API.** The owner grabbed a credential from Settings → SMTP & API → the **SMTP** tab (`xsmtpsib-...`), not the **API Keys** tab (`xkeysib-...`) originally planned below — both are valid Brevo credentials, just for different transports. Rather than ask for the other key, `email_service.py` was rebuilt around SMTP relay (`smtp-relay.brevo.com:587`, stdlib `smtplib`, no new dependency), since the credential already on hand works for that.

Confirmed directly: authenticating with `brevo_sender_email` as the SMTP login fails (`535 Authentication failed`) — Brevo's SMTP login is a separate value shown on that same SMTP tab (format `xxxxxx@smtp-brevo.com`), not derivable from the sender email or the key itself.

`app/core/config.py` now has `brevo_api_key` (the SMTP key, kept under this name since it already matches `.env`/Render), `brevo_smtp_login` (new), `brevo_sender_email`, `brevo_sender_name` — all optional, so the app still boots without them and a send attempt without them logs a clear error instead of crashing or silently no-oping forever.

**Still needed from the owner, genuinely can't be done by Claude:**
1. Settings → SMTP & API → **SMTP** tab → copy the **Login** field (format `xxxxxx@smtp-brevo.com`) → paste into `backend/.env` as `BREVO_SMTP_LOGIN`, and into Render's dashboard once deployed.
2. Confirm `BREVO_SENDER_EMAIL` is a sender Brevo has actually verified (Senders, Domains & Dedicated IPs → Senders → the confirmation-link step) — sending from an unverified address will be rejected by the relay regardless of correct SMTP credentials.

Once `BREVO_SMTP_LOGIN` is in `.env`, the webhook-triggered receipt + owner-notification email paths are live — no further code changes needed.

**Update — Mailjet is now the primary tier, Brevo demoted to second fallback.** Confirmed live: Mailjet sends to an arbitrary real recipient immediately on a fresh free account — no domain, no pending review, no 2-recipient trial cap. Checked against every other free provider considered this round:

| Provider | Result |
|---|---|
| Resend | sandbox sender reaches only the one whitelisted account address |
| Postmark | blocks signup without a work-domain email; test mode restricted to verified-domain addresses only |
| Brevo | account-wide "SMTP account is not yet activated" pending manual approval, regardless of correct credentials |
| SendGrid | documented compliance-review holds, sometimes suspending new accounts on creation |
| MailerSend | trial hard-capped at 2 total recipients |
| **Mailjet** | **sent successfully to a real, non-whitelisted address on the first try** |

`email_service.py` now tries Mailjet first (REST API, basic auth via `MAILJET_API_KEY`/`MAILJET_SECRET_KEY`), falls back to Brevo if that fails, then Resend as the last resort. Both receipt and sale-notification emails now include a `TextPart`/plain-text alternative alongside the HTML body, matching Mailjet's own documented send structure — better deliverability than an HTML-only send, and applied to all three tiers for consistency. Brevo and Resend are kept configured, not deleted, purely as redundancy in case Mailjet has an outage; removing either later is a one-line change, not a rebuild.