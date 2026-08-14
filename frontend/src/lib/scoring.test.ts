// Reads backend/tests/fixtures/scoring_cases.json — the same file
// backend/tests/test_question_service.py reads — and asserts scoring.ts agrees with
// every case (Non-negotiable #10, week2_plan.md Phase 3 step 2).
//
// §57.6's explicit list is covered here: the v1 "one exact + one far" bug, one
// exact + one adjacent, zero active filters, an unknown tag value, and multi-select
// partial overlap — plus several more real-shape cases, and native (non-fixture)
// tests for partitionQuestions/rankRelaxationCandidates, which are about a LIST of
// questions rather than one question's score in isolation.
import { describe, expect, it } from 'vitest'
// Vite/Vitest resolves and inlines a JSON import at transform time (no Node `fs`
// needed, so no `@types/node` dependency for this file) — the path just has to
// resolve on disk, which it does even outside `src/`, since this isn't going
// through the dev-server's HTTP `fs.allow` boundary.
import fixtureData from '../../../backend/tests/fixtures/scoring_cases.json'
import {
  type QuestionFilters,
  type ScorableQuestion,
  type TagRef,
  buildTagLookup,
  emptyFilters,
  partitionQuestions,
  rankRelaxationCandidates,
  scoreQuestion,
} from './scoring'

interface FixtureTagValue {
  dimension: string
  value: string
  display_label: string
  sort_order: number
}

interface FixtureCase {
  name: string
  filters: Record<string, string | string[]>
  question: { domain: string; tags?: Record<string, string>; leadership_traits?: string[] }
  expected: {
    score: number
    active_constraints: number
    exact_count: number
    is_exact: boolean
    misses: { dimension: string; distance: 1 | null }[]
  }
}

interface Fixture {
  tag_values: FixtureTagValue[]
  cases: FixtureCase[]
}

const fixture = fixtureData as unknown as Fixture
const tagLookup = buildTagLookup(fixture.tag_values as TagRef[])

function tagRef(dimension: string, value: string): TagRef {
  return (
    fixture.tag_values.find((t) => t.dimension === dimension && t.value === value) ?? {
      dimension,
      value,
      display_label: value,
      sort_order: -999,
    }
  )
}

function buildQuestion(caseQuestion: FixtureCase['question']): ScorableQuestion {
  const tags: TagRef[] = Object.entries(caseQuestion.tags ?? {}).map(([dim, value]) => tagRef(dim, value))
  for (const trait of caseQuestion.leadership_traits ?? []) {
    tags.push(tagRef('leadership_traits', trait))
  }
  return { id: 'q1', domain_slug: caseQuestion.domain, tags }
}

function buildFilters(caseFilters: FixtureCase['filters']): QuestionFilters {
  const f = emptyFilters()
  for (const [key, value] of Object.entries(caseFilters)) {
    if (key === 'tier' || key === 'leadership_traits') {
      f[key] = value as string[]
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(f as any)[key] = value
    }
  }
  return f
}

describe('scoring.ts parity with scoring_cases.json', () => {
  for (const c of fixture.cases) {
    it(c.name, () => {
      const question = buildQuestion(c.question)
      const filters = buildFilters(c.filters)
      const result = scoreQuestion(question, filters, tagLookup)

      expect(result.score).toBe(c.expected.score)
      expect(result.activeConstraints).toBe(c.expected.active_constraints)
      expect(result.exactCount).toBe(c.expected.exact_count)
      expect(result.isExact).toBe(c.expected.is_exact)
      expect(result.misses.map((m) => ({ dimension: m.dimension, distance: m.distance }))).toEqual(
        c.expected.misses,
      )
    })
  }
})

// ── Partition-level behaviour — native, not fixture-driven (see the Python mirror's
// equivalent tests for why: this is about the LIST of questions and their ordering).

function q(id: string, domain: string, tags: Record<string, string> = {}): ScorableQuestion {
  return { id, domain_slug: domain, tags: Object.entries(tags).map(([dim, value]) => tagRef(dim, value)) }
}

describe('partitionQuestions', () => {
  it('with no filters, returns everything as exact in original order', () => {
    const questions = [q('a', 'risk'), q('b', 'risk'), q('c', 'risk')]
    const { exact, close, hasFilters } = partitionQuestions(questions, emptyFilters(), tagLookup)
    expect(hasFilters).toBe(false)
    expect(close).toEqual([])
    expect(exact.map((s) => s.question.id)).toEqual(['a', 'b', 'c'])
    expect(exact.every((s) => s.isExact)).toBe(true)
  })

  it('splits exact and close, and drops zero-score questions entirely', () => {
    const questions = [
      q('exact', 'risk', { effort: 'quick' }),
      q('close', 'risk', { effort: 'moderate' }),
      q('far', 'risk', { effort: 'transformation' }),
    ]
    const filters = { ...emptyFilters(), effort: 'quick' }
    const { exact, close, hasFilters } = partitionQuestions(questions, filters, tagLookup)
    expect(hasFilters).toBe(true)
    expect(exact.map((s) => s.question.id)).toEqual(['exact'])
    expect(close.map((s) => s.question.id)).toEqual(['close'])
  })

  it('sorts by score descending and preserves input order on ties (stable sort)', () => {
    const questions = [q('second', 'risk', { effort: 'moderate' }), q('first', 'risk', { effort: 'moderate' })]
    const filters = { ...emptyFilters(), effort: 'quick' }
    const { close } = partitionQuestions(questions, filters, tagLookup)
    expect(close.map((s) => s.question.id)).toEqual(['second', 'first'])
  })
})

describe('rankRelaxationCandidates', () => {
  it('orders the most restrictive active filter first', () => {
    const questions = [
      q('a', 'risk', { duration: 'under_2_weeks', cost: 'low' }),
      q('b', 'risk', { duration: 'over_6_months', cost: 'low' }),
      q('c', 'risk', { duration: 'over_6_months', cost: 'high' }),
    ]
    const filters = { ...emptyFilters(), duration: 'under_2_weeks', cost: 'low' }
    const ranked = rankRelaxationCandidates(questions, filters)
    expect(ranked[0]).toBe('duration')
  })
})
