import { LegalLayout, LegalSection } from '@/components/legal/LegalLayout'
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/support'

// week2_plan.md W2-R7 / RS 11.1. Draft, footer-linked, marked per §20.7 — a starting
// point for a lawyer, not a substitute for one (stated here and repeated in the
// handover pack per the plan's own instruction).
export function Terms() {
  return (
    <LegalLayout
      title="Terms of service"
      description="What you're buying when you buy something here, and the rules that come with it."
    >
      <LegalSection heading="The contracting entity">
        <p>
          Practicable is operated by Effective Risk Management. Effective Risk Management is the entity you contract
          with when you make a purchase, the name on your receipt, and the party these terms are between.{' '}
          <span className="font-sans text-sm text-muted-foreground">
            [OWNER: confirm the exact legal structure — sole trader / company — and ABN/ACN before this page leaves
            draft status.]
          </span>
        </p>
      </LegalSection>

      <LegalSection heading="What you're buying">
        <p>
          A purchase gives you a personal, non-exclusive licence to access and use the specific course, template or
          reference material you bought — not ownership of it, and not a transfer of the underlying intellectual
          property. The guidance, questions, templates and course content remain the intellectual property of
          Effective Risk Management and its author.
        </p>
        <p>
          Every purchase is one-time, for lifetime access — there is no subscription and no recurring charge for
          content you've already bought, including future updates made to that same course or template.
        </p>
      </LegalSection>

      <LegalSection heading="What you can and can't do with it">
        <p>You may use anything you've purchased for your own work and for the ordinary business of your organisation — reading it, applying it, adapting a template for your own internal use.</p>
        <p>You may not redistribute, resell, publish, or share course material or templates outside your own organisation, share your account credentials, or use automated tools to scrape or bulk-download content. Doing so may result in your account being suspended or terminated without a refund of past purchases.</p>
      </LegalSection>

      <LegalSection heading="Account termination">
        <p>
          You can stop using your account at any time. We may suspend or terminate an account that breaches these
          terms — in particular the redistribution and credential-sharing rules above — after reasonable notice
          where practical, or immediately where the breach is serious (for example, bulk redistribution of paid
          content).
        </p>
      </LegalSection>

      <LegalSection heading="Limitation of liability">
        <p>
          The content on this platform is general guidance for risk practitioners, not advice tailored to your
          specific organisation, and using it does not create a professional advisory relationship. To the maximum
          extent permitted by law, Effective Risk Management is not liable for indirect, incidental or consequential
          loss arising from your use of the platform or its content. Nothing in this section limits any consumer
          guarantee that applies to you under the Australian Consumer Law and cannot lawfully be excluded — see the{' '}
          <a href="/legal/refunds" className="text-accent underline underline-offset-2">
            refund policy
          </a>{' '}
          for how that applies here.
        </p>
      </LegalSection>

      <LegalSection heading="Governing law">
        <p>These terms are governed by the laws of Australia, and any dispute is subject to the jurisdiction of the Australian courts.</p>
      </LegalSection>

      <LegalSection heading="Changes to these terms">
        <p>We may update these terms as the platform changes. Material changes will be reflected here with an updated date; continuing to use the platform after a change means you accept the updated terms.</p>
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
