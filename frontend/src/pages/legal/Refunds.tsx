import { LegalLayout, LegalSection } from '@/components/legal/LegalLayout'
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/support'
import { REFUND_POSITION_TEXT } from '@/lib/labels'

// week2_plan.md W2-R7 / RS 11.3 — the ACCC's published position (tested in
// ACCC v Valve) is that "no refunds", "all sales final" or "store credit only" are
// THEMSELVES misleading conduct under the ACL, regardless of the product being
// digital. This page states the statutory guarantees as applying independently of
// anything below, per RS 11.3's explicit instruction — a clause purporting to
// exclude them is void and risks being read as further misleading conduct.
export function Refunds() {
  return (
    <LegalLayout
      title="Refund policy"
      description="Your consumer guarantees, and our policy on top of them — in plain language."
    >
      <LegalSection heading="Your consumer guarantees come first">
        {/* week3_plan.md Phase 4 step 1 — the same sentence as /store's footer and the
            receipt email, defined once in lib/labels.ts (and its byte-identical Python
            twin in backend/app/core/labels.py, since Jinja2 can't import a TS module). */}
        <p className="font-medium text-foreground">{REFUND_POSITION_TEXT}</p>
        <p>
          Nothing on this page limits or excludes the consumer guarantees you're entitled to under the Australian
          Consumer Law — they apply to digital products the same as physical ones, and they apply regardless of
          anything stated below. If a course or template is not as described, doesn't work, or is genuinely
          inaccessible due to a fault on our end, that's a major failure and you're entitled to choose a refund, not
          a favour we're extending you.
        </p>
      </LegalSection>

      <LegalSection heading="If something is genuinely wrong">
        <p>
          If content is materially different from how it was described, or technical access fails and we can't fix
          it within a reasonable time, tell us and we'll refund the purchase. This isn't a goodwill gesture — it's
          the outcome the law already entitles you to for a major failure, and we won't ask you to accept a credit or
          a partial fix instead if a refund is what you're owed.
        </p>
      </LegalSection>

      <LegalSection heading="If you've simply changed your mind">
        <p>
          This is company policy, on top of the guarantees above — not a substitute for them, and not a limit on
          them.
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>Courses: you can request a self-serve refund from your <a href="/purchases" className="text-accent underline underline-offset-2">purchases page</a> up to 15% course completion. We keep 15% of the purchase price and refund the rest to your original payment method.</li>
          <li>Courses past 15% completion: contact us and we'll assess your situation. Your consumer-guarantee rights always apply regardless.</li>
          <li>Templates and reference packs: contact us for a refund assessment.</li>
        </ul>
        <p className="mt-3">
          No templates are automatically refunded through the self-serve path. If something is materially wrong with a template, contact us — your consumer-guarantee rights still apply.
        </p>
      </LegalSection>

      <LegalSection heading="How to ask for one">
        <p>
          Email{' '}
          <a href={SUPPORT_MAILTO} className="text-accent underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>{' '}
          with your order details and what happened. We'll confirm receipt and let you know the outcome — for a
          major failure, that's a refund; for a change of mind within the window above, we'll process it the same
          way.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
