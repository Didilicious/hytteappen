export type GuideNodeType = 'instruction' | 'question' | 'completion'

export type GuideNodeBase<Type extends GuideNodeType> = {
  id: string
  type: Type
  title: string
  nextNodeId?: string
}

export type GuideOption = {
  id: string
  label: string
  nextNodeId?: string
  disabled?: boolean
}

export type QuestionNode = GuideNodeBase<'question'> & {
  prompt?: string
  options: GuideOption[]
}

export type InstructionNode = GuideNodeBase<'instruction'> & {
  paragraphs: string[]
  nextNodeId: string
  showsKeyBoxCode?: boolean
}

export type CompletionNode = GuideNodeBase<'completion'> & {
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
      title: 'Hent nøkkelen',
      paragraphs: [
        'Åpne nøkkelboksen som er plassert til høyre for den gamle ytterdøren.',
        'Lås opp den nye ytterdøren, og legg nøkkelen tilbake i nøkkelboksen med én gang.',
      ],
      showsKeyBoxCode: true,
      nextNodeId: 'select-season',
    },
    'select-season': {
      id: 'select-season',
      type: 'question',
      title: 'Hvilken tid på året er det nå?',
      options: [
        { id: 'winter', label: 'Vinter', nextNodeId: 'turn-on-power' },
        { id: 'spring', label: 'Vår / tidlig sommer', disabled: true },
        { id: 'summer', label: 'Sommer', nextNodeId: 'summer-prototype-complete' },
        { id: 'autumn', label: 'Høst / tidlig vinter', disabled: true },
      ],
    },
    'turn-on-power': {
      id: 'turn-on-power',
      type: 'instruction',
      title: 'Slå på strømmen',
      paragraphs: ['Slå på hovedstrømmen, og kontroller at hytta får strøm.'],
      nextNodeId: 'check-dishwasher-valve',
    },
    'check-dishwasher-valve': {
      id: 'check-dishwasher-valve',
      type: 'instruction',
      title: 'Kontroller stoppekranen til oppvaskmaskinen',
      paragraphs: ['Kontroller at stoppekranen til oppvaskmaskinen står i riktig posisjon.'],
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
