import { describe, expect, it } from 'vitest'
import type { GuideContent } from '../shared/guideContent'
import { getDriftPages, getReferencePages, searchDriftPages } from '../src/driftReference'

function page(id: string, overrides: Partial<GuideContent> = {}): GuideContent {
  return {
    id,
    guides: ['Drift'],
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

describe('Drift reference pages', () => {
  it('includes every Drift row in Sheet order regardless of guide dependencies', () => {
    const content = [
      page('first', { afterId: 'last', requiredStepIds: ['missing'] }),
      page('open', { guides: ['Åpne'] }),
      page('last'),
    ]

    expect(getDriftPages(content).map(({ id }) => id)).toEqual(['first', 'last'])
  })

  it('returns Feilsøking rows as independent reference pages in Sheet order', () => {
    const content = [
      page('first', { guides: ['Feilsøking'], afterId: 'last', requiredStepIds: ['missing'] }),
      page('drift'),
      page('last', { guides: ['Feilsøking'] }),
    ]

    expect(getReferencePages(content, 'Feilsøking').map(({ id }) => id)).toEqual(['first', 'last'])
  })

  it('searches titles and all visible page content case-insensitively', () => {
    const pages = [
      page('water', { title: 'Vannsystem', instructions: ['Steng hovedkranen i kjelleren.'] }),
      page('wood', { title: 'Ved og opptenning', warning: 'Bruk tørr ved.' }),
    ]

    expect(searchDriftPages(pages, 'VANN').map(({ page }) => page.id)).toEqual(['water'])
    const contentMatch = searchDriftPages(pages, 'hovedkranen')[0]
    expect(contentMatch.page.id).toBe('water')
    expect(contentMatch.snippet).toContain('hovedkranen')
    expect(searchDriftPages(pages, 'mangler')).toEqual([])
  })

  it('returns at most one short content snippet per matching page', () => {
    const result = searchDriftPages([
      page('water', { instructions: [`Først ${'lang tekst '.repeat(30)}vann og deretter vann igjen.`] }),
    ], 'vann')[0]

    expect(result.snippet?.length).toBeLessThanOrEqual(134)
    expect(searchDriftPages([page('water', { title: 'Vann' })], 'vann')[0].snippet).toBeNull()
  })
})
