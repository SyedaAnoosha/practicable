import { LegalLayout, LegalSection } from '@/components/legal/LegalLayout'
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/support'

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
          them.{' '}
          <span className="font-sans text-sm text-muted-foreground">
            [OWNER: confirm the exact window and conditions below before this leaves draft status — RS 11.3 records
            this as a commercial call, not an engineering one.]
          </span>
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>Templates: a refund is available within 14 days of purchase, provided the file hasn't been downloaded.</li>
          <li>Courses: a refund is available within 14 days of purchase, provided you haven't started a lesson. Once progress is recorded against a course, that purchase is final under this change-of-mind policy — the guarantees above still apply if something is actually wrong with it.</li>
        </ul>
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
