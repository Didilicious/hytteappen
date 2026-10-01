import { describe, expect, it, vi } from 'vitest'
import { getFamilyEventAttendance, normalizeFamilyEventRsvpInput } from '../shared/familyEventRsvps'
import { createFamilyEventRsvpFunction } from '../netlify/functions/family-event-rsvp.mts'
import type { FamilyEvent } from '../shared/familyEvents'

const eventId = '123e4567-e89b-42d3-a456-426614174000'
const timestamp = '2026-10-01T10:00:00.000Z'
const familyEvent: FamilyEvent = {
  id: eventId, ownerId: 'mads', eventType: 'family-dinner', title: 'Familiemiddag',
  startDate: '2026-10-18', endDate: null, startTime: '16:00', endTime: '19:00',
  location: 'Skogveien 1', wishlistUrl: '', moreInfo: '', createdAt: timestamp, updatedAt: timestamp,
}
const validInput = { memberIds: ['anette', 'trond'], guestNames: ['  Ingrid  ', '', '   '], nobodyAttending: false }

function request(method = 'GET', input: unknown = validInput, id = eventId) {
  return new Request(`https://example.com/.netlify/functions/family-event-rsvp?id=${id}`, {
    method, ...(method === 'GET' ? {} : { body: JSON.stringify(input) }),
  })
}

function dependencies() {
  return {
    authenticate: () => ({ id: 'anette', displayName: 'Anette' }),
    loadEvent: vi.fn().mockResolvedValue(familyEvent),
    loadRsvp: vi.fn().mockResolvedValue(null),
    loadRsvps: vi.fn().mockResolvedValue([]),
    saveRsvp: vi.fn().mockResolvedValue({ ...validInput, eventId, familyId: 'anette', createdAt: timestamp, updatedAt: timestamp }),
    now: () => timestamp,
  }
}

describe('RSVP input validation', () => {
  it('trims guest names, removes empty guests and deduplicates member IDs', () => {
    expect(normalizeFamilyEventRsvpInput({ ...validInput, memberIds: ['anette', 'anette'] }, 'anette')).toEqual({
      memberIds: ['anette'], guestNames: ['Ingrid'], nobodyAttending: false,
    })
  })

  it.each([
    null,
    { ...validInput, memberIds: ['mads'] },
    { ...validInput, guestNames: [42] },
    { ...validInput, guestNames: ['x'.repeat(201)] },
    { ...validInput, guestNames: Array(101).fill('Ingrid') },
    { ...validInput, nobodyAttending: true },
    { memberIds: [], guestNames: [''], nobodyAttending: false },
    { ...validInput, nobodyAttending: 'false' },
  ])('rejects invalid or contradictory input %j', (input) => {
    expect(normalizeFamilyEventRsvpInput(input, 'anette')).toBeNull()
  })

  it('allows an explicit nobody response or guests without registered members', () => {
    expect(normalizeFamilyEventRsvpInput({ memberIds: [], guestNames: [], nobodyAttending: true }, 'anette')).not.toBeNull()
    expect(normalizeFamilyEventRsvpInput({ memberIds: [], guestNames: ['Ingrid'], nobodyAttending: false }, 'anette')).not.toBeNull()
  })
})

describe('authenticated family event RSVP API', () => {
  it.each(['GET', 'PUT'])('requires authentication for %s', async (method) => {
    const deps = dependencies()
    const handler = createFamilyEventRsvpFunction({ ...deps, authenticate: () => null })
    const response = await handler(request(method))
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(deps.loadEvent).not.toHaveBeenCalled()
    expect(deps.saveRsvp).not.toHaveBeenCalled()
  })

  it.each(['GET', 'PUT'])('blocks the event owner for %s', async (method) => {
    const deps = dependencies()
    deps.loadEvent.mockResolvedValue({ ...familyEvent, ownerId: 'anette' })
    expect((await createFamilyEventRsvpFunction(deps)(request(method))).status).toBe(403)
    expect(deps.loadRsvp).not.toHaveBeenCalled()
    expect(deps.saveRsvp).not.toHaveBeenCalled()
  })

  it('returns only the logged-in family response, including when another family ID is supplied', async () => {
    const deps = dependencies()
    const existing = { ...validInput, eventId, familyId: 'anette', createdAt: timestamp, updatedAt: timestamp }
    deps.loadRsvp.mockResolvedValue(existing)
    const response = await createFamilyEventRsvpFunction(deps)(new Request(`${request().url}&familyId=mads`))
    expect(await response.json()).toEqual({ event: familyEvent, rsvp: existing, attendance: getFamilyEventAttendance(eventId, []) })
    expect(deps.loadRsvp).toHaveBeenCalledWith(eventId, 'anette')
  })

  it('saves normalized input with trusted event, family and server timestamp', async () => {
    const deps = dependencies()
    const response = await createFamilyEventRsvpFunction(deps)(request('PUT', {
      ...validInput, eventId: 'forged', familyId: 'mads', updatedAt: 'forged',
    }))
    expect(response.status).toBe(200)
    expect(deps.saveRsvp).toHaveBeenCalledWith(eventId, 'anette', {
      memberIds: ['anette', 'trond'], guestNames: ['Ingrid'], nobodyAttending: false,
    }, timestamp)
  })

  it('rejects unknown or invalid events, including booking-only IDs', async () => {
    const deps = dependencies()
    const handler = createFamilyEventRsvpFunction(deps)
    expect((await handler(request('GET', null, 'bad-id'))).status).toBe(400)
    deps.loadEvent.mockResolvedValue(null)
    expect((await handler(request('PUT'))).status).toBe(404)
    expect(deps.saveRsvp).not.toHaveBeenCalled()
  })

  it('rejects invalid responses and malformed JSON without saving', async () => {
    const deps = dependencies()
    const handler = createFamilyEventRsvpFunction(deps)
    expect((await handler(request('PUT', { ...validInput, memberIds: ['mads'] }))).status).toBe(400)
    expect((await handler(new Request(request().url, { method: 'PUT', body: '{' }))).status).toBe(400)
    expect(deps.saveRsvp).not.toHaveBeenCalled()
  })

  it('returns errors for unsupported methods or storage failures', async () => {
    const deps = dependencies()
    const handler = createFamilyEventRsvpFunction(deps)
    expect((await handler(request('POST'))).status).toBe(405)
    deps.saveRsvp.mockRejectedValue(new Error('Storage failure'))
    expect((await handler(request('PUT'))).status).toBe(500)
  })
})
