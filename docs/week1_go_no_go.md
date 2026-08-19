# Week 1 — Report and Go/No-Go

**"Deciding in the Dark" Platform · 2026-08-14 · closes `week1_plan.md` Day 5, steps 6–7**

*This is the standalone report `week1_plan.md:393` asks for. It is written against the repository and the Week 1 record, not from memory of the sessions that produced them. Where Week 1's own evidence has since expired, this document says so rather than carrying the tick forward.*

---

## The recommendation

> ## **GO — conditionally.**
>
> The Week 1 chain was genuinely proven end to end against real production infrastructure, and Weeks 2's work has since been built on top of it without disturbing it. Week 2 was the right thing to have done.
>
> **The condition is on money, not on code:** two things must be true before this platform takes a real payment from a real customer, and neither is true today.
>
> 1. **A sending domain is verified with Resend.** As the code stands, no customer can receive any email at all.
> 2. **Stripe's test key is deliberately swapped for a live one** (decision #21), as a decision rather than a discovery.
>
> Neither blocks Week 3 development. Both block launch. Nothing in the Week 1 slice needs rebuilding.

---

## 1. What Week 1 set out to prove

> Sign up → see one real question with all seven tags → find the related course → watch one signed video lesson → buy one real template through Stripe Checkout → receive a receipt email → download the file → confirm a logged-out user is blocked from all of it.

One complete path, ugly-is-fine, proven with a real Stripe test card. The brief's own test: *"If every link in that chain works by Friday, Week 2 is widening a proven path. If one link is missing, Week 2 becomes Week 1 again."*

**Every link worked.** Week 2 widened a proven path — it did not re-run Week 1.

## 2. The Definition of Done, item by item

All eleven items in `week1_plan.md`'s objective Definition of Done are now closed. Ten were closed during Week 1 and verified directly against production — not inferred from the UI, which is the distinction that matters in most of them:

| # | Item | How it was proven |
|---|---|---|
| 1 | Stranger signs up | Real account, React → Supabase Auth directly |
| 2 | Logged-in, non-entitled user blocked | `has_access_to()` false across all three resource types; Mux URL 403/400 without a signed token |
| 3 | Real test card completes checkout | A real completed Checkout Session in production (`payment_status: paid`), confirmed against the Stripe API — **not** a synthetic `stripe trigger` |
| 4 | Webhook creates the entitlement | Queried in Supabase: real order, real entitlement (`granted_via: purchase`), real `audit_log` row, from a signature-verified delivery |
| 5 | Idempotency | The same signed event delivered three times → exactly one order, one entitlement |
| 6 | Presigned download works | Fetched the real presigned URL, downloaded the real 24,486-byte file |
| 7 | Signed video plays | Real RS256 token generated server-side, accepted by `stream.mux.com` (200, captions present); no token → 403, garbage → 400 |
| 8 | Receipt email arrives | Delivered live to a real recipient with real order details — **see §4, this is the one that has since regressed** |
| 9 | Before/after purchase gating | All three gated endpoints correct for a real purchaser and a stranger |
| 10 | No manual DB edit props up the demo | The one early manual `users` insert is superseded by `get_current_user`'s get-or-create path |
| 11 | **Mobile walkthrough at 375px** | **Closed 2026-08-14** — walked by the owner on a real device. See §3 |

Day 5's separate checklist also closed CORS (verified in both directions against production — an arbitrary origin is rejected with 400) and the deliberate gating-break attempts (no token → 401, garbage token → 401, non-entitled JWT → denied on all three resources).

## 3. The mobile walkthrough, and what it found

This was the last item standing, and the plan was explicit that it *"needs a human holding a phone"* — no API call could substitute for it. The owner walked it on 2026-08-14.

**It found one defect, which is the point of walking it.** On the homepage's closing search panel, the "Find an answer" button is absolutely positioned over the input, with 128px of right padding reserved for it. At 375px that left roughly 163px of visible field for a 200px placeholder, so the prompt read as *"What are you trying t…"* with the button sitting on top of it.

Fixed the same day in `frontend/src/pages/Home.tsx`: the form stacks below 640px — full-width field, full-width button beneath it — and keeps the overlaid treatment from `sm` up, where there is room for it. This is the same shape as the newsletter form directly below it, so the two now read as one pattern.

> **A note on the tick.** Item 11 is recorded on the owner's report of having walked the path, not on my own observation — I cannot hold a phone. If the walkthrough was partial rather than the full 13-step script at `week1_plan.md:372`, this tick should come back off and the remaining steps run. It is recorded here precisely so that is easy to check rather than buried.

**A second defect surfaced at the same time, at every viewport, and is also fixed:** following any link — footers especially — left the reader at their previous scroll position on the new page, typically looking at the next page's footer. A browser does this correctly for free on a full page load; a single-page app does not. `ScrollToTop` in `RootLayout.tsx` now puts each new page at the top of itself, deliberately leaving three cases alone: back/forward navigation (the reader wants the position they left), in-page anchors like `#free-pack`, and query-string-only changes — because `/questions` holds its entire filter state in the URL, and keying on the full location would throw the reader to the top on every chip tap.

