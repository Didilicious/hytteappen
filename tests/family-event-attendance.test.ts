import { describe, expect, it } from 'vitest'
import { families } from '../shared/families'
import { getFamilyEventAttendance, normalizeOrganizerAttendance, type FamilyEventRsvp } from '../shared/familyEventRsvps'

const eventId = '123e4567-e89b-42d3-a456-426614174000'
const totalMembers = families.reduce((total, family) => total + family.members.length, 0)

function rsvp(familyId: string, memberIds: string[] = [], guestNames: string[] = []): FamilyEventRsvp {
  return { eventId, familyId, memberIds, guestNames, nobodyAttending: !memberIds.length && !guestNames.length, createdAt: '', updatedAt: '' }
}

describe('family event attendance groups', () => {
  it('counts all registered people as unanswered before any family responds', () => {
    const attendance = getFamilyEventAttendance(eventId, [])
    expect(attendance.attending).toEqual([])
    expect(attendance.notAttending).toEqual([])
    expect(attendance.unanswered).toHaveLength(totalMembers)
  })

  it('includes organizer selections and named guests while classifying each registered person once', () => {
    const attendance = getFamilyEventAttendance(eventId, [
      rsvp('mads', ['mads', 'casper']),
      rsvp('anette', ['trond'], ['Ingrid', 'Sindre', '  ']),
      rsvp('heidi'),
    ])
    expect(attendance.attending.map((person) => person.displayName)).toEqual(['Trond', 'Ingrid', 'Sindre', 'Mads', 'Casper'])
    expect(attendance.notAttending.map((person) => person.displayName)).toEqual([
      'Anette', 'Caroline', 'Pernille', 'Oscar', 'Benedickte', 'Kristian', 'Phillip', 'Heidi', 'Aurora',
    ])
    expect(attendance.unanswered.map((person) => person.displayName)).toEqual(['Anne Marie', 'Jan', 'Christine', 'Othelie', 'Emilie', 'Mathilde'])
    expect(attendance.attending.length + attendance.notAttending.length + attendance.unanswered.length).toBe(totalMembers + 2)
  })

  it('does not infer organizer attendance or include responses for other events or unknown families', () => {
    const attendance = getFamilyEventAttendance(eventId, [
      { ...rsvp('mads', ['mads']), eventId: 'another-event' },
      rsvp('unknown', [], ['Guest']),
    ])
    expect(attendance.unanswered).toHaveLength(totalMembers)
    expect(attendance.attending).toEqual([])
  })

  it('keeps identically named guests as separate people', () => {
    const attendance = getFamilyEventAttendance(eventId, [rsvp('anette', [], ['Ingrid', 'Ingrid'])])
    expect(attendance.attending).toHaveLength(2)
    expect(new Set(attendance.attending.map((person) => person.id)).size).toBe(2)
    expect(attendance.notAttending).toHaveLength(5)
  })

  it('saves an empty organizer selection as a submitted nobody response', () => {
    expect(normalizeOrganizerAttendance([], 'mads')).toEqual({ memberIds: [], guestNames: [], nobodyAttending: true })
    expect(normalizeOrganizerAttendance(['mads', 'mads'], 'mads')).toEqual({ memberIds: ['mads'], guestNames: [], nobodyAttending: false })
    expect(normalizeOrganizerAttendance(['anette'], 'mads')).toBeNull()
    expect(normalizeOrganizerAttendance(null, 'mads')).toBeNull()
  })
})
