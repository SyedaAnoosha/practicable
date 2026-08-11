// DESIGN.md §20.2 — the one semantic mapping for how tag dimensions are treated on
// cards. Single source of truth so the featured-question card on Home and Dashboard
// can't drift apart: regulator pressure is the only dimension that gets accent
// emphasis (it is the one that creates urgency); leadership traits stay on the
// detail page. A dimension absent from this map falls back to Badge's default
// (muted) automatically.
export const TAG_VARIANT: Record<string, 'muted' | 'secondary' | 'accent' | 'outline'> = {
  duration: 'secondary',
  cost: 'secondary',
  effort: 'muted',
  roi_horizon: 'outline',
  tier: 'muted',
  regulator_pressure: 'accent',
}

// §20.2: three tags on a card, never seven. The most decision-relevant dimensions
// first (duration, cost, regulator pressure, then the next best signal), leadership
// traits excluded (detail page only). Generic over the tag shape so both pages share
// it; `.filter()` copies before `.sort()` mutates, so the query cache is untouched.
const CARD_TAG_PRIORITY: string[] = ['duration', 'cost', 'regulator_pressure', 'roi_horizon', 'effort', 'tier']

export function cardTags<T extends { dimension: string }>(tags: T[], count = 3): T[] {
  const rank = (dimension: string) => {
    const i = CARD_TAG_PRIORITY.indexOf(dimension)
    return i === -1 ? CARD_TAG_PRIORITY.length : i
  }
  return tags
    .filter((tag) => tag.dimension !== 'leadership_traits')
    .sort((a, b) => rank(a.dimension) - rank(b.dimension))
    .slice(0, count)
}
