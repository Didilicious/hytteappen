export const familyEventTypes = [
  'birthday',
  'family-dinner',
  'gingerbread-baking',
  'woods-trip',
  'other',
] as const

export type FamilyEventType = typeof familyEventTypes[number]

export type FamilyEvent = {
  id: string
  ownerId: string
  eventType: FamilyEventType
  title: string
  startDate: string
  endDate: string | null
  startTime: string
  endTime: string
  location: string
  wishlistUrl: string
  moreInfo: string
  createdAt: string
  updatedAt: string
}

export const familyEventTypeLabels: Record<FamilyEventType, string> = {
  birthday: 'Bursdag',
  'family-dinner': 'Familiemiddag',
  'gingerbread-baking': 'Pepperkakebaking',
  'woods-trip': 'Skogstur',
  other: 'Annet',
}

export function isFamilyEventType(value: unknown): value is FamilyEventType {
  return typeof value === 'string' && familyEventTypes.includes(value as FamilyEventType)
}
