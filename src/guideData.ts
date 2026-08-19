import type { GuideName } from '../shared/guideContent'

export type GuideSectionIcon = 'cabin-open' | 'lock' | 'calendar' | 'meal'

export type GuideSectionMetadata = {
  label: string
  icon: GuideSectionIcon
  overviewNodeId: string
}

export type GuideDefinition = {
  id: string
  name: GuideName
  title: string
  section: GuideSectionMetadata
}

export const guides: Record<string, GuideDefinition> = {
  'open-cabin': {
    id: 'open-cabin',
    name: 'Åpne',
    title: 'Åpne hytte',
    section: {
      label: 'ÅPNE HYTTE',
      icon: 'cabin-open',
      overviewNodeId: 'overview',
    },
  },
  'close-cabin': {
    id: 'close-cabin',
    name: 'Stenge',
    title: 'Stenge hytte',
    section: {
      label: 'STENGE HYTTE',
      icon: 'lock',
      overviewNodeId: 'overview',
    },
  },
  'cabin-operations': {
    id: 'cabin-operations',
    name: 'Drift',
    title: 'Drift av hytte',
    section: {
      label: 'DRIFT AV HYTTE',
      icon: 'cabin-open',
      overviewNodeId: 'overview',
    },
  },
}
