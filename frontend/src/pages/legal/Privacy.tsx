import { LegalLayout, LegalSection } from '@/components/legal/LegalLayout'
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/support'

// week2_plan.md W2-R7 / RS 11.2. Sub-processors listed below are the ones actually
// integrated in this codebase as of 2026-08-14 — Cloudflare R2 (named in RS 11.2 and
// the plan's own §20.7 table) was superseded by Supabase Storage during Week 1 (see
// week1_plan.md's "R2 → Supabase Storage" decision) and is deliberately not listed,
// since naming a processor that isn't actually used would be inaccurate the day this
// ships (this section's own governing rule, stated in week2_plan.md W2-R7).
export function Privacy() {
  return (
    <LegalLayout title="Privacy policy" description="What we collect, why, and how you can see or remove it.">
      <LegalSection heading="What we collect">
        <p>
          Name and email address (when you sign up, buy something, or ask us something), purchase history, lesson
          and course progress, and — if you use a lead-capture form — the email address you give us there. We do not
          collect phone numbers, physical addresses, or payment card details; card details are entered directly into
          Stripe's checkout and never reach our servers.
        </p>
      </LegalSection>

      <LegalSection heading="Why we collect it">
        <p>
          To create and run your account, deliver the content you've bought, process payments, send transactional
          email (receipts, sale confirmations), and respond to enquiries.
        </p>
      </LegalSection>

      <LegalSection heading="Who else sees it — every sub-processor in use">
        <p>We use the following third-party services to run the platform. Each only sees what it needs to do its job:</p>
        <ul className="ml-5 list-disc space-y-2">
          <li><strong className="font-sans font-semibold text-foreground">Supabase</strong> — our database, sign-in, and file storage.</li>
          <li><strong className="font-sans font-semibold text-foreground">Stripe</strong> — payment processing. We never see or store your card details.</li>
          <li><strong className="font-sans font-semibold text-foreground">Mux</strong> — video hosting and playback for course lessons.</li>
          <li><strong className="font-sans font-semibold text-foreground">Resend</strong> — sends receipt and notification emails on our behalf.</li>
          <li><strong className="font-sans font-semibold text-foreground">Vercel</strong> — hosts the website you're reading this on.</li>
          <li><strong className="font-sans font-semibold text-foreground">Render</strong> — hosts the backend service the website talks to.</li>
        </ul>
        <p>We do not sell your data to anyone, for any reason.</p>
      </LegalSection>

      <LegalSection heading="Analytics">
        <p>
          We do not use any third-party analytics or tracking service. What we know about how the platform is used
          comes from aggregate counts in our own database — the number of times a filter was applied or a download
          link was issued, for example — never anything that identifies you individually.
        </p>
      </LegalSection>

      {/* `[ADDED 2026-08-22]` The cookie notice links here for detail, and there was no
          section to link to. Written from the actual storage keys in the codebase
          (grep `practicable:` under frontend/src) rather than from a template, so it
          can be re-verified the same way when it drifts. */}
      <LegalSection heading="Cookies and browser storage">
        <p>
          We use no advertising, analytics, or third-party tracking cookies. What we store is
          limited to what the site needs to work, and it stays in your own browser:
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li><strong className="font-sans font-semibold text-foreground">Signing you in</strong> — Supabase sets a session cookie so you stay signed in between pages. Signing out clears it.</li>
          <li><strong className="font-sans font-semibold text-foreground">Your cart</strong> — items you have added are kept in your browser so they survive a reload.</li>
          <li><strong className="font-sans font-semibold text-foreground">Your preferences</strong> — light or dark theme, whether the sidebar is collapsed, whether you have dismissed a notice, and a promotional code if you copied one.</li>
          <li><strong className="font-sans font-semibold text-foreground">Payment</strong> — Stripe sets its own cookies on its checkout pages, which we do not control. See Stripe's privacy policy for those.</li>
        </ul>
        <p>
          Everything in the first three groups is strictly necessary or a preference you set
          yourself, so there is nothing to opt out of — but clearing your browser's site data
          for this domain removes all of it.
        </p>
      </LegalSection>

      <LegalSection heading="How long we keep it">
        <ul className="ml-5 list-disc space-y-2">
          <li>Account details — while your account is active, plus 12 months after your last activity.</li>
          <li>Purchase and order records — 7 years, in line with standard Australian tax record-keeping practice.</li>
          <li>Lesson and course progress — while your account is active, plus 90 days.</li>
          <li>Download and access logs — 12 months.</li>
          <li>Backups — rolling, kept for disaster recovery only, not as a second copy of the above.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          You can ask us to show you what we hold about you, correct it, or delete it, by emailing{' '}
          <a href={SUPPORT_MAILTO} className="text-accent underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>
          . We'll respond within a reasonable time and confirm once it's done. Deleting your account does not
          retroactively delete records we're required to keep for tax purposes (see "How long we keep it" above).
        </p>
      </LegalSection>

      <LegalSection heading="Australian Privacy Act">
        <p>
          We handle personal information in line with the Australian Privacy Act 1988 and the Australian Privacy
          Principles. If you're contacting us from outside Australia — including the EU — we aim to honour equivalent
          rights (access, correction, deletion, and an explanation of what we hold and why) on request, in the spirit
          of GDPR readiness, even though our primary obligations are under Australian law.
        </p>
      </LegalSection>

      <LegalSection heading="Questions">
        <p>
          Reach us at{' '}
          <a href={SUPPORT_MAILTO} className="text-accent underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
