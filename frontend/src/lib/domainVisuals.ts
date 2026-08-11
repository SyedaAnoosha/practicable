import { Activity, ClipboardCheck, Radar, ShieldAlert, Sparkles, type LucideIcon } from 'lucide-react'

/**
 * One signature colour + icon per domain (theme.css's `--domain-*` tokens,
 * 2026-08-11 liveliness pass). Shared across Home.tsx, QuestionsCatalogue.tsx
 * and Question.tsx so the five domains read as the same five domains everywhere,
 * per DESIGN.md §50.3's "one lookup file" rule — a domain's colour/icon living in
 * three places would drift the first time a domain name changes.
 *
 * Deliberately not extended to the seven question-tag dimensions (DESIGN.md
 * §7.6/§37): five domains named prominently is a different problem from seven
 * badges on every result row.
 *
 * Keyed by the domain's full `name` as returned by the API (`Risk (Enterprise &
 * op.)`, not just `Risk`) — that's the value every question actually carries.
 */
export const DOMAIN_VISUALS: Record<string, { color: string; icon: LucideIcon }> = {
  'Risk (Enterprise & op.)': { color: '--domain-risk', icon: ShieldAlert },
  // Radar, not Lock — Lock is already this app's fixed symbol for "gated/locked
  // content" (buy-to-unlock cards, locked lessons, §40.4). Reusing it as the
  // Cyber domain's icon made a Cyber question's breadcrumb read as "this page
  // is locked" rather than "this is the Cyber domain" (caught live, 2026-08-11).
  'Cyber (Tech & security)': { color: '--domain-cyber', icon: Radar },
  'Compliance (Regulatory)': { color: '--domain-compliance', icon: ClipboardCheck },
  'Resilience (Continuity)': { color: '--domain-resilience', icon: Activity },
  'AI (Governance)': { color: '--domain-ai', icon: Sparkles },
}

const FALLBACK_VISUAL = { color: '--primary', icon: Sparkles }

/** A domain name that isn't in the map yet (a sixth domain added in admin before
 * this file is updated) falls back to the brand primary rather than throwing —
 * consistent with §3.5's "a new domain is configuration, not a rebuild": the
 * page still works, it just isn't colour-differentiated until this map catches up. */
export function domainVisual(domainName: string) {
  return DOMAIN_VISUALS[domainName] ?? FALLBACK_VISUAL
}

/** CSS `var(--domain-x)` string for inline styles — Tailwind's JIT can't see a
 * runtime-interpolated class name (`bg-${x}`), so anywhere a domain colour is
 * chosen from data at render time, it goes through an inline style using this. */
export function domainColorVar(domainName: string): string {
  return `var(${domainVisual(domainName).color})`
}
