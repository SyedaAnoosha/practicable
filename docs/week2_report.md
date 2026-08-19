# Week 2 — Report and Go/No-Go

**"Deciding in the Dark" Platform · 2026-08-15 · closes `week2_plan.md`'s own Phase 6 step 9 and ledger item 49**

*This is the standalone write-up `week2_plan.md`'s Definition of Done asks for. §0.5 and §28 of that document are its evidence base — this is the summary and the recommendation drawn from them, written against the repository as it stands today rather than against the week's original intentions.*

---

## The recommendation

> ## **GO for Week 3. Every engineering item on this week's ledger is closed.**
>
> Six requirements shipped in full: the gating suite, lesson blocks, discovery scoring, the storefront, domain packs, legal pages, analytics, and admin hardening's engineering half. Four owner decisions that had stalled since Week 1 — account ownership, GitHub access, the domain-pack content question, and the Resend sending domain — were all answered 2026-08-15, closing the largest non-technical risk on the project along with them.
>
> **What remains is not code.** A non-developer usability test, a vendor-risk IP confirmation, a real-device QA pass, and this document itself — all human actions this session cannot perform or simulate honestly. None of them block starting Week 3. One of them (the IP confirmation) blocks taking real money for the A$39 template, and the accepted email-sandbox position blocks taking real money for anything at all, until revisited.

---

## 1. What Week 2 set out to prove

> Prove the paywall holds automatically rather than anecdotally; make the flagship discovery surface behave the way the taxonomy promises; and make the store a store — three labelled content types, mixed-media lessons, legal cover, and enough measurement to decide Week 3 from evidence.

Nine requirements, W2-R1 through W2-R9. Every one of them is closed or has its engineering closed, which is the more precise claim — three of the nine (W2-R1, W2-R6, W2-R9) had a human-only tail that engineering was never going to be able to finish alone, and each of those tails is now the *only* thing left on it.

## 2. Requirement by requirement

| # | Requirement | Status |
|---|---|---|
| W2-R1 | Restore verifiable ground truth | **Closed** — see [`week1_go_no_go.md`](week1_go_no_go.md). The mobile walkthrough ran 2026-08-14 (two defects found and fixed); the Week 1 go/no-go is written with an explicit GO. One condition carries forward: no real customer can be emailed until a Resend domain is verified — see §5 |
| W2-R2 | The gating suite | **Closed.** 14 cases (the 13 named plus case 14 for packs), every one seen red before green (`gating_seen_red.md`), CI-wired, admin-bypass audit row closed |
| W2-R3 | Lesson blocks | **Closed.** All three pre-existing lessons verified byte-exact against their backfilled blocks (`lesson_block_render_parity.md`) |
| W2-R4 | Discovery scoring | **Closed.** Python/TypeScript parity enforced in CI from one shared fixture |
| W2-R5 | The storefront | **Closed.** Three labelled sections, honest prices, no dead tiles |
| W2-R6 | Domain packs | **Closed 2026-08-15** — the SKU shipped, not deferred. See §3 |
| W2-R7 | Legal pages | **Closed.** Terms, privacy, refunds, all marked draft, footer-linked |
| W2-R8 | Analytics | **Closed** on the code side; live PostHog verification stays `[UNVERIFIABLE]` without a real project key |
| W2-R9 | Admin hardening | **Engineering closed 2026-08-15** (autosave, inline blur validation, `/admin/orders`, the manual grant). The usability test itself is a human action — see §4 |

## 3. What changed since the ledger was last written

Four things moved this session, all originating from owner decisions answered 2026-08-15.

**The domain-pack SKU shipped, rather than staying deferred.** §2.1's own cut order put it first to cut, blocked on owner content the plan assumed only the author could produce. The owner's actual direction — design it from the files already in the repo — reframed the problem: the 100-question catalogue in `docs/questions/questions.json` *is* the author's own content, already live, already reviewed. `scripts/build_domain_pack.py` typesets each domain into a PDF, ordered by the same rule stated on its own cover: foundations before ambition, regulator-exposed before not, cheap before expensive — the brief's "what can I fix in a fortnight, cheaply, that my regulator cares about?" read back as a sort order. `db/seed/014_seed_domain_pack.py` seeds the pack as an ordinary product — one `template` row for the PDF, N `question_set` rows for the domain's questions — using no new entitlement mechanism, per RS 5.6's own requirement. Risk (60 questions, a 31-page PDF) is content-ready; the other four domains generate but are flagged too thin to publish honestly (`MIN_QUESTIONS_TO_PUBLISH = 20` in the seed script). What's left to actually sell one is not code: upload the PDF to Storage, create its Stripe Price, re-run the seed script with both.

