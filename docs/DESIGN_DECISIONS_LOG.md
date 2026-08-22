# Design Decisions Log — 2026-08-22

**Session:** Buffy (AI agent)
**Scope:** Home page products section, admin metrics, course filters, sidebars, command palette, discount banner, cookie consent, video token-expiry, FactStrip, mobile sticky bars

---

## 1. Home — Products Section Redesign

### 1.1 Initial Bento Grid (replaced)

**Decision:** Three-column bento grid with horizontal scroll carousels inside each tile.

**Why rejected:** The user found the three-box structure too rigid — "i dont like it three boxes like structure". The bento tiles with colored top rules, icon tiles, and boxed carousels read as three separate containers rather than a cohesive section.

### 1.2 Editorial Rows (final)

**Decision:** Full-width editorial rows separated by hairline borders, no card wrappers.

**Structure per row:**
- Icon + `text-h3` title + inline "See all →" on the right (desktop)
- Description text below the title
- Full-width horizontal scroll of product mini-cards
- Mobile "See all" link duplicated below each row

**Why:**
- Removes the visual weight of three stacked boxes
- Each product type gets its own breathing room without container boundaries
- Full-width scroll gives the carousel more space and feels less cramped
- Hairline separators (not gaps + borders) read as an editorial index, not a card grid
- Matches the "private bank meets editorial publisher" brand direction

### 1.3 Free Template CTA

**Decision:** Gold-accented banner at the bottom of the products section with download icon, sparkle "Free" badge, and hover-reveal "Get it free" label.

**Why:** The free template is the lowest-commitment entry point. It needs to be visually distinct from the paid product rows (gold treatment, not the same hairline separation) and placed where a reader who scrolled past all three rows would see it.

---

## 2. Mini Product Cards

### 2.1 Course Cards

**Decision:** `CourseArt` (generative duotone) at 16:9, domain eyebrow, title, lesson count. Width `w-48 sm:w-56`.

**Why:** CourseArt is the visual differentiator — it uses the re-hued domain colour and the generative arc motif. Showing it on the card makes courses visually distinct from packs and templates at a glance.

### 2.2 Pack Cards

**Decision:** Gradient icon tile (accent/12 to accent/4) with Library icon, title, question count.

**Why:** Packs don't have cover images or artwork. A gradient tile with the accent icon is honest about the absence while still giving the card a visual anchor. The gradient uses the same `color-mix` technique as CourseArt's duotone for consistency.

### 2.3 Template Cards

**Decision:** Format badge (XLSX, DOCX, etc.), title, description, price/Free.

**Why:** Templates are file-based — the format IS the key decision criterion. Leading with the format badge (mono, uppercase, muted) signals "this is a file" before the reader processes the title.

---

## 3. Horizontal Scroll Carousels

### 3.1 ProductScrollRow

**Decision:** `overflow-x-auto`, `snap-x snap-mandatory`, hidden scrollbar, with scroll arrow buttons on hover.

**Components:**
- Left/right arrow buttons (`ChevronLeft`/`ChevronRight`) — appear on `group-hover/scroll`
- Gradient fade edges (`w-8` from card bg to transparent)
- Smooth scroll by 75% of container width
- Keyboard accessible via `focus-visible:opacity-100`

**Why arrows:** The RelatedRail component already uses this pattern. It's the standard for horizontal carousels across Coursera, Udemy, and DataCamp. Hidden scrollbar keeps the design clean while arrows provide explicit navigation.

### 3.2 Scroll Detection

**Decision:** `useRef` + `useEffect` scroll listener, `canScrollLeft`/`canScrollRight` state, checked on scroll and resize.

**Why:** Arrows that show when there's nothing to scroll to are confusing. The detection is lightweight (4px threshold) and updates on both scroll and resize.

---

## 4. Admin Metrics — snake_case to camelCase

### 4.1 Pydantic Alias Generator

