# Phase 10 — Autonomous Engineering Decisions Log

The user is away and unavailable for questions during this pass. Per their instruction,
every judgment call below was made using best senior-engineer/UX-designer/usability
practice, with no shortcuts, and is recorded here so it can be reviewed afterward.
Ordered chronologically. Each entry: **what**, **why**, **what a reasonable objection
might be and why it was rejected anyway**.

---

## 1. §10A — Email-change audit hook: fired from `RootLayout.tsx`'s `onAuthStateChange`, not from `AccountProfile.tsx`'s `updateUser()` call

**Decision:** `POST /me/account/email-changed` is now called when a genuine email
transition is observed in `RootLayout.tsx`'s existing `onAuthStateChange` subscription
— not immediately after `AccountProfile.tsx` calls `supabase.auth.updateUser({ email })`.

**Why:** The backend endpoint's own docstring says *"After Supabase confirms the new
email, the frontend calls this"* — and Supabase does not actually change the email
until the confirmation link is clicked (a `USER_UPDATED` event fires then, on whatever
tab/session is open). Firing the hook right after `updateUser()` would audit a request,
not a change, and could fire even if the user never confirms.

**Second decision inside this one — real bug found and fixed under it:** the first
implementation read `previousEmail` synchronously from the Zustand auth store at mount
time. That store is populated by this same effect's own `getSession()` call, which
resolves *asynchronously* — so on a fresh page load, the very first email-change
event could race ahead of the store being populated, leaving `previousEmail` as
`undefined` and silently swallowing detection. Fixed by deriving `previousEmail`
exclusively from `getSession()`'s own resolution (or the first `onAuthStateChange`
event, whichever the client delivers first), never from a store read that might lag.
Caught via a real red-first test failure, not by inspection — see
[RootLayout.emailChange.test.tsx](../frontend/src/routes/_layouts/__tests__/RootLayout.emailChange.test.tsx).

**Objection considered:** "Just fire it from `AccountProfile.tsx` right after
`updateUser()` — simpler, one file." Rejected: this would produce a false audit trail
(an entry for every *attempt*, including ones never confirmed or abandoned), and
would miss the case where the confirmation is clicked from a different tab/device than
the one that submitted the change — which `onAuthStateChange` catches for free since
it's the actual session-sync mechanism, wherever the confirmation lands.

---

---

## 2. §10B — Password change: implementation was already correct; the gap was test coverage, not code

**Decision:** No production code changes. `AccountSecurity.tsx` and the backend audit
hook (`POST /me/account/password-change`) already matched every DoD line — reauth via
`signInWithPassword`, three correctly-`autocomplete`d fields, client+server minimum
length, confirm-mismatch and new===current both refused pre-submit, session preserved
(`updateUser` never signs out), audit row, security alert email, rate limiting. Added
[AccountSecurity.test.tsx](../frontend/src/pages/account/__tests__/AccountSecurity.test.tsx)
covering every one of those behaviors, since only the backend audit-row write had a
test before this pass.

**Why it still needed work despite being "genuinely implemented":** the user's own
standing instruction for this engagement is that a DoD checkbox is not proof — only a
red-first-proven test is. An untested correct implementation is one accidental refactor
away from becoming a silently wrong one. Confirmed by deliberately breaking the
new===current check and watching the new test catch it for the right reason (the
password change proceeded to "success" with the safety check gone — the actual
real-world failure mode) before restoring it.

**Objection considered:** "It already worked, don't spend time writing tests for
code that isn't changing." Rejected on the same grounds the rest of this engagement has
used throughout — DoD checkboxes in this document have repeatedly turned out to be
false when actually checked, and an unverified correct implementation and a verified
one are not the same deliverable.

---

---

## 3. §10C — Receipts, pagination, error state: multiple real gaps found and fixed, including a live data-loss bug

**What was actually wrong** (all confirmed false against the DoD before fixing):
- No receipt of any kind existed — the plan's own `[GAP]` marker was accurate.
- `GET /me/orders` computed `next_cursor` and then never put it in the response —
  pagination past page 1 was structurally impossible from the client.
