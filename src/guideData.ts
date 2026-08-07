import type { GuideContentId } from '../shared/guideContent'

export type GuideNodeType = 'instruction' | 'question' | 'completion'

export type GuideNodeBase<Type extends GuideNodeType> = {
  id: string
  type: Type
  nextNodeId?: string
  contentId?: GuideContentId
}

export type GuideOption = {
  id: string
  nextNodeId?: string
  disabled?: boolean
}

export type QuestionNode = GuideNodeBase<'question'> & {
  contentId: GuideContentId
  options: GuideOption[]
}

export type InstructionNode = GuideNodeBase<'instruction'> & {
  contentId: GuideContentId
  nextNodeId: string
}

export type CompletionNode = GuideNodeBase<'completion'> & {
  title: string
  paragraphs: string[]
  actionLabel: string
  nextPath: string
}

export type GuideNode = QuestionNode | InstructionNode | CompletionNode

export type GuideSectionIcon = 'cabin-open' | 'lock' | 'calendar' | 'meal'

export type GuideSectionMetadata = {
  label: string
  icon: GuideSectionIcon
  overviewNodeId?: string
}

export type GuideDefinition = {
  id: string
  title: string
  section: GuideSectionMetadata
  startNodeId: string
  nodes: Record<string, GuideNode>
}

const openCabinGuide: GuideDefinition = {
  id: 'open-cabin',
  title: 'Åpne hytte',
  section: {
    label: 'ÅPNE HYTTE',
    icon: 'cabin-open',
    overviewNodeId: 'overview',
  },
  startNodeId: 'get-key',
  nodes: {
    'get-key': {
      id: 'get-key',
      type: 'instruction',
      contentId: 'nokkelboks',
      nextNodeId: 'select-season',
    },
    'select-season': {
      id: 'select-season',
      type: 'question',
      contentId: 'aarstid',
      options: [
        { id: 'winter', nextNodeId: 'turn-on-power' },
        { id: 'spring', disabled: true },
        { id: 'summer', nextNodeId: 'summer-prototype-complete' },
        { id: 'autumn', disabled: true },
      ],
    },
    'turn-on-power': {
      id: 'turn-on-power',
      type: 'instruction',
      contentId: 'strom',
      nextNodeId: 'check-dishwasher-valve',
    },
    'check-dishwasher-valve': {
      id: 'check-dishwasher-valve',
      type: 'instruction',
      contentId: 'skru-pa-vann',
      nextNodeId: 'test-complete',
    },
    'test-complete': {
      id: 'test-complete',
      type: 'completion',
      title: 'Test fullført',
      paragraphs: ['Du har fullført den korte vintertesten.'],
      actionLabel: 'Tilbake til forsiden',
      nextPath: '/',
    },
    'summer-prototype-complete': {
      id: 'summer-prototype-complete',
      type: 'completion',
      title: 'Første steg er fullført.',
      paragraphs: ['Flere sommersteg kommer senere.'],
      actionLabel: 'Tilbake til forsiden',
      nextPath: '/',
    },
  },
}

const closeCabinGuide: GuideDefinition = {
  id: 'close-cabin',
  title: 'Stenge hytte',
  section: {
    label: 'STENGE HYTTE',
    icon: 'lock',
  },
  startNodeId: 'not-ready',
  nodes: {
    'not-ready': {
      id: 'not-ready',
      type: 'completion',
      title: 'Stenge hytte',
      paragraphs: ['Denne guiden er ikke ferdig ennå.'],
      actionLabel: 'Tilbake til forsiden',
      nextPath: '/',
    },
  },
}

const cabinOperationsGuide: GuideDefinition = {
  id: 'cabin-operations',
  title: 'Drift av hytte',
  section: {
    label: 'DRIFT AV HYTTE',
    icon: 'cabin-open',
  },
  startNodeId: 'not-ready',
  nodes: {
    'not-ready': {
      id: 'not-ready',
      type: 'completion',
      title: 'Drift av hytte',
      paragraphs: ['Denne guiden er ikke ferdig ennå.'],
      actionLabel: 'Tilbake til forsiden',
      nextPath: '/',
    },
  },
}

export const guides: Record<string, GuideDefinition> = {
  [openCabinGuide.id]: openCabinGuide,
  [closeCabinGuide.id]: closeCabinGuide,
  [cabinOperationsGuide.id]: cabinOperationsGuide,
}
