import { getFamily } from './families'

export type FamilyEventRsvpInput = {
  memberIds: string[]
  guestNames: string[]
  nobodyAttending: boolean
}

export type FamilyEventRsvp = FamilyEventRsvpInput & {
  eventId: string
  familyId: string
  createdAt: string
  updatedAt: string
}

export function normalizeFamilyEventRsvpInput(value: unknown, familyId: string): FamilyEventRsvpInput | null {
  const family = getFamily(familyId)
  if (!family || !value || typeof value !== 'object') return null
  const input = value as Partial<FamilyEventRsvpInput>
  if (
    typeof input.nobodyAttending !== 'boolean'
    || !Array.isArray(input.memberIds)
    || !input.memberIds.every((memberId) => family.members.some((member) => member.id === memberId))
    || !Array.isArray(input.guestNames)
    || input.guestNames.length > 100
    || !input.guestNames.every((name) => typeof name === 'string' && name.trim().length <= 200)
  ) return null

  const memberIds = [...new Set(input.memberIds)]
  const guestNames = input.guestNames.map((name) => name.trim()).filter(Boolean)
  if (input.nobodyAttending && (memberIds.length || guestNames.length)) return null
  if (!input.nobodyAttending && !memberIds.length && !guestNames.length) return null
  return { memberIds, guestNames, nobodyAttending: input.nobodyAttending }
}