**Decision:** Added `alias_generator=_to_camel` and `populate_by_name=True` to all metrics Pydantic models (`MetricOut`, `MetricsOut`, `RevenueSeriesPoint`, `RevenueSeriesOut`).

**Why:**
- Frontend TypeScript types use camelCase (`revenueGrossCents`, `generatedAt`, `productRankings`)
- Backend Python variables stay snake_case (PEP 8 convention)
- `alias_generator` converts automatically at serialization time
- `populate_by_name=True` allows construction with either case

### 4.2 Dict Key Changes

**Decision:** Updated dict keys in `_get_product_rankings`, `_get_recommendation_rankings`, `_get_revenue_series` to camelCase.

**Why:** Pydantic's alias generator only works on model fields, not raw dicts returned as `list` or `dict` type hints. The dict keys must match what the frontend expects.

---

## 5. Course Filters (Level + Duration)

### 5.1 Database Fields

**Decision:** Added `level` (String 50, nullable) and `estimated_duration_minutes` (Integer, nullable) to the `courses` table via migration 025.

**Why:**
- Level is set by the admin (beginner/intermediate/advanced) — a course property
- Duration is computed from lesson media durations and stored denormalized for fast reads
- Nullable: courses without these fields still work, they just don't appear in filtered results

### 5.2 Filter API

**Decision:** Added query parameters `level`, `min_duration`, `max_duration` to `GET /courses`.

**Why:** Server-side filtering means the frontend doesn't need to fetch all courses and filter client-side. The filter is applied after the bulk queries but before building the output, so it's efficient.

### 5.3 Duration Computation

**Decision:** Duration is pre-computed from `Media.duration_seconds` for video/mixed lessons, summed per course. Applied as a Python-side filter after the bulk query.

**Why:** The `Media` table already stores `duration_seconds`. Computing from existing data avoids a new denormalized column that would need to be updated whenever lesson media changes. The filter runs in memory after the fixed handful of bulk queries.

### 5.4 Frontend Filter UI

**Decision:** Chip-based toggles for Level (Beginner/Intermediate/Advanced) and Duration (Under 30 min, 30–60 min, 1–2 hours, Over 2 hours). URL-param driven.

**Why:**
- Chips are the established filter pattern in the QuestionsCatalogue
- URL params preserve filter state across page refreshes and back-navigation
- `aria-pressed` on each chip for accessibility
- Duration buckets are human-readable ranges, not raw minutes

### 5.5 Course Card Metadata

**Decision:** Level and duration shown in the `Meta` row on each course card, after modules and lessons.

**Why:** The Meta component already handles the icon + value layout. Adding level/duration as additional items keeps the card dense without adding a new visual pattern.

---

## 6. Sidebars — Scrollable + Simplified Collapse

### 6.1 Scrollable Sidebars

**Decision:** Changed `overflow-hidden` to `overflow-y-auto overscroll-y-contain` on all sidebar `<aside>` elements (member desktop, member mobile, admin).

**Why:**
- When nav items overflow the viewport height (many sections, small screen), the content was clipped with no way to reach it
- `overscroll-y-contain` prevents scroll chaining — sidebar scroll stops at its boundary instead of bubbling into the main content area

### 6.2 Simplified Collapse Toggle

**Decision:** Replaced the separate "Collapse" button with a `<` arrow beside the brand name ("Practicable" / "Admin Panel"). No text label, no wrapper div.

**Why (user direction):** "dont write collapse just an arrow < beside Practicable and Admin Panel"

**Implementation:**
- `SidebarBrand` accepts `onToggleCollapse` prop
- Expanded: `<` chevron to the right of the brand name
- Collapsed: `>` chevron below the brand icon (centered)
- Arrow is small (`size-7`), subtle (`text-stage-foreground/40`)
- Removed the `Collapse` text and the separate toggle button from `SidebarNav`

---

## 7. Video Token-Expiry State (C4)

