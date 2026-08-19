// Discovery scoring.
//
// A strict AND across filters can return nothing, so filtering is a RANKING, not a
// gate: each active constraint contributes graded credit — 2 points for an exact
// match, 1 for the adjacent value on that dimension's ordinal scale, 0 beyond that —
// and a question is "exact" only when every active constraint scored the full 2 points.
//
// Reads `sort_order` off the tag data already present in the API response, rather
// than hard-coding each dimension's scale as a literal, so the scale lives in the
// database. `backend/app/services/question_service.py` is the Python mirror of this
// file; a shared fixture (`tests/fixtures/scoring_cases.json`) keeps the two from
// silently diverging.

export const EXACT_POINTS = 2
export const CLOSE_POINTS = 1

// Single-valued, ordinally scaled dimensions — a question has at most one tag on
// each, and "adjacent" is meaningful because the scale has an order.
export const ORDINAL_DIMENSIONS = ['effort', 'duration', 'cost', 'roi_horizon', 'regulator_pressure'] as const
export type OrdinalDimension = (typeof ORDINAL_DIMENSIONS)[number]

// Multi-valued, categorical (overlap, not distance) dimensions. `tier` is single-
// valued per question but the filter can name several acceptable values (a checkbox
// group), so it's scored the same way as `leadership_traits`.
export const MULTI_DIMENSIONS = ['tier', 'leadership_traits'] as const
export type MultiDimension = (typeof MULTI_DIMENSIONS)[number]

export interface TagRef {
  dimension: string
  value: string
  display_label: string
  sort_order: number
}

/** The scoring-relevant shape of a question — a subset of QuestionSummary that
 * scoring itself needs, so this module doesn't import the page's full API types. */
export interface ScorableQuestion {
  id: string
  domain_slug: string
  tags: TagRef[]
}

export interface QuestionFilters {
  domain?: string
  effort?: string
  duration?: string
  cost?: string
  roi_horizon?: string
  regulator_pressure?: string
  tier: string[]
  leadership_traits: string[]
}

export function emptyFilters(): QuestionFilters {
  return { tier: [], leadership_traits: [] }
}

export function countActiveFilters(filters: QuestionFilters): number {
  let count = filters.domain ? 1 : 0
  for (const dim of ORDINAL_DIMENSIONS) if (filters[dim]) count++
  if (filters.tier.length > 0) count++
  if (filters.leadership_traits.length > 0) count++
  return count
}

export interface Miss {
  dimension: string
  requested: string | string[]
  actual: string | string[] | null
  // 1 = adjacent, null = far or unknown — both score 0; the badge doesn't need to
  // tell them apart, only exact-vs-not does.
  distance: 1 | null
}

export interface ScoredQuestion<Q extends ScorableQuestion = ScorableQuestion> {
  question: Q
  score: number
  activeConstraints: number
  exactCount: number
  isExact: boolean
  misses: Miss[]
}

function findTag(tags: TagRef[], dimension: string): TagRef | undefined {
  return tags.find((t) => t.dimension === dimension)
}

function ordinalDistance(requestedTag: TagRef | undefined, actualTag: TagRef | undefined): 0 | 1 | null {
  if (!requestedTag || !actualTag) return null
  const d = Math.abs(requestedTag.sort_order - actualTag.sort_order)
  return d === 0 ? 0 : d === 1 ? 1 : null
}

/** `tagLookup` resolves a filter's requested (dimension, value) pair to its TagRef
 * — build it once from the full set of known tag values, not per call. */
