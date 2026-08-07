export const guideContentIds = [
  'nokkelboks',
  'aarstid',
  'strom',
  'skru-pa-vann',
] as const

export type GuideContentId = typeof guideContentIds[number]
export type GuideName = 'Åpne' | 'Stenge' | 'Drift'
export type SheetNodeType = 'step' | 'question'

export type AnswerRequirement = {
  questionId: string
  answer: string
}

export type GuideContent = {
  id: GuideContentId
  guides: GuideName[]
  type: SheetNodeType
  afterId: string | null
  requiredStepIds: string[]
  answerRequirements: AnswerRequirement[]
  title: string
  location: string | null
  warning: string | null
  instructions: string[]
  checkpoints: string | null
  answerOptions: string[]
  canSkip: boolean
  imageGroup: string | null
}

export type GuideContentResponse = {
  contentById: Record<GuideContentId, GuideContent>
}