**Inline blur validation shipped**, closing the one remaining engineering gap in Phase 6. `lib/useFieldValidation.ts` is deliberately dependency-free — `react-hook-form` and `zod` are both installed and neither is used anywhere in the codebase, and introducing a form library's value-ownership model for the first time, across three editors, in one pass, was a larger and riskier change than the gap it closes. The hook owns only validity, never values, which is what makes "a valid field is never cleared because another failed" true by construction rather than by careful coding. Wired into every required field across `AdminQuestions`, `AdminTemplates` and `AdminCourses` — including both Mux video-attach modals and the file-block template picker, not just the two top-level forms.

**Two Week 1 items closed**, formally, in [`week1_go_no_go.md`](week1_go_no_go.md): the mobile walkthrough (two defects found — a truncated hero placeholder at 375px, and scroll position carrying across every route change — both fixed the same day) and the Week 1 report itself, with a GO recommendation.

**Four owner decisions closed**, three of them stalled since Week 1 Day 1:
- **#15/#16 — account and repo ownership.** Answered: every account and the repository belong to the owner. This was, in the previous version of this plan's own words, "the largest non-technical risk on the project." It no longer is.
- **#19 — what a domain pack contains.** Answered by unblocking the artefact rather than waiting on new copy, as above.
- **#14 — the Resend sending domain.** Answered "leave it as it is" — no domain is currently available to verify. This is recorded as a decision, not a non-answer: the consequence (no real customer can be emailed) now stands deliberately. See §5.

## 4. What's left, and why it isn't code

Every remaining open item is a person, not a missing feature:

| Item | What it needs |
|---|---|
| Non-developer usability test (§31.3, decision #23) | 30 minutes, a real non-developer, watched, unaided, adding a lesson |
| Vendor-risk IP confirmation | The owner's word on the provenance of the six template files in Storage |
| §62 release QA sweep | A real phone and a real card — the automatable slice (raw-hex grep, axe) already ran clean |
| This document | Was the last item; closes with this write-up |

None of these block Week 3 development starting. Two of them — the usability test and the IP confirmation — are worth scheduling soon: the first is the only remaining evidence for whether a non-developer can actually use the admin tool, and the second blocks the A$39 template from taking real money.

## 5. Conditions that carry into Week 3, unchanged from Week 1's report

Nothing here is new; both were named in [`week1_go_no_go.md`](week1_go_no_go.md) §5 and neither has moved, by design in one case:

1. **No real customer can be emailed.** `email_service.py` stays on Resend's sandbox sender. This is now a deliberate holding position (decision #14, answered 2026-08-15), not an open item — but the consequence is unchanged: any receipt or sale-notification email still arrives `[Not delivered to buyer]`-prefixed at the owner's own inbox, not the buyer's.
2. **Stripe is still in test mode** (decision #21, still open) — a restricted `rk_test_` key, not a live one.

Both are launch conditions, not Week 3 conditions. Week 3 can proceed against them exactly as Week 2 did.

## 6. Assessment

Week 2's stated objective was to prove the paywall holds automatically, make discovery behave the way the taxonomy promises, and make the store an actual store. All three are true today, verifiably: 14 gating cases each observed failing before being trusted green, a scoring model enforced identical in two languages by one shared fixture, and a storefront with three honestly-priced content types including, as of this session, the fourth SKU the plan itself had flagged as the most likely thing to slip.

The pattern worth naming for Week 3: every item that looked stuck on this ledger was stuck on a decision, not on engineering capacity. Four decisions closed in one exchange today closed five ledger items and the project's largest standing risk along with them. The lesson isn't "engineering was slow" — the mechanism for the pack was buildable the whole time, as the plan itself said (`the engineering path can be built without the artefact`) — it's that a fast decision turns a deferred requirement into a shipped one in the same session.

**Go. Start Week 3.** The four items left are calendar entries, not development work — schedule the usability test and the IP confirmation early, since both feed directly into whether the A$39 template and the admin tool are actually trustworthy in front of a stranger.

---

*Closes `week2_plan.md` Phase 6 step 9 and ledger item 49. Sourced from §0.5 and §28 of that document, and from [`week1_go_no_go.md`](week1_go_no_go.md), [`gating_seen_red.md`](gating_seen_red.md) and [`lesson_block_render_parity.md`](lesson_block_render_parity.md).*