export function scoreQuestion<Q extends ScorableQuestion>(
  question: Q,
  filters: QuestionFilters,
  tagLookup: Map<string, TagRef>,
): ScoredQuestion<Q> {
  let score = 0
  let activeConstraints = 0
  let exactCount = 0
  const misses: Miss[] = []

  for (const dim of ORDINAL_DIMENSIONS) {
    const requestedValue = filters[dim]
    if (!requestedValue) continue
    activeConstraints++
    const requestedTag = tagLookup.get(`${dim}:${requestedValue}`)
    const actualTag = findTag(question.tags, dim)
    const distance = ordinalDistance(requestedTag, actualTag)
    if (distance === 0) {
      exactCount++
      score += EXACT_POINTS
    } else if (distance === 1) {
      score += CLOSE_POINTS
      misses.push({ dimension: dim, requested: requestedValue, actual: actualTag?.value ?? null, distance: 1 })
    } else {
      misses.push({ dimension: dim, requested: requestedValue, actual: actualTag?.value ?? null, distance: null })
    }
  }

  if (filters.domain) {
    activeConstraints++
    if (question.domain_slug === filters.domain) {
      exactCount++
      score += EXACT_POINTS
    } else {
      misses.push({ dimension: 'domain', requested: filters.domain, actual: question.domain_slug, distance: null })
    }
  }

  for (const dim of MULTI_DIMENSIONS) {
    const requested = filters[dim]
    if (requested.length === 0) continue
    activeConstraints++
    const actual =
      dim === 'tier'
        ? (() => {
            const tierTag = findTag(question.tags, 'tier')
            return tierTag ? [tierTag.value] : []
          })()
        : question.tags.filter((t) => t.dimension === 'leadership_traits').map((t) => t.value)
    const overlap = requested.filter((v) => actual.includes(v))
    if (overlap.length === requested.length) {
      exactCount++
      score += EXACT_POINTS
    } else if (overlap.length > 0) {
      score += CLOSE_POINTS
      misses.push({ dimension: dim, requested, actual, distance: 1 })
    } else {
      misses.push({ dimension: dim, requested, actual, distance: null })
    }
  }

  return {
    question,
    score,
    activeConstraints,
    exactCount,
    // Exact means every active constraint was satisfied exactly, not merely that
    // nothing landed in the adjacent bucket.
    isExact: activeConstraints > 0 && exactCount === activeConstraints,
    misses,
  }
}

export interface PartitionResult<Q extends ScorableQuestion> {
  exact: ScoredQuestion<Q>[]
  close: ScoredQuestion<Q>[]
  hasFilters: boolean
}

/** `questions` should already be in the caller's desired tie-break order (title,
 * typically) — the sort below is stable, so equal-score rows keep that order. */
export function partitionQuestions<Q extends ScorableQuestion>(
  questions: Q[],
  filters: QuestionFilters,
  tagLookup: Map<string, TagRef>,
): PartitionResult<Q> {
  const hasFilters = countActiveFilters(filters) > 0

  if (!hasFilters) {
    return {
      exact: questions.map((q) => ({
        question: q,
        score: 0,
        activeConstraints: 0,
        exactCount: 0,
        isExact: true,
        misses: [],
      })),
      close: [],
      hasFilters: false,
    }
  }

  const scored = questions.map((q) => scoreQuestion(q, filters, tagLookup))
  const byScore = (a: ScoredQuestion<Q>, b: ScoredQuestion<Q>) => b.score - a.score
  return {
    exact: scored.filter((s) => s.isExact).sort(byScore),
    // A question scoring zero shares nothing with the query and is not shown at all.
    close: scored.filter((s) => !s.isExact && s.score > 0).sort(byScore),
    hasFilters: true,
  }
}

/** Builds the `"dimension:value" -> TagRef` map every scoring call needs, from the
 * full set of tag values known to the app (typically derived once from the cached
 * question index — every value in use appears on at least one question). */
export function buildTagLookup(tags: TagRef[]): Map<string, TagRef> {
  const map = new Map<string, TagRef>()
  for (const t of tags) map.set(`${t.dimension}:${t.value}`, t)
  return map
}

/** Zero-result recovery: rank the active filter dimensions by how few questions each
 * admits on its own, most restrictive first. Computed, not hard-coded, so it reflects
 * how the taxonomy actually behaves rather than a guess that goes stale. */
export function rankRelaxationCandidates<Q extends ScorableQuestion>(questions: Q[], filters: QuestionFilters): string[] {
  const activeDims: string[] = []
  if (filters.domain) activeDims.push('domain')
  for (const dim of ORDINAL_DIMENSIONS) if (filters[dim]) activeDims.push(dim)
  if (filters.tier.length > 0) activeDims.push('tier')
  if (filters.leadership_traits.length > 0) activeDims.push('leadership_traits')

  const admits = (dim: string): number => {
    if (dim === 'domain') return questions.filter((q) => q.domain_slug === filters.domain).length
    if (dim === 'tier') {
      return questions.filter((q) => {
        const t = findTag(q.tags, 'tier')
        return t && filters.tier.includes(t.value)
      }).length
    }
    if (dim === 'leadership_traits') {
      const wanted = new Set(filters.leadership_traits)
      return questions.filter((q) =>
        q.tags.some((t) => t.dimension === 'leadership_traits' && wanted.has(t.value)),
      ).length
    }
    const requestedValue = filters[dim as OrdinalDimension]
    return questions.filter((q) => findTag(q.tags, dim)?.value === requestedValue).length
  }

  return [...activeDims].sort((a, b) => admits(a) - admits(b))
}
