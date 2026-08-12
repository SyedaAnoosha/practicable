import { Activity, ClipboardCheck, Radar, ShieldAlert, Sparkles, type LucideIcon } from 'lucide-react'

/**
 * One signature colour and icon per domain (theme.css's `--domain-*` tokens), shared
 * across Home, QuestionsCatalogue and Question so the five domains read the same
 * everywhere. Deliberately not extended to the seven question-tag dimensions.
 *
 * Keyed by the domain's full `name` as returned by the API (`Risk (Enterprise & op.)`,
 * not just `Risk`) — that's the value every question carries.
 */
export const DOMAIN_VISUALS: Record<string, { color: string; icon: LucideIcon }> = {
  'Risk (Enterprise & op.)': { color: '--domain-risk', icon: ShieldAlert },
  // Radar, not Lock: Lock is this app's fixed symbol for gated content, so using it
  // here made a Cyber breadcrumb read as "this page is locked".
  'Cyber (Tech & security)': { color: '--domain-cyber', icon: Radar },
  'Compliance (Regulatory)': { color: '--domain-compliance', icon: ClipboardCheck },
  'Resilience (Continuity)': { color: '--domain-resilience', icon: Activity },
  'AI (Governance)': { color: '--domain-ai', icon: Sparkles },
}

const FALLBACK_VISUAL = { color: '--primary', icon: Sparkles }

/** A domain not in the map yet falls back to the brand primary rather than throwing —
 * the page still works, just without colour differentiation until this catches up. */
export function domainVisual(domainName: string) {
  return DOMAIN_VISUALS[domainName] ?? FALLBACK_VISUAL
}

/** CSS `var(--domain-x)` string for inline styles — Tailwind's JIT can't see a
 * runtime-interpolated class name, so data-driven domain colours go through this. */
export function domainColorVar(domainName: string): string {
  return `var(${domainVisual(domainName).color})`
}
