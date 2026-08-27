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

/** The first word of each canonical key, in map order — the token every near-miss
 *  vocabulary still agrees on. Built from `DOMAIN_VISUALS` rather than written out, so
 *  adding a sixth domain cannot leave this behind. */
const KEYWORD_INDEX: Array<[string, { color: string; icon: LucideIcon }]> = Object.entries(
  DOMAIN_VISUALS,
).map(([name, visual]) => [name.split(' ')[0].toLowerCase(), visual])

/**
 * A domain not in the map falls back to the brand primary rather than throwing — the
 * page still works, just without colour differentiation.
 *
 * Courses would otherwise hit that fallback every time: there is a second taxonomy —
 * questions and packs carry `domain.name` (`Risk (Enterprise & op.)`, a key here),
 * while a course carries `section.name` from the separate `sections` table (e.g.
 * `Risk Management`). No key matches, so every course resolves to `--primary` and the
 * "duotone" ramps navy into navy.
 *
 * The match is widened rather than the vocabularies merged (merging is a backend
 * decision about what a section *is*). Widening is exact match first, then the leading
 * keyword, so `Risk Management` → risk and `Cyber Security` → cyber, while an unrelated
 * section still lands on the fallback.
 */
export function domainVisual(domainName: string) {
  const exact = DOMAIN_VISUALS[domainName]
  if (exact) return exact

  const first = domainName.trim().split(/[\s(]+/)[0]?.toLowerCase()
  if (!first) return FALLBACK_VISUAL

  const keyword = KEYWORD_INDEX.find(([token]) => token === first)
  return keyword ? keyword[1] : FALLBACK_VISUAL
}

/** CSS `var(--domain-x)` string for inline styles — Tailwind's JIT can't see a
 * runtime-interpolated class name, so data-driven domain colours go through this. */
export function domainColorVar(domainName: string): string {
  return `var(${domainVisual(domainName).color})`
}
