import { describe, expect, it, vi } from 'vitest'
import type { GuideContent } from '../shared/guideContent'
import { guides } from '../src/guideData'
import { buildVisiblePages, orderGuidePages } from '../src/guideEngine'

function page(id: string, overrides: Partial<GuideContent> = {}): GuideContent {
  return {
    id,
    guides: ['Åpne'],
    type: 'step',
    afterId: null,
    requiredStepIds: [],
    answerRequirements: [],
    title: id,
    location: null,
    warning: null,
    instructions: [],
    checkpoints: null,
    answerOptions: [],
    canSkip: true,
    imageGroup: null,
    ...overrides,
  }
}

const openGuide = guides['open-cabin']

describe('Sheet-driven guide flow', () => {
  it('uses Sheet row order and reacts naturally to inserted or moved rows', () => {
    expect(orderGuidePages(openGuide, [page('a'), page('new'), page('b')]).map(({ id }) => id))
      .toEqual(['a', 'new', 'b'])
    expect(orderGuidePages(openGuide, [page('b'), page('a')]).map(({ id }) => id))
      .toEqual(['b', 'a'])
  })

  it('places Etter children immediately after their page in Sheet sibling order', () => {
    const content = [
      page('a'),
      page('b'),
      page('c', { afterId: 'a' }),
      page('d', { afterId: 'a' }),
      page('e', { afterId: 'c' }),
    ]

    expect(orderGuidePages(openGuide, content).map(({ id }) => id))
      .toEqual(['a', 'c', 'e', 'd', 'b'])
  })

  it('falls back to Sheet order for missing and circular Etter references', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const missing = [page('a'), page('b', { afterId: 'missing' }), page('c')]
    const circular = [page('a', { afterId: 'b' }), page('b', { afterId: 'a' }), page('c')]

    expect(orderGuidePages(openGuide, missing).map(({ id }) => id)).toEqual(['a', 'b', 'c'])
    expect(orderGuidePages(openGuide, circular).map(({ id }) => id)).toEqual(['a', 'b', 'c'])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('filters answer requirements generically and skips hidden intermediate rows', () => {
    const content = [
      page('a'),
      page('aarstid', { type: 'question', answerOptions: ['Vinter', 'Sommer'] }),
      page('winter', { answerRequirements: [{ questionId: 'aarstid', answer: 'Vinter' }] }),
      page('summer', { answerRequirements: [{ questionId: 'aarstid', answer: 'Sommer' }] }),
      page('d'),
    ]

    expect(buildVisiblePages(openGuide, content, { aarstid: 'Vinter' }, {}).map(({ id }) => id))
      .toEqual(['a', 'aarstid', 'winter', 'd'])
    expect(buildVisiblePages(openGuide, content, { aarstid: 'Sommer' }, {}).map(({ id }) => id))
      .toEqual(['a', 'aarstid', 'summer', 'd'])
    expect(buildVisiblePages(openGuide, content, {}, {}).map(({ id }) => id))
      .toEqual(['a', 'aarstid', 'd'])
  })

  it('supports completed-step requirements without treating skipped steps as complete', () => {
    const content = [page('a'), page('b', { requiredStepIds: ['a'] })]

    expect(buildVisiblePages(openGuide, content, {}, {}).map(({ id }) => id)).toEqual(['a'])
    expect(buildVisiblePages(openGuide, content, {}, { a: 'skipped' }).map(({ id }) => id)).toEqual(['a'])
    expect(buildVisiblePages(openGuide, content, {}, { a: 'completed' }).map(({ id }) => id)).toEqual(['a', 'b'])
  })

  it('separates guides and ignores stale saved state for removed rows', () => {
    const content = [
      page('open'),
      page('close', { guides: ['Stenge'] }),
      page('drift', { guides: ['Drift'] }),
    ]
    const staleAnswers = { removed: 'Ja' }
    const staleProgress = { removed: 'completed' as const }

    expect(buildVisiblePages(openGuide, content, staleAnswers, staleProgress).map(({ id }) => id)).toEqual(['open'])
    expect(buildVisiblePages(guides['close-cabin'], content, {}, {}).map(({ id }) => id)).toEqual(['close'])
    expect(buildVisiblePages(guides['cabin-operations'], content, {}, {}).map(({ id }) => id)).toEqual(['drift'])
  })
})
