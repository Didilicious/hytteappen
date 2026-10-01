import { describe, expect, it, vi } from 'vitest'
import { createFamilyEventFunction } from '../netlify/functions/create-family-event.mts'
import { createUpdateFamilyEventFunction } from '../netlify/functions/update-family-event.mts'
import { createReadFamilyEventFunction } from '../netlify/functions/read-family-event.mts'
import { getFamilyEventAttendance } from '../shared/familyEventRsvps'
import type { FamilyEvent } from '../shared/familyEvents'

const eventId = '123e4567-e89b-42d3-a456-426614174000'
const timestamp = '2026-10-01T10:00:00.000Z'
const familyEvent: FamilyEvent = {
  id: eventId, ownerId: 'mads', eventType: 'family-dinner', title: 'Familiemiddag',
  startDate: '2026-10-18', endDate: null, startTime: '', endTime: '', location: '',
  wishlistUrl: '', moreInfo: '', createdAt: timestamp, updatedAt: timestamp,
}

function dependencies() {
  return {
    authenticate: () => ({ id: 'mads', displayName: 'Mads' }),
    loadEvent: vi.fn().mockResolvedValue(familyEvent),
    loadRsvps: vi.fn().mockResolvedValue([]),
    saveEvent: vi.fn().mockResolvedValue(undefined),
    saveRsvp: vi.fn().mockResolvedValue({}),
    now: () => timestamp,
    createId: () => eventId,
  }
}

function request(method: string, input: unknown = familyEvent, search = '') {
  return new Request(`https://example.com/event?id=${eventId}${search}`, {
    method, ...(method === 'GET' ? {} : { body: JSON.stringify(input) }),
  })
}

describe('organizer attendance persistence', () => {
  it.each([{ memberIds: [] }, { memberIds: ['mads', 'casper'] }])('creates organizer attendance using the RSVP model for %j', async ({ memberIds }) => {
    const deps = dependencies()
    const response = await createFamilyEventFunction(deps)(request('POST', { ...familyEvent, organizerMemberIds: memberIds }))
    expect(response.status).toBe(201)
    expect(deps.saveRsvp).toHaveBeenCalledWith(eventId, 'mads', { memberIds, guestNames: [], nobodyAttending: memberIds.length === 0 }, timestamp)
    expect(deps.saveEvent).toHaveBeenCalledWith(familyEvent)
  })

  it('defaults new event attendance to nobody selected', async () => {
    const deps = dependencies()
    expect((await createFamilyEventFunction(deps)(request('POST'))).status).toBe(201)
    expect(deps.saveRsvp).toHaveBeenCalledWith(eventId, 'mads', { memberIds: [], guestNames: [], nobodyAttending: true }, timestamp)
  })

  it.each([{ memberIds: [] }, { memberIds: ['mads'] }])('updates organizer attendance, including clearing all members: %j', async ({ memberIds }) => {
    const deps = dependencies()
    expect((await createUpdateFamilyEventFunction(deps)(request('PATCH', { ...familyEvent, organizerMemberIds: memberIds }))).status).toBe(200)
    expect(deps.saveRsvp).toHaveBeenCalledWith(eventId, 'mads', { memberIds, guestNames: [], nobodyAttending: memberIds.length === 0 }, timestamp)
  })

  it('preserves attendance when an older edit client omits selections', async () => {
    const deps = dependencies()
    expect((await createUpdateFamilyEventFunction(deps)(request('PATCH'))).status).toBe(200)
    expect(deps.saveRsvp).not.toHaveBeenCalled()
  })

  it.each(['POST', 'PATCH'])('rejects another family member before either save for %s', async (method) => {
    const deps = dependencies()
    const handler = method === 'POST' ? createFamilyEventFunction(deps) : createUpdateFamilyEventFunction(deps)
    expect((await handler(request(method, { ...familyEvent, organizerMemberIds: ['anette'] }))).status).toBe(400)
    expect(deps.saveEvent).not.toHaveBeenCalled()
    expect(deps.saveRsvp).not.toHaveBeenCalled()
  })

  it.each(['POST', 'PATCH'])('does not report success when saving attendance fails for %s', async (method) => {
    const deps = dependencies()
    deps.saveRsvp.mockRejectedValue(new Error('Database unavailable'))
    const handler = method === 'POST' ? createFamilyEventFunction(deps) : createUpdateFamilyEventFunction(deps)
    expect((await handler(request(method, { ...familyEvent, organizerMemberIds: ['mads'] }))).status).toBe(500)
  })

  it('requires authentication for creating or changing attendance', async () => {
    const deps = { ...dependencies(), authenticate: () => null }
    expect((await createFamilyEventFunction(deps)(request('POST'))).status).toBe(401)
    expect((await createUpdateFamilyEventFunction(deps)(request('PATCH'))).status).toBe(401)
    expect(deps.saveRsvp).not.toHaveBeenCalled()
  })

  it('blocks another family from changing organizer attendance', async () => {
    const deps = { ...dependencies(), authenticate: () => ({ id: 'anette', displayName: 'Anette' }) }
    expect((await createUpdateFamilyEventFunction(deps)(request('PATCH'))).status).toBe(403)
    expect(deps.saveRsvp).not.toHaveBeenCalled()
  })
})

describe('event attendance read API', () => {
  it('returns shared attendance and stored organizer selections for editing', async () => {
    const deps = dependencies()
    const organizerRsvp = { eventId, familyId: 'mads', memberIds: ['casper'], guestNames: [], nobodyAttending: false, createdAt: timestamp, updatedAt: timestamp }
    deps.loadRsvps.mockResolvedValue([organizerRsvp])
    const response = await createReadFamilyEventFunction(deps)(request('GET', null, '&ownerOnly=true'))
    expect(await response.json()).toEqual({ event: familyEvent, organizerRsvp, attendance: getFamilyEventAttendance(eventId, [organizerRsvp]) })
    expect(deps.loadRsvps).toHaveBeenCalledWith(eventId)
  })

  it('returns attendance to other authenticated families without exposing the organizer response', async () => {
    const deps = { ...dependencies(), authenticate: () => ({ id: 'anette', displayName: 'Anette' }) }
    const response = await createReadFamilyEventFunction(deps)(request('GET'))
    expect(await response.json()).toEqual({ event: familyEvent, attendance: getFamilyEventAttendance(eventId, []) })
  })

  it('does not load attendance for unauthenticated or unauthorized requests', async () => {
    const deps = dependencies()
    expect((await createReadFamilyEventFunction({ ...deps, authenticate: () => null })(request('GET'))).status).toBe(401)
    expect((await createReadFamilyEventFunction({ ...deps, authenticate: () => ({ id: 'anette', displayName: 'Anette' }) })(request('GET', null, '&ownerOnly=true'))).status).toBe(403)
    expect(deps.loadRsvps).not.toHaveBeenCalled()
  })
})
