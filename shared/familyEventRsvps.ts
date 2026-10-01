import { families, getFamily } from './families'

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

export type AttendancePerson = { id: string; displayName: string }
export type FamilyEventAttendance = {
  attending: AttendancePerson[]
  notAttending: AttendancePerson[]
  unanswered: AttendancePerson[]
}

export function getFamilyEventAttendance(eventId: string, rsvps: FamilyEventRsvp[]): FamilyEventAttendance {
  const attendance: FamilyEventAttendance = { attending: [], notAttending: [], unanswered: [] }
  for (const family of families) {
    const rsvp = rsvps.find((response) => response.eventId === eventId && response.familyId === family.accountId)
    for (const member of family.members) {
      const group = !rsvp ? attendance.unanswered
        : !rsvp.nobodyAttending && rsvp.memberIds.includes(member.id) ? attendance.attending : attendance.notAttending
      group.push({ id: member.id, displayName: member.displayName })
    }
    if (rsvp && !rsvp.nobodyAttending) {
      rsvp.guestNames.forEach((name, index) => {
        if (name.trim()) attendance.attending.push({ id: `guest-${family.accountId}-${index}`, displayName: name.trim() })
      })
    }
  }
  return attendance
}

export function normalizeOrganizerAttendance(memberIds: unknown, familyId: string): FamilyEventRsvpInput | null {
  return normalizeFamilyEventRsvpInput({
    memberIds, guestNames: [], nobodyAttending: Array.isArray(memberIds) && memberIds.length === 0,
  }, familyId)
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
