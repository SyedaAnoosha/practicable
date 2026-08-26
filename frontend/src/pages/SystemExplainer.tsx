import { useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { StatusDot } from '@/components/ui/StatusDot'
import { cn } from '@/lib/utils/cn'
import { staggerContainer, riseItem, riseItemSm, inViewOnce } from '@/lib/motion'

/**
 * System explainer page: a three-part walkthrough of Practicable's architecture,
 * product flow, and admin surface. Converts the presentation script into a
 * scannable, interactive page.
 *
 * Same editorial system as About.tsx: no background blobs, no icon tiles, no boxed
 * card grids. Each part is an eyebrow-column section — heading and annotation on the
 * left, a hairline-divided accordion of that part's sections on the right. Thirty-two
 * identical icon chips would have been noise; the §numbers already identify each
 * section. Plane changes (`.band-cool`, `.band band-dotgrid`) mark the two moments
 * that aren't prose: the core loop and the stack summary. Sections reveal on scroll
 * via `inViewOnce`, not all at once at mount.
 */
export function SystemExplainer() {
  return (
    <div className="w-full">
      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="w-full py-14 sm:py-24">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mx-auto flex max-w-2xl flex-col items-center px-5 text-center sm:px-8"
        >
          <StatusDot label="System walkthrough" />
          <motion.h1 variants={riseItem} className="mt-5 text-h1 font-semibold text-foreground">
            How Practicable works
          </motion.h1>
          <motion.p variants={riseItem} className="mt-4 max-w-xl font-serif text-lead text-muted-foreground">
            A three-part explanation of the platform — from visitor to buyer to admin.
            Architecture decisions, the core loop, and what was built versus what was
            deliberately left out.
          </motion.p>
          {/* Facts, not adjectives — the third one is the honest part most writeups omit. */}
          <motion.p
            variants={riseItemSm}
            className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground/70"
          >
            32 sections · 3 parts · real bugs included
          </motion.p>
        </motion.div>
      </section>

      {/* ── Core loop ──────────────────────────────────────────────────────────
          A sequence, so it renders as one — arrows between words rather than words
          inside boxes, which turned six nouns into six buttons. */}
      <section className="band-cool w-full py-12 sm:py-14">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          className="mx-auto max-w-3xl px-5 text-center sm:px-8"
        >
          <motion.h2 variants={riseItem} className="text-h2 font-semibold text-foreground">
            The core loop
          </motion.h2>
          <motion.p variants={riseItemSm} className="mt-3 text-sm text-muted-foreground">
            Every screen in the product exists to serve one journey:
          </motion.p>
          <motion.ol
            variants={riseItemSm}
            className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-sm font-medium text-foreground"
          >
            {CORE_LOOP.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span>{step}</span>
                {i < CORE_LOOP.length - 1 && (
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                )}
              </li>
            ))}
          </motion.ol>
        </motion.div>
      </section>

      {/* ── Parts 1–3 ──────────────────────────────────────────────────────────
          One eyebrow-column section per part; the hairlines between parts do the
          grouping that the old per-section card boxes did. */}
      {PARTS.map((part, index) => (
        <section
          key={part.title}
          className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16"
        >
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={inViewOnce}
            className="grid gap-x-10 gap-y-4 md:grid-cols-[minmax(0,15rem)_1fr]"
          >
            <motion.div variants={riseItem}>
              <span
                className="text-sm font-medium tabular-nums text-primary"
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <h2 className="mt-1 text-h3 font-semibold text-foreground">{part.title}</h2>
              <p className="mt-2 hidden text-sm leading-relaxed text-muted-foreground/80 md:block">
                {part.note}
              </p>
            </motion.div>
            <motion.div variants={riseItem} className="border-t border-border md:border-t-0">
              {part.sections.map((s) => (
                <SectionRow key={s.id} section={s} />
              ))}
            </motion.div>
          </motion.div>
        </section>
      ))}

      {/* ── Architecture at a glance ─────────────────────────────────────────── */}
      <section className="band band-dotgrid w-full py-12 sm:py-16">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          className="mx-auto max-w-5xl px-5 sm:px-8"
        >
          <motion.h2 variants={riseItem} className="text-h2 font-semibold text-foreground">
            Architecture at a glance
          </motion.h2>
          <motion.p variants={riseItemSm} className="mt-3 max-w-xl text-sm text-muted-foreground">
            Buy, don&apos;t build: auth, payments, video, and email are all third-party.
            Only the risk-domain logic is ours.
          </motion.p>
          {/* A definition list is the honest markup — each row genuinely defines a term.
              Rows, not cards: eight near-identical tiles was the grid the design brief
              calls repetitive geometry. */}
          <motion.dl variants={riseItem} className="mt-8">
            {STACK.map((item) => (
              <div
                key={item.label}
                className="grid gap-1 border-t border-border py-4 last:border-b sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-6"
              >
                <dt className="pt-0.5 text-sm font-semibold text-foreground">{item.label}</dt>
                <dd className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>
      </section>

      {/* ── Bugs ─────────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
        >
          <motion.h2 variants={riseItem} className="text-h2 font-semibold text-foreground">
            Bugs that taught something
          </motion.h2>
          <motion.p variants={riseItemSm} className="mt-3 max-w-xl text-sm text-muted-foreground">
            The most useful part of the build was finding where the system could pass every
            test while the actual feature still failed for a person.
          </motion.p>
          <motion.ol variants={riseItem} className="mt-8">
            {BUGS.map((bug, i) => (
              <li
                key={bug.title}
                className="grid gap-2 border-t border-border py-6 last:border-b sm:grid-cols-[3.5rem_minmax(0,16rem)_1fr] sm:gap-6"
              >
                <span
                  className="text-sm font-medium tabular-nums text-muted-foreground/70"
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="text-base font-semibold text-foreground">{bug.title}</h3>
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                  {bug.lesson}
                </p>
              </li>
            ))}
          </motion.ol>
        </motion.div>
      </section>

      {/* ── Deliberately not built ───────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-5 pb-12 pt-4 sm:px-8 sm:pb-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          className="grid gap-x-10 gap-y-4 md:grid-cols-[minmax(0,15rem)_1fr]"
        >
          <motion.div variants={riseItem}>
            <h2 className="text-h3 font-semibold text-foreground">Deliberately not built</h2>
            <p className="mt-2 hidden text-sm leading-relaxed text-muted-foreground/80 md:block">
              Scope is a decision, not an omission.
            </p>
          </motion.div>
          <motion.div variants={riseItem}>
            <ul className="space-y-3">
              {NOT_BUILT.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                  <span
                    className="mt-[0.45em] size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-5 max-w-prose border-l-2 border-primary/40 pl-3 text-xs italic text-muted-foreground/70">
              The reason: those features should not come at the cost of the core path — finding
              content, purchasing it, and learning from it.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="w-full border-t border-border py-12 sm:py-16">
        <motion.div
          variants={riseItemSm}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-3 px-5 sm:flex-row sm:gap-4 sm:px-8"
        >
          <Link to="/store" className="w-full sm:w-auto">
            <Button size="lg" className="w-full gap-2 sm:w-auto">
              Browse the library
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </Link>
          <Link to="/about" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              About Practicable
            </Button>
          </Link>
        </motion.div>
      </section>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

/** One expandable walkthrough section: a hairline row, not a card. The §id does the
 *  identifying work an icon tile used to do, at zero visual cost. */
function SectionRow({ section }: { section: Section }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="group flex w-full items-center gap-3 py-4 text-left transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform duration-150',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground/60">
            §{section.id}
          </span>
          <span className="min-w-0 flex-1 text-sm font-semibold transition-colors duration-150 group-hover:text-accent">
            {section.title}
          </span>
        </button>
      </h3>
      {open && (
        <div className="pb-4 pl-11 pr-2">
          <p className="text-sm leading-relaxed text-muted-foreground">{section.summary}</p>
          {section.keyPoint && (
            <p className="mt-3 max-w-prose border-l-2 border-primary/40 pl-3 text-xs font-medium text-primary">
              {section.keyPoint}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Data ────────────────────────────────────────────────────────────────────

type Section = {
  id: number
  title: string
  summary: string
  keyPoint?: string
}

const CORE_LOOP = ['Question', 'Answer', 'Related content', 'Purchase', 'Learning', 'Action'] as const

const PART_1: Section[] = [
  {
    id: 1,
    title: 'Opening',
    summary:
      'Practicable is built around the book "Deciding in the Dark" — 100 real questions from risk leaders across five domains, each tagged across seven dimensions. The platform turns that content into a product where visitors find questions, read answers for free, and move into paid courses or templates.',
  },
  {
    id: 2,
    title: 'The brief and constraints',
    summary:
      'Four weeks, end to end. A stranger must find the site, understand it, buy something, receive access, and learn — without help. Paid content is server-enforced, not just hidden in the UI. Payments use hosted checkout. Video uses protected playback. A non-technical person must manage content through the admin.',
    keyPoint: 'Thin-slice approach: proved one complete path first, then expanded the catalogue.',
  },
  {
    id: 3,
    title: 'Technology stack',
    summary:
      'React + TypeScript + Tailwind (frontend). FastAPI + SQLAlchemy + Alembic (backend). Supabase Auth for sessions, Supabase Postgres for data. Mux for video. Stripe Checkout for payments. Mailjet for email. Vercel (frontend) and Render (backend).',
    keyPoint: 'Build product-specific business logic. Do not build auth, payments, video, or email from scratch.',
  },
  {
    id: 4,
    title: 'Content model',
    summary:
      'Three content types: courses (modules → lessons → progress), templates (downloadable artefacts), and questions (reference content). Sections sit at the root. Products sit above content as the commercial layer — a product can grant a course, templates, or other content. Price belongs to the product, not the content.',
    keyPoint: 'Publishing states: draft → review → published → archived. Draft content is blocked from public URLs.',
  },
  {
    id: 5,
    title: 'The entitlement gate',
    summary:
      'One source of truth for ownership: the entitlement record. Every protected resource passes through the same access check. The check happens before the resource is generated — before a video playback token, before a file URL, before protected lesson content. The frontend can show locks, but the server is the authority.',
    keyPoint: 'Questions are deliberately free. The paid boundary is courses, lessons, videos, and templates.',
  },
  {
    id: 6,
    title: 'Homepage and question discovery',
    summary:
      'The homepage is a question finder, not just a marketing page. Visitors search real questions and see results immediately. Quick filters connect to the actual question taxonomy. Earlier in the build, filters appeared to work but returned zero results because UI values did not match database values — fixed.',
  },
  {
    id: 7,
    title: 'Filtering and ranking',
    summary:
      'The search ranks questions by how closely they match constraints. Exact matches get the highest score; nearby values appear as close matches with explanations. This makes the taxonomy a decision tool, not just a label collection.',
  },
  {
    id: 8,
    title: 'Reading a question',
    summary:
      'The question page is intentionally editorial — more focused on reading, narrower content, less interface noise. All 100 questions and their guidance are free. The questions are the free entry point that lets someone judge quality before paying. Related courses and templates appear directly on the question page.',
  },
  {
    id: 9,
    title: 'Courses, templates and packs',
    summary:
      'Courses show complete syllabuses with access indicators. Templates show file type, price, page count, editability, and previews. Packs combine multiple pieces of content. Bundle pricing is calculated from underlying products — the displayed saving is real.',
  },
]

const PART_2: Section[] = [
  {
    id: 10,
    title: 'Starting a purchase',
    summary:
      'The app adds items to a cart, then hands the customer to Stripe\'s hosted checkout. No custom card form — card details never enter the frontend or backend.',
  },
  {
    id: 11,
    title: 'Stripe webhook and entitlement creation',
    summary:
      'After payment, Stripe sends a webhook. The event ID is checked for idempotency first. Order and entitlements are created in one transaction. Only after the commit succeeds do emails send. The success page checks the app\'s own entitlement state, not a browser redirect.',
    keyPoint: 'Payment + access in one transaction — preventing "paid but no access".',
  },
  {
    id: 12,
    title: 'Emails and purchase confirmation',
    summary:
      'After the transaction commits: receipt email, access-granted email, and welcome email (first purchase only). Emails are sent outside the transaction so a provider failure cannot undo a successful payment.',
  },
  {
    id: 13,
    title: 'Member dashboard',
    summary:
      'The dashboard focuses on "continue where you left off." It contains the dashboard, library, courses, questions, templates, downloads, and account settings.',
  },
  {
    id: 14,
    title: 'Library',
    summary:
      'Purchased content is grouped by type with different actions: Continue (courses), Download (templates), Read (packs). Each content type behaves differently — templates have no progress, questions have no lesson sequence.',
  },
  {
    id: 15,
    title: 'Learning and protected video',
    summary:
      'Video uses signed Mux playback. The server checks access first, then generates a short-lived playback token tied to the relevant playback resource. The frontend never acts as the authority for who can watch.',
  },
  {
    id: 16,
    title: 'Lesson completion and progress',
    summary:
      'Progress is calculated from completed lessons, not maintained as separate values. The outline, course page, and library all reflect the same progress state.',
  },
  {
    id: 17,
    title: 'Other lesson content',
    summary:
      'Lessons can contain reading and downloadable material. Protected downloads follow the same flow: auth → entitlement check → short-lived authorised access → delivery. No permanent public file URLs for paid content.',
  },
  {
    id: 18,
    title: 'Certificates',
    summary:
      'At 100% course completion, the platform issues a completion certificate with a public verification code. The wording is "Certificate of Completion," not accreditation — completion is verifiable, accreditation makes a different claim.',
    keyPoint: 'Lesson learned: generating a file successfully is not the same as verifying a person can use it. The PDF once rendered as a blank document.',
  },
  {
    id: 19,
    title: 'Search, notes and bookmarks',
    summary:
      'Global search across courses, templates, packs, and questions. Users can add private notes to lessons and bookmark content for later. Designed around returning to useful material, not social features.',
  },
  {
    id: 20,
    title: 'Reviews and ratings',
    summary:
      'Reviews require purchase/entitlement. Submissions start as pending and go into the admin moderation queue. Below 8 approved reviews, the rating is not shown — avoiding a 1–2 review rating that misrepresents the experience.',
  },
]

const PART_3: Section[] = [
  {
    id: 21,
    title: 'Switching to admin',
    summary:
      'The admin area is functional and usable, not competing visually with the customer product. The key requirement: a non-technical person can manage the catalogue without calling the developer.',
  },
  {
    id: 22,
    title: 'Questions management',
    summary:
      'The question catalogue with seven tags and publishing states. Draft questions are not just hidden from navigation — the backend blocks them from being publicly accessible.',
  },
  {
    id: 23,
    title: 'Course and lesson management',
    summary:
      'Courses with modules and lessons. The lesson editor supports reading content. A real bug: formatting stored incorrectly caused published lessons to render as dense text blocks.',
  },
  {
    id: 24,
    title: 'Template management',
    summary:
      'File uploads managed from the admin. A shared HTTP client was applying a JSON content type to multipart uploads by default — fixed by removing that default.',
    keyPoint: 'Shared infrastructure must be tested against different request types, not just the ones it was designed for.',
  },
  {
    id: 25,
    title: 'Packs and products',
    summary:
      'Packs assembled here; products control the commercial side. Content describes what it is. Products determine how it is sold and at what price.',
  },
  {
    id: 26,
    title: 'Orders and users',
    summary:
      'Order records: who purchased what, when, how much, and the resulting access state. Manual entitlement grants for unusual operational cases, logged with actor and reason.',
  },
  {
    id: 27,
    title: 'Promotions, reviews and audit',
    summary:
      'Promotions synced with Stripe. Reviews in a moderation queue (approve/reject/feature). Audit records operational actions.',
    keyPoint: 'Bug: promotion expiry date not passed to Stripe correctly — local DB had one date, Stripe accepted a different one.',
  },
  {
    id: 28,
    title: 'Metrics, leads and settings',
    summary:
      'First-party metrics (not a large tracking system). Leads from free entry points. Operational settings for running the platform without code changes.',
  },
  {
    id: 29,
    title: 'Design system',
    summary:
      'Two modes: editorial (questions, guidance — wider spacing, readable typography, narrower width) and product (dashboards, courses, admin — denser, action-oriented). Both share the same tokens and components.',
    keyPoint: 'Trust before decoration. Readability, pricing, ownership, and actions come before animation.',
  },
  {
    id: 30,
    title: 'Colour, typography and accessibility',
    summary:
      'Ivory background, blue primary, champagne gold secondary. Sans-serif for product, editorial serif for reading. Keyboard navigation, focus states, contrast, captions, reduced motion, and responsive layouts all tested.',
  },
  {
    id: 31,
    title: 'Real bugs and lessons',
    summary:
      'Endpoints calculating correct results but not committing. Rate limiter using the wrong value. Frontend passing types but failing on missing keys. Certificate PDF rendering blank. File uploads broken by shared headers. Promotion expiry lost between app and Stripe.',
    keyPoint: 'A green test suite does not automatically mean a feature works for a person.',
  },
  {
    id: 32,
    title: 'What is deliberately not built',
    summary:
      'Keyword search (not semantic). Completion certificates (not accreditation). No block editor for lessons. No AI chatbot. No team dashboards, enterprise procurement, subscriptions, social features, or large recommendation systems.',
  },
]

const STACK = [
  { label: 'Frontend', description: 'React, TypeScript, Tailwind CSS, React Router' },
  { label: 'Backend', description: 'FastAPI, Python, SQLAlchemy, Alembic' },
  { label: 'Auth', description: 'Supabase Auth — sessions, JWT, password reset' },
  { label: 'Payments', description: 'Stripe Checkout — hosted, card details never touch the app' },
  { label: 'Video', description: 'Mux — signed playback, upload management' },
  { label: 'Email', description: 'Mailjet — receipt, access, welcome, certificate' },
  { label: 'Storage', description: 'Supabase Storage (S3-compatible) — presigned URLs' },
  { label: 'Hosting', description: 'Vercel (frontend), Render (backend, Starter tier)' },
]

const BUGS = [
  {
    title: 'Webhook crash on invoice field',
    lesson:
      'The handler read session_data["invoice"]["number"], but Stripe sends invoice as a bare ID string. The crash sat above all email sends — buyers were charged, given access, and told nothing. The idempotency guard held, so no duplicate orders, but every email was lost.',
  },
  {
    title: 'Endpoints not committing',
    lesson:
      'Some endpoints calculated correct results but never committed the transaction. The API returned success, but the database was unchanged.',
  },
  {
    title: 'Certificate PDF was blank',
    lesson:
      'The PDF technically existed and had a plausible file size, but opened as a blank document because the text was not written correctly. Generating a file successfully is not the same as verifying a person can use it.',
  },
  {
    title: 'File uploads broken by shared header',
    lesson:
      'A shared HTTP client applied a JSON content type to all requests, interfering with multipart file upload boundaries. Fixed by removing the default.',
  },
  {
    title: 'Rate limiter using wrong value',
    lesson:
      'The rate limiter was configured with an incorrect threshold, meaning it could never trigger correctly in production.',
  },
  {
    title: 'Promotion expiry lost in transit',
    lesson:
      'The local database had one expiry date while Stripe continued accepting the promotion with no expiry. Fixed with a test that checks what is actually sent to Stripe.',
  },
]

const PARTS = [
  {
    title: 'Product, architecture & visitor experience',
    note: 'What a stranger meets before any money changes hands.',
    sections: PART_1,
  },
  {
    title: 'Purchase, access & member experience',
    note: 'From the checkout click to signed video playback.',
    sections: PART_2,
  },
  {
    title: 'Admin, design, testing & scope',
    note: 'Running the catalogue — and what stayed out on purpose.',
    sections: PART_3,
  },
] as const

const NOT_BUILT = [
  'Semantic or embedding-based search (currently keyword)',
  'Accreditation certificates (only completion certificates)',
  'Free-form block editor for lesson content',
  'AI chatbot or assistant as a product centre',
  'Team dashboards or enterprise procurement',
  'Complex subscription billing',
  'Social features or user profiles',
  'Large-scale recommendation systems',
]