## 4. What has changed since Week 1's evidence was recorded

Two things. Both were honest at the time and are no longer true, which is exactly what a retrospective sign-off exists to catch.

### 4.1 The Week 1 data is gone

On 2026-08-12 every user-data table was found empty — `auth.users`, `users`, `orders`, `entitlements`, `lesson_progress`, `leads`, `audit_log` — while all content tables were intact. **This was intentional** (decision #18, answered 2026-08-12); no recovery was needed.

The consequence stands regardless of intent: **the rows cited as Week 1's evidence no longer exist.** The verifications were genuine when made. The records are not there to re-inspect. This is why Week 2's W2-R1 exists as a requirement at all.

It also sets a real cost for later. A second wipe, once there are real customers, would destroy purchase records that cannot be reconstructed — and Supabase's free tier has no point-in-time recovery. **PITR should be named and priced as a cost before the first live transaction**, per the brief's "every recurring fee is named and justified."

### 4.2 No customer can currently be emailed — a regression against item 8

Week 1 ticked the receipt email having delivered live, via Mailjet, after Resend and Brevo were each tried and found gated behind domain ownership or account approval.

**Mailjet has since been removed.** The transport story settled on Resend as the sole provider (`config.py:30` now ignores any leftover Gmail/Mailjet/Brevo variables) — Gmail and Brevo SMTP were dropped because Render blocks outbound port 587, and Mailjet was working over REST when it was removed by choice.

Resend is running on its **sandbox sender**, `onboarding@resend.dev`, which can only deliver to the account's own address. `email_service.py`'s own module docstring is unambiguous about the consequence:

> *"while this file is Resend-only, NO REAL CUSTOMER RECEIVES ANY EMAIL — every send is redirected to the owner's inbox and labelled undelivered."*

So Week 1's item 8 was true when it was ticked and **is not true of the code that exists today.** A receipt now arrives at `OWNER_NOTIFICATION_EMAIL`, prefixed `[Not delivered to buyer]`.

This is a deliberate holding position for a test-mode store, not an accident, and it is fine for exactly as long as the store stays in test mode. It is the first of the two conditions on this Go because it fails silently: checkout succeeds, the entitlement lands, the buyer gets nothing, and no error appears anywhere. `docs/email.md` already has the domain options researched; Mailjet is the fastest route back if verifying a domain proves slow.

## 5. Conditions on the Go

| # | Condition | Status | Blocks |
|---|---|---|---|
| 1 | A sending domain verified with Resend, so a buyer can be addressed | **Open** — sandbox sender only | The first real payment |
| 2 | Stripe test → live as an explicit call (decision #21) | **Open** — `rk_test_` in use | The first real payment |
| 3 | PITR named and priced before the first live transaction | **Open** | The first real payment |
| 4 | IP provenance of the vendor-risk template files confirmed | **Open** — owner only | Taking real money for the A$39 product |

None of the four blocks Week 3 engineering. All four block launch.

## 6. The standing non-technical risk

**Decision #15 — who owns the Vercel, Render, Supabase, Stripe and Mux accounts — has now been asked three times across two weeks and remains unanswered.**

It breaks nothing technical, and that is precisely why it keeps getting deferred. It breaks the Week 4 handover, at which point it is too late to be a scheduling question. Related: decision #16, who else can see this repository today.

This is the largest non-technical risk on the project and it is not getting smaller.

## 7. Assessment

Week 1 did the hard thing it was supposed to do: it proved a complete commercial path with real infrastructure and real money movement, rather than demonstrating a convincing-looking front end over stubs. Every gate was tested from the outside — direct endpoint calls, missing tokens, tampered tokens, another user's identity — and every one failed closed.

What Week 2 then added did not weaken it. The gating suite turned "the paywall holds" from an anecdote into 25 pytest cases plus a Playwright pass, each one **observed failing** with its guard removed before being trusted green (`gating_seen_red.md`). The block migration that rewrote live lesson content was verified byte-exact against the pre-migration fields for all three existing lessons (`lesson_block_render_parity.md`). Neither of those was assumed.

The honest weaknesses are that the evidence base for Week 1 was deleted, that email delivery has regressed to nothing since it was signed off, and that the two most consequential open questions on the project — account ownership and what a domain pack actually contains — are both waiting on the owner rather than on engineering.

**Go. Build Week 3. Do not take a real customer's money until §5's four conditions close.**

---

## 8. What I need from you

`week1_plan.md:394` — *"You have responded with a go/no-go decision."* — is the one line here I cannot close on my own. It needs your answer, not mine.

Alongside it, in priority order: **#15** (account ownership, third time of asking), **#19** (what a domain pack contains — it is the last piece of Week 2 scope), **#17** (the refund window, commercially), **#21** (test or live Stripe), and a 30-minute slot for **#23**, the watched usability test.

---

*Closes `week1_plan.md` Day 5 steps 6 and 7, and ledger items 4 and 5 in `week2_plan.md` §28.*