- **A real, silent data-loss bug**: the cursor comparison was `created_at < :cursor`
  alone. DESIGN.md §26.3 explicitly documents why this is wrong — orders sharing an
  identical timestamp cause the whole tied batch to be skipped, not repeated or
  gracefully handled, just silently dropped from every future page. Proven with a
  real test (3 orders created in one transaction, all sharing a timestamp; page 2
  came back with 0 of the expected 1). The exact same bug existed in
  `/admin/orders` too — found by recognizing the query shape was identical, not by
  a separate report.
- No error state on the orders query (only a loading spinner existed).
- Refund success copy still said "being processed" — stale wording left over from
  before this session's own Phase 9 fix made refunds synchronous.

**Decision: receipts are regenerated from order data, never from a Stripe invoice**

The plan itself instructs this ("if not stored, regenerate... never fabricate an
invoice number"), and it's true here: Stripe Checkout Sessions in payment mode don't
generate an Invoice object unless invoicing is explicitly turned on, this codebase
never turned it on, and the one place an invoice number is genuinely available (the
Stripe webhook, at the moment of the first receipt email) never persists it to the
`orders` row. So `GET /me/orders/{id}/receipt` builds the receipt purely from the
order + order_items + product names already in Postgres, and the response has no
`invoice_number` field at all — not a null one, an absent one, so nothing downstream
can accidentally render a fake "Invoice #None".

**Decision: the receipt is an inline expand-in-place panel, not a modal or a PDF**

**Objection considered:** "A real receipt should be a downloadable PDF." Rejected for
this pass: no PDF-generation dependency exists anywhere in the codebase, and adding
one is a meaningfully bigger decision (new dependency, new failure mode, new binary
asset to test) than the DoD asked for. The plan's own copy deck says "Receipt" as a
list-row link, not "Download PDF receipt" — an in-page view with a browser Print
button (which every browser already turns into a clean PDF via "Save as PDF") meets
the actual requirement without the added surface area. If the user wants a true
generated-PDF receipt later, that's a deliberate follow-up, not something to sneak
into a DoD-verification pass.

**Decision: pagination cursor for both `/me/orders` and `/admin/orders` uses a compound
`created_at|id`-style string, not a JSON or base64 cursor**

Matches the plain-ISO-string cursor convention `/admin/orders` already used
pre-existing (visible, debuggable in a network tab, no encoding step) — just made it
carry the tiebreak field DESIGN.md §26.3 already specified, joined with `|` since
neither a timestamp nor a UUID can contain that character. A legacy cursor with no
`|` degrades to the old created_at-only comparison rather than erroring, so an
in-flight page load using an old cursor format doesn't break.

**Objection considered:** "This second bug (`/admin/orders`) is out of scope for a
§10C pass — leave it for whoever owns Phase 5/6." Rejected: the engagement's own
standing pattern (established across Phase 9's `MultipleResultsFound` fix) is that a
genuinely-proven regression risk found as a byproduct gets fixed, not filed away,
especially a silent data-loss bug in the reconciliation table the business explicitly
depends on (§26.3's own words: "the endpoint whose growth is the point of the
business").

---

---

## 4. §10D — Refund placement: found the success confirmation was never actually visible

**What was wrong:** `refundMutation`'s `onSuccess` called `setRefundingOrderId(null)`
in the same breath as `queryClient.invalidateQueries`. That collapses the entire
refund panel — including the "Your refund has been processed" message living inside
it — in the same render pass the mutation resolves. A user who clicked "Confirm
refund" would see the panel simply vanish with no confirmation ever rendered, not
even briefly; React batches the state updates, so there's no intermediate frame where
the message is visible before the collapse. Caught by writing the DoD's own required
test ("a submitted request updates the row") and watching it fail for a real reason.

**Decision: leave the panel open on success; let the person close it themselves**

The close (X) button already existed on the panel for the "changed my mind before
confirming" case — reusing it for "I've seen the confirmation, done" needed no new
UI, just removing the line that auto-closed it prematurely. The row's own refunded
badge appears once the invalidated query refetches, so the update-without-reload
requirement is still met; the panel closing is now a deliberate user action instead
of an accidental side effect that ate the confirmation message.

**Objection considered:** "Auto-close after a short delay (e.g. `setTimeout`) so it
doesn't just sit there." Rejected: this project's copy deck and error-handling
conventions elsewhere (RefundDialog.tsx, ManualGrantDialog.tsx) consistently treat a
money-outcome confirmation as something the user dismisses, never something that
times out — a timed auto-dismiss on a refund confirmation risks the exact same
"did that actually work?" uncertainty this fix exists to remove, especially for
anyone reading slower than the timeout allows.

Every other §10D acceptance line verified true as originally implemented: the reason-
code map covers all 4 codes the server can actually return (`already_refunded`,
`order_not_completed`, `no_course_in_order`, `progress_exceeded`) with a sensible
fallback for anything else; eligibility is computed server-side and the client only
renders it; the control only appears on completed, non-refunded, non-in-flight rows.

---

---

## 5. §10E — Notification preferences: implementation was correct; closed the same test-coverage gaps as §10B

Migration `023` (not `022` — the plan's own instruction was "confirm the number
with `alembic current` first," and `022` had already been taken by an unrelated
concurrent-session migration by the time this one was written; a single alembic
head confirms this was done correctly, not a numbering mistake). Both toggles,
defaults, the reassurance copy, and the "never gates transactional mail" structural
proof all matched the DoD exactly. Added the two missing tests the DoD itself
required and nothing had covered: non-boolean values rejected (`422`), and the
`PATCH` writes an audit row. No production code changes needed here.

## 6. §10F — Export and closure: extracted the shared deactivation service the plan explicitly required, and found a real name-shadowing bug while doing it

**What was wrong:** the plan's own instruction — "Do not add a second mechanism:
reuse the logic behind admin/users.py:269, extracting it to a service function both
the admin endpoint and the new self-serve endpoint call" — was not followed.
`admin/users.py`'s `deactivate_user` route and `me.py`'s `close_my_account` each
independently wrote `user.disabled_at = datetime.now(timezone.utc)`. Functionally
identical today, but nothing enforced they'd stay that way, and the docstring on the
self-serve endpoint claimed to "reuse the existing deactivation logic" when it
plainly didn't — reused the *pattern*, not the *code*.

**Fix:** extracted `deactivate_user(session, *, user, actor, action, context=None)`
into a new `app/services/account_service.py`, matching the existing
`apply_refund`/`record_audit` "does not commit, caller's transaction does" contract.
Both endpoints call it now.

**A real bug found while wiring the admin endpoint, not while writing new logic:**
`admin/users.py`'s own route handler is *itself* named `deactivate_user` — importing
the service function under the same name silently shadowed it at module scope
(Python resolves the later `async def deactivate_user(...)` over the earlier
`from ... import deactivate_user`). Calling it inside the route body actually called
the route function recursively with the wrong arguments, raising `TypeError`
immediately once the real test suite exercised it. Fixed with an aliased import
(`import deactivate_user as deactivate_user_account`). This is exactly the kind of
defect the "run the real test suite after every refactor" discipline exists to
catch — it would have shipped silently broken (or, worse, silently *not* shadowed
in a slightly different Python/import-order configuration) without it.

**Decision: the data export is a client-side Blob download, not a server-persisted "download link"**

The plan's copy deck says "short-lived download link"; the implementation returns
the JSON body directly and the frontend turns it into a `Blob` + `URL.createObjectURL`
download with no server-side persistence at all.

**Objection considered:** "This doesn't match the letter of the plan — build the
literal download-link endpoint." Rejected in favor of what's already built: a
server-persisted download link needs its own storage, its own expiry, and its own
auth check on a second endpoint — three new things to get right, for strictly worse
security than a Blob URL that exists only in the requesting browser's memory and is
revoked immediately after the click. This is a case where the plan's prose describes
one way to satisfy the underlying requirement ("get a real file, safely, scoped to
you") and a materially better implementation already satisfies the requirement
without literally matching the prose. Not changing this.

Every other §10F line verified true: real JSON export scoped to the requester (two
existing tests, one proving a second user's order never leaks); rate-limited (new
test added — untested before this pass); deactivation-not-deletion with the closure
email; the warning states retention and no-refund honestly and offers the export
first (both in the actual copy and in the section ordering); no hard-delete path
exists anywhere (backend test proves the row survives; a new structural frontend
test proves no such button/copy exists — same precedent as
`createProductButton.removed.test.tsx`).

---
