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
        'Koden er 1234.',
        'Lås opp den nye ytterdøren, og legg nøkkelen tilbake i nøkkelboksen med én gang.',
      ],
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

export const guides: Record<string, GuideDefinition> = {
  [openCabinGuide.id]: openCabinGuide,
}