**Decision:** When the Mux playback token expires mid-playback, preserve `currentTime`, refetch the token, resume playback. Show "Your session timed out — Refreshing…" overlay during refetch.

**Implementation (Learn.tsx + Lesson.tsx):**
- `onError` handler on MuxPlayer detects token expiry
- `playerRef.current?.currentTime` captured before refetch
- `refetch()` gets a fresh token, MuxPlayer re-renders with updated `tokens` prop
- `requestAnimationFrame` restores `currentTime` and calls `play()`
- Overlay shows during the refetch gap

**Why:** "Losing someone's place in a paid 40-minute lesson is a refund-generator" (Redesigning_decisions.md §C4). Token expiry is a normal case, not an edge case.

---

## 8. FactStrip on Product Pages (D1)

**Decision:** Added `FactStrip` to PackDetail and Template pages.

**PackDetail facts:** Contents (question count), Format, File size, Access (Lifetime).
**Template facts:** Format, Sheets/Pages, Access (Free forever / Lifetime).

**Why:** The research found FactStrip as the single most consistent pattern across all 14 platforms. CourseDetail already had it; PackDetail and Template didn't.

---

## 9. Mobile Sticky Bottom Bars (E3)

**Decision:** Added fixed bottom action bars on PackDetail and Template for mobile (< `lg`).

**Pattern:**
- `fixed inset-x-0 bottom-0 z-30`
- Price on the left, action button on the right
- `backdrop-blur-sm` + `bg-background/95`
- `env(safe-area-inset-bottom)` for notched devices
- Extra bottom padding on the page content (`pb-24`) to prevent overlap

**Why:** On long product pages, the buy/download button scrolls off-screen. Every researched platform (Udemy, Coursera, DataCamp) keeps the CTA visible on mobile via a sticky bar.

---

## 10. Command Palette (⌘K)

**Decision:** Cross-type search across questions, courses, and templates via a ⌘K / Ctrl+K modal.

**Features:**
- Client-side search — fetches each list once when opened, filters locally
- Grouped results by type (Questions, Courses, Templates) with type icons
- Arrow key navigation, Enter to navigate, Escape to close
- Backdrop with blur, footer keyboard hints
- `useCommandPalette()` hook manages open/close state

**Header integration:**
- Marketing header: ⌘K chip with Search icon + "Search" label + `⌘K` kbd badge (md+ only)
- Member mobile header: Search icon button
- Member desktop: accessible via keyboard shortcut (no chip)

**Why:** The research docs (E2) called for a command palette as the primary cross-type search mechanism. It's the standard pattern in Notion, Linear, Figma, and Cmd+K is universally recognized by power users.

---

## 11. Discount Banner

**Decision:** Site-wide gold-toned banner: "15% off your first purchase — use code WELCOME15 at checkout" with one-click copy.

**Features:**
- Dismissible (localStorage, stays closed per browser)
- Copy button stores code in localStorage via `setActivePromoCode()`
- Checkout flows (ProductBuy, CartDrawer) read the stored code and pass it to the API
- Backend validates via Stripe Promotion Codes, applies to session

**Why:** The banner is the lowest-friction way to surface a promo code. Copying the code auto-stores it so the user doesn't need to remember it at checkout.

---

## 12. Cookie Consent

**Decision:** GDPR-compliant banner: "Only essential cookies for authentication, your cart, and display preferences. No tracking, no analytics, no third-party cookies."

**Features:**
- Fixed bottom on mobile, floating card on desktop (`sm:bottom-4 sm:left-4 sm:max-w-md sm:rounded-xl`)
- "Got it" button + privacy policy link + X dismiss
- Stored in localStorage — shows once until accepted
- Present on both MarketingLayout and MemberLayout

**Why:** Practicable uses only essential cookies (Supabase auth, cart state, preferences). The consent is a notice, not a choice between "essential" and "analytics" — because there are no analytics cookies. Stating this plainly builds trust.

