import { describe, expect, it } from 'vitest'
import { TAG_VARIANT, cardTags } from './tags'

interface Tag {
  dimension: string
  value: string
}

const tag = (dimension: string, value = 'x'): Tag => ({ dimension, value })

describe('cardTags', () => {
  it('excludes leadership_traits — detail page only', () => {
    const tags = [tag('leadership_traits'), tag('duration'), tag('cost')]
    const result = cardTags(tags)
    expect(result.some((t) => t.dimension === 'leadership_traits')).toBe(false)
  })

  it('orders by CARD_TAG_PRIORITY, not input order', () => {
    // Deliberately out of priority order in the input — roi_horizon before duration —
    // to prove the function sorts rather than passing input order through.
    const tags = [tag('effort'), tag('roi_horizon'), tag('duration'), tag('cost')]
    const result = cardTags(tags, 4)
    expect(result.map((t) => t.dimension)).toEqual(['duration', 'cost', 'roi_horizon', 'effort'])
  })

  it('caps at the requested count, three by default', () => {
    const tags = ['duration', 'cost', 'regulator_pressure', 'roi_horizon', 'effort'].map((d) => tag(d))
    expect(cardTags(tags)).toHaveLength(3)
  })

  it('places an unranked dimension after every ranked one', () => {
    const tags = [tag('unknown_dimension'), tag('cost'), tag('duration')]
    const result = cardTags(tags, 3)
    expect(result[result.length - 1].dimension).toBe('unknown_dimension')
  })

  it('does not mutate the array it was given', () => {
    const tags = [tag('roi_horizon'), tag('duration')]
    const original = [...tags]
    cardTags(tags)
    expect(tags).toEqual(original)
  })
})

describe('TAG_VARIANT', () => {
  it('gives regulator_pressure the accent variant — the one dimension that creates urgency', () => {
    expect(TAG_VARIANT.regulator_pressure).toBe('accent')
  })

  it('has no entry for leadership_traits — it never reaches a card to be styled', () => {
    expect(TAG_VARIANT.leadership_traits).toBeUndefined()
  })
})
