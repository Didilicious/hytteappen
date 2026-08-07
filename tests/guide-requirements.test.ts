import { describe, expect, it } from 'vitest'
import type { GuideContent, GuideContentId } from '../shared/guideContent'
import { guides } from '../src/guideData'
import { areAnswerRequirementsMet } from '../src/guideRequirements'

function content(overrides: Partial<GuideContent> & Pick<GuideContent, 'id' | 'type' | 'title'>): GuideContent {
  return {
    guides: ['Åpne'],
    afterId: null,
    requiredStepIds: [],
    answerRequirements: [],
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

const contentById = {
  nokkelboks: content({ id: 'nokkelboks', type: 'step', title: 'Hent nøkkelen' }),
  aarstid: content({
    id: 'aarstid',
    type: 'question',
    title: 'Hvilken årstid er det nå?',
    answerOptions: ['Vinter', 'Vår / tidlig sommer', 'Sommer', 'Høst / tidlig vinter'],
  }),
  strom: content({ id: 'strom', type: 'step', title: 'Slå på strømmen' }),
  'skru-pa-vann': content({
    id: 'skru-pa-vann',
    type: 'step',
    title: 'Test tittel',
    answerRequirements: [{ questionId: 'aarstid', answer: 'Vinter' }],
  }),
} satisfies Record<GuideContentId, GuideContent>

describe('areAnswerRequirementsMet', () => {
  it('shows a page only when every required answer label matches', () => {
    const guide = guides['open-cabin']
    const node = { ...guide.nodes['check-dishwasher-valve'] }

    expect(areAnswerRequirementsMet(guide, node, { 'select-season': 'winter' }, contentById)).toBe(true)
    expect(areAnswerRequirementsMet(guide, node, { 'select-season': 'summer' }, contentById)).toBe(false)

    const contentWithConflictingRequirements = {
      ...contentById,
      'skru-pa-vann': {
        ...contentById['skru-pa-vann'],
        answerRequirements: [
          { questionId: 'aarstid', answer: 'Vinter' },
          { questionId: 'aarstid', answer: 'Sommer' },
        ],
      },
    }
    expect(areAnswerRequirementsMet(
      guide,
      node,
      { 'select-season': 'winter' },
      contentWithConflictingRequirements,
    )).toBe(false)
  })
})