---

## 13. Homepage Products Section — Editorial Layout

**Decision:** Replaced three-box bento grid with full-width editorial rows.

**Structure:**
```
SectionOpener (eyebrow + title + lead)
─── hairline ───
Icon + Courses title                    All courses →
Video, reading and downloadable...
[MiniCourseCard] [MiniCourseCard] [MiniCourseCard] →
─── hairline ───
Icon + Reference packs title            All reference packs →
Every question in a domain...
[MiniPackCard] [MiniPackCard] →
─── hairline ───
Icon + Templates title                  All templates →
Ready-to-use working files...
[MiniTemplateCard] [MiniTemplateCard] →
─── hairline ───
[Free template CTA banner]
```

**Why:**
- Three boxes felt rigid and "boxy" — the user explicitly rejected this
- Full-width rows give each product type more breathing room
- Hairline separators read as an editorial index (broadsheet/column treatment)
- The section now reads as a cohesive list, not three separate containers
- Large `text-h3` titles give each type visual weight without needing a colored top rule

---

## 14. Import Cleanups

**Decision:** Added missing imports as needed:
- `CourseArt` to Home.tsx (used in MiniCourseCard)
- `ChevronLeft`, `ChevronRight` to Home.tsx (scroll arrows)
- `useRef`, `useCallback` to Home.tsx (scroll detection)
- `Search`, `Sparkles`, `Download` to Home.tsx (bento icons, now removed)
- `useRef`, `useCallback` to Learn.tsx (video token-expiry)
- `useRef`, `useCallback` to Lesson.tsx (video token-expiry)

**Why:** Each new component or feature needed its dependencies imported. Missing imports cause runtime errors (e.g., "CourseArt is not defined").

---

## Files Modified in This Session

| File | Change |
|------|--------|
| `frontend/src/pages/Home.tsx` | Products section: bento → editorial rows, scroll arrows, imports |
| `frontend/src/pages/PackDetail.tsx` | FactStrip, sticky mobile bar, padding |
| `frontend/src/pages/Template.tsx` | FactStrip, sticky mobile bar, padding |
| `frontend/src/pages/CoursesCatalogue.tsx` | Level + duration filter chips, URL params, card metadata |
| `frontend/src/pages/ProductBuy.tsx` | Discount code passthrough |
| `frontend/src/pages/Learn.tsx` | Video token-expiry state |
| `frontend/src/pages/Lesson.tsx` | Video token-expiry state |
| `frontend/src/pages/admin/AdminMetrics.tsx` | camelCase types |
| `frontend/src/components/cart/CartDrawer.tsx` | Discount code passthrough |
| `frontend/src/components/ui/CommandPalette.tsx` | NEW — cross-type search |
| `frontend/src/components/ui/DiscountBanner.tsx` | NEW — promo code banner |
| `frontend/src/components/ui/CookieConsent.tsx` | NEW — GDPR consent |
| `frontend/src/lib/promo.ts` | NEW — promo code localStorage utility |
| `frontend/src/routes/_layouts/MarketingLayout.tsx` | CommandPalette, DiscountBanner, CookieConsent |
| `frontend/src/routes/_layouts/MemberLayout.tsx` | CommandPalette, CookieConsent, sidebar scroll, simplified collapse |
| `frontend/src/routes/_layouts/AdminLayout.tsx` | Sidebar scroll, simplified collapse |
| `backend/app/api/v1/admin/metrics.py` | camelCase aliases, dict key changes |
| `backend/app/api/v1/content/courses.py` | Level/duration fields, filter params, media duration query |
| `backend/app/api/v1/commerce/checkout.py` | Discount code passthrough |
| `backend/app/integrations/stripe_client.py` | Promotion code validation + application |
| `backend/app/db/models/course.py` | level + estimated_duration_minutes fields |
| `backend/alembic/versions/025_course_level_duration.py` | NEW — migration |
