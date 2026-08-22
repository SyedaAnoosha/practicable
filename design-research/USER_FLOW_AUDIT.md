# Practicable — User Flow Audit

Companion to `PLATFORM_UI_UX_RESEARCH.md`. That document asks *how does the
product look*; this one asks *where does a person get stuck*.

**Method.** Flows were traced through the router and the components that
implement them, not inferred from page screenshots. Every claim below cites
the file and line that produces the behaviour. Where a claim is about
something absent, the search that found nothing is recorded so it can be
re-run.

**Date:** 2026-08-21 · **Scope:** frontend flows only. No backend, entitlement
or Stripe behaviour was changed or is proposed to change in the P0 fix.

---

## 0. Summary

The product's *post-purchase* flows are good and in several places better
than the competitor set: content-aware next steps after checkout, entitlement
polling with a timeout fallback, a resume-first dashboard, a persisted cart.

The defect is concentrated in one place: **the transition from anonymous
reader to paying customer.** A logged-out user who clicks any buy CTA is
redirected to sign-in, and after signing in is delivered to `/dashboard`
rather than back to the product. The product they were buying is not
recorded anywhere, so it cannot be returned to.

This is not a visual problem and no amount of restyling addresses it.

---

## 1. The flows, as actually implemented

### 1.1 Entry points

Routing is defined in `frontend/src/App.tsx:50-152`. Four chrome contexts:

| Layout | Auth | Routes |
|---|---|---|
| `MarketingLayout` | public | `/`, `/contact`, `/legal/*` |
| `CatalogueLayout` | public, member chrome if signed in | `/questions`, `/courses`, `/templates`, `/packs`, `/store`, all detail pages |
| `AuthLayout` | public | `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` |
| `MemberLayout` | **guarded** | `/dashboard`, `/library`, `/learn/*`, `/lessons/*`, **`/buy/:slug`**, `/checkout/*`, `/purchases` |

`CatalogueLayout` choosing member chrome for signed-in visitors on public
routes is a good decision and should be kept — a member browsing the
catalogue does not get dropped back into marketing chrome mid-session.

The placement of **`/buy/:slug` inside `MemberLayout`** is the origin of the
defect in §2.

### 1.2 The intended journey

The product model, per the research document, is:

```
Question → Answer → Learning → Template → Purchase → Apply
```

The question pages are free and unauthenticated, which is correct: they are
the acquisition surface. `Question.tsx` ends with a paid CTA, which is the
intended conversion point.

---

## 2. P0 — The buy flow dead-ends at sign-in

**Severity: highest. This is the revenue path.**

### 2.1 The mechanism

Three files interact:

1. **`routes/_layouts/MemberLayout.tsx`** (final lines) guards the route:

   ```tsx
   if (!user) return <Navigate to="/sign-in" replace />
   ```

   No return path is recorded — not in route state, not in a query
   parameter, not in storage.

2. **`pages/SignIn.tsx:46`** — after a successful sign-in:

   ```tsx
   navigate('/dashboard')
   ```

   Unconditional.

3. **`pages/SignUp.tsx:47`** — identical, also unconditional.

### 2.2 Evidence that no return-path mechanism exists

Searched the whole of `frontend/src` for every conventional spelling:

```
grep -rn "state: *{ *from\|returnTo\|redirectTo\|searchParams.get('next'\|from?.pathname" .
→ no matches
```

There is no mechanism to fix in place; one has to be introduced.

### 2.3 The resulting journey

```
/questions/:slug                    reader, engaged, has intent
   ↓ clicks "See what's included"
/buy/:slug                          guard fires, intent discarded here
   ↓ <Navigate to="/sign-in" replace>
/sign-in                            no context shown about what they wanted
   ↓ creates an account
/dashboard                          ← empty for a new account (see §2.5)
```

The user must now re-find the product unaided. `replace` on the redirect
also means the back button does not return them to the product.

### 2.4 Blast radius — 16 call sites

Every one of these links into `/buy/:slug` and inherits the dead end:

| File | Lines |
|---|---|
| `pages/Question.tsx` | 319, 350, 398 |
| `pages/CourseDetail.tsx` | 407, 452, 494 |
| `pages/PackDetail.tsx` | 270 |
| `pages/Template.tsx` | 263 |
| `pages/TemplatesCatalogue.tsx` | 167 |
| `pages/Dashboard.tsx` | 387 |
| `components/pricing/BundleCard.tsx` | 104 |
| `components/content/RoutedProducts.tsx` | 69, 84 |
| `components/content/SituationProducts.tsx` | 101, 120 |

`Question.tsx:317` carries this comment:

> *"One click to the pre-checkout summary, not into a catalogue. `/buy/:slug`
> sits under MemberLayout, whose guard redirects a logged-out click."*

The redirect was known. Where the user lands *after* it was never traced.
This is the characteristic signature of component-level review: each file is
correct on its own terms, and the defect lives in the seam between them.

### 2.5 Why the landing page makes it worse

`pages/Dashboard.tsx` renders its two orienting panels conditionally:

- the resume panel at `:202` requires `resumeCourse` — a course with
  `completed_lessons > 0`;
- the library grid at `:401` requires `library && !library.is_empty`.

A brand-new account satisfies neither. The user is therefore delivered from
an interrupted purchase to the emptiest screen in the product.

### 2.6 Recommended fix (P0, decided 2026-08-21)

Owner decision: **fix the return path; keep account-before-purchase.** Guest
checkout was considered and deferred — it would require the backend to link
an order to a user by email, which is out of scope for a frontend pass.

Three edits, no backend change, no entitlement change:

1. `MemberLayout` records the attempted location when it redirects
   (`?next=` on the sign-in URL, or route state — `?next=` is preferable
   because it survives a full page load, which `CartDrawer` performs).
2. `SignIn` reads it and navigates there instead of `/dashboard`,
   falling back to `/dashboard` when absent.
3. `SignUp` does the same, so the new-account path — the common one for a
   first purchase — is covered too.

**Required safety property:** the `next` value must be validated as a
same-origin relative path before it is used. An unvalidated `next` that
accepts an absolute URL is an open-redirect vulnerability. Accept only
values beginning with a single `/` and not `//`.

**Verification:** sign-out, click a buy CTA on `/questions/:slug`, sign in,
and confirm arrival at `/buy/:slug`. Repeat via sign-up. Confirm a bare
`/sign-in` still lands on `/dashboard`.

---

## 3. P1 — Two auth paths behave differently

`components/cart/CartDrawer.tsx:41-48` handles the same situation as §2, but
by a different route and with a better outcome:

```tsx
if (!user) { … window.location.assign('/sign-in') }
```

The cart survives, because `stores/useCartStore.ts:46` persists items to
`localStorage` under `practicable:cart` (only `items`; `isOpen` is
deliberately excluded, which is correct). So the user returns to
`/dashboard`, reopens the cart, and their selection is intact.

The drawer's button is also honest — `CartDrawer.tsx:144` reads
*"Sign in to checkout"* rather than implying immediate purchase.

**The inconsistency:** the cart path is recoverable and labelled honestly;
the direct `/buy` path is neither. The CTA at `Question.tsx:322` says
*"See what's included"* — which does not signal that an account is about to
be required.

**Fix:** the `next` mechanism from §2.6 covers the drawer too (hence
`?next=`, which survives `window.location.assign`). Separately, consider
whether buy CTAs should signal the account requirement for logged-out users.

---

## 4. What is already good — do not regress it

Recorded so that the redesign does not "fix" working behaviour.

**The free template gate** (`pages/Template.tsx:217-230`) is the strongest
flow in the product. Email only, no account:

> *"Enter your email and the template downloads straight away — no payment,
> no account."*

The comment at `:213` notes this is a soft gate, not a security boundary —
the API serves free templates to anyone. Correctly reasoned.

Note the asymmetry this creates: **the free path respects the user's time
and the paid path does not.** Fixing §2 removes the inconsistency.

**Post-purchase** (`pages/CheckoutSuccess.tsx`):
- `nextStep()` at `:30` picks the next action from what was actually bought —
  a template buyer is offered the download, not a generic "go to library".
- `:75-106` polls for entitlement rather than assuming Stripe's webhook has
  landed, with a `timedOut` branch at `:143` offering reload and support.
- The title at `:121` distinguishes *"Payment confirmed."* from *"You're in."* —
  it does not claim access before access exists.

This is more careful than most of the competitor set and should be left alone.

**Dashboard** (`pages/Dashboard.tsx:196-241`): resume-first, naming the
specific next lesson, with a real `role="progressbar"` carrying
`aria-valuenow`. Matches the research document's §6 finding.

**Member navigation** (`MemberLayout.tsx`): grouped under "Your work" and
"Products" — separating *things I own* from *things I could own*.

---

## 5. Gaps worth considering, not yet decided

Listed for triage. None are as costly as §2.

| # | Gap | Evidence | Priority |
|---|---|---|---|
| 1 | New-account dashboard has no first-run state | `Dashboard.tsx:202`, `:401` both conditional | **P1** |
| 2 | Buy CTAs don't signal the account requirement | `Question.tsx:322` "See what's included" | P1 |
| 3 | No `Tabs` / `SaveButton` component | absent from `components/ui/` | P2 (already planned) |
| 4 | No cross-type search in member chrome | `MemberLayout.tsx` `NAV_SECTIONS` | P2 (already planned) |

Gap 1 is a natural companion to the §2 fix: once users arrive at `/dashboard`
*intentionally* rather than by accident, its empty state becomes the genuine
first-run experience and deserves a designed state.

---

## 6. A note on the Practicable screenshots

`screenshots/_practicable/*.png` **cannot be used as before/after evidence
below the fold.**

Every section under the hero in `pages/Home.tsx` (`:303`, `:359`, `:438`,
`:520`, `:574`, `:633`) uses Framer Motion with `initial="hidden"` and
`whileInView="visible"`. In a headless `fullPage` capture the viewport never
scrolls, so those sections never intersect and remain at opacity 0. The
result is a correct hero above roughly 4,000px of blank ivory, plus the
sticky header re-composited at the bottom of the tall image.

**This is a capture artifact, not a rendering bug.** Reduced motion is
handled centrally by `<MotionConfig>` (`lib/motion.ts:6`), so real users with
`prefers-reduced-motion` see the content.

**Fix before re-capturing:** in `capture-practicable.js`, either scroll the
page to the bottom and back before shooting, or neutralise animation in the
page context, e.g.

```js
await page.emulateMedia({ reducedMotion: 'reduce' })
```

The existing preflight and per-route `EMPTY` assertions in that script are
good and should be kept — they were added after a run that captured 18 empty
skeletons. Worth extending the same scepticism here: **a screenshot that is
blank for a mechanical reason will pass a content assertion on the hero
alone.** Consider asserting on text from a below-fold section too.

---

## 7. Priority

| # | Change | Benefit | Effort | Risk | Priority |
|---|---|---|---|---|---|
| 1 | Return path after sign-in/sign-up (§2.6) | Unblocks the revenue path from 16 call sites | Low | Low | **P0** |
| 2 | Validate `next` as same-origin (§2.6) | Prevents open redirect | Very low | — | **P0, same change** |
| 3 | Screenshot capture fix (§6) | Makes visual evidence usable | Very low | None | **P0** |
| 4 | First-run dashboard state (§5.1) | Designed landing for new accounts | Low | Low | P1 |
| 5 | Signal account requirement on buy CTAs (§3) | Removes surprise | Very low | Low | P1 |

Items 1–3 are small, well-understood, and touch four files in total.
