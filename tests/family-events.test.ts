import { describe, expect, it, vi } from 'vitest'
import type { FamilyEvent } from '../shared/familyEvents'
import { prepareFamilyEvent, prepareFamilyEventUpdate } from '../netlify/functions/_shared/family-event-input.mts'
import { createDeleteFamilyEventFunction } from '../netlify/functions/delete-family-event.mts'
import { createReadOwnFamilyEventsFunction } from '../netlify/functions/read-own-family-events.mts'
import { createUpdateFamilyEventFunction } from '../netlify/functions/update-family-event.mts'
import { familyEventIconNames, getFamilyEventsForDate } from '../src/familyEvents'

const eventId = '123e4567-e89b-42d3-a456-426614174000'
const metadata = { id: eventId, ownerId: 'anette', timestamp: '2026-09-03T10:00:00.000Z' }
const validInput = {
  eventType: 'family-dinner',
  title: '  Søndagsmiddag  ',
  startDate: '2026-09-20',
  endDate: null,
  startTime: '16:00',
  endTime: '19:00',
  location: '  Skogveien 1  ',
  wishlistUrl: 'https://example.com/onsker',
  moreInfo: '  Ta med godt humør.  ',
}
const familyEvent = prepareFamilyEvent(validInput, metadata) as FamilyEvent
const authenticatedUser = { id: 'anette', displayName: 'Anette' }
const otherUser = { id: 'mads', displayName: 'Mads' }

function updateRequest() {
  return new Request(`https://example.com/.netlify/functions/update-family-event?id=${eventId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...validInput, title: 'Oppdatert middag' }),
  })
}

describe('family event input', () => {
  it('normalizes all supported fields while preserving owner metadata', () => {
    expect(familyEvent).toMatchObject({
      id: eventId,
      ownerId: 'anette',
      eventType: 'family-dinner',
      title: 'Søndagsmiddag',
      location: 'Skogveien 1',
      moreInfo: 'Ta med godt humør.',
      createdAt: metadata.timestamp,
      updatedAt: metadata.timestamp,
    })
  })

  it('rejects invalid date, time and wishlist ranges', () => {
    expect(prepareFamilyEvent({ ...validInput, endDate: '2026-09-19' }, metadata)).toBeNull()
    expect(prepareFamilyEvent({ ...validInput, endTime: '15:00' }, metadata)).toBeNull()
    expect(prepareFamilyEvent({ ...validInput, wishlistUrl: 'javascript:alert(1)' }, metadata)).toBeNull()
  })

  it('preserves immutable metadata on update', () => {
    expect(prepareFamilyEventUpdate(
      { ...validInput, title: 'Ny tittel' },
      familyEvent,
      '2026-09-04T08:00:00.000Z',
    )).toMatchObject({
      id: eventId,
      ownerId: 'anette',
      createdAt: metadata.timestamp,
      updatedAt: '2026-09-04T08:00:00.000Z',
      title: 'Ny tittel',
    })
  })
})

describe('family event calendar mapping', () => {
  it('places multi-day events on every included date and maps all Drive icons', () => {
    const multiDayEvent = { ...familyEvent, startDate: '2026-09-20', endDate: '2026-09-22' }
    expect(getFamilyEventsForDate([multiDayEvent], '2026-09-19')).toEqual([])
    expect(getFamilyEventsForDate([multiDayEvent], '2026-09-21')).toEqual([multiDayEvent])
    expect(getFamilyEventsForDate([multiDayEvent], '2026-09-23')).toEqual([])
    expect(familyEventIconNames).toEqual({
      birthday: 'icon_event_birthday',
      'family-dinner': 'icon_event_dinner',
      'gingerbread-baking': 'icon_event_gingerbread',
      'woods-trip': 'icon_event_woods',
      other: 'icon_event_generic',
    })
  })
})

describe('family event ownership', () => {
  it('lists only events owned by the authenticated family', async () => {
    const handler = createReadOwnFamilyEventsFunction({
      authenticate: () => authenticatedUser,
      loadEvents: vi.fn().mockResolvedValue([familyEvent, { ...familyEvent, id: '223e4567-e89b-42d3-a456-426614174000', ownerId: 'mads' }]),
    })
    const response = await handler(new Request('https://example.com/.netlify/functions/read-own-family-events'))
    expect((await response.json() as { events: FamilyEvent[] }).events).toEqual([familyEvent])
  })

  it('allows owner updates and blocks other families', async () => {
    const saveEvent = vi.fn()
    const ownerHandler = createUpdateFamilyEventFunction({
      authenticate: () => authenticatedUser,
      loadEvent: vi.fn().mockResolvedValue(familyEvent),
      saveEvent,
      now: () => '2026-09-04T08:00:00.000Z',
    })
    expect((await ownerHandler(updateRequest())).status).toBe(200)
    expect(saveEvent).toHaveBeenCalledOnce()

    const blockedSave = vi.fn()
    const otherHandler = createUpdateFamilyEventFunction({
      authenticate: () => otherUser,
      loadEvent: vi.fn().mockResolvedValue(familyEvent),
      saveEvent: blockedSave,
    })
    expect((await otherHandler(updateRequest())).status).toBe(403)
    expect(blockedSave).not.toHaveBeenCalled()
  })

  it('allows owner deletion and blocks other families', async () => {
    const deleteRequest = new Request(`https://example.com/.netlify/functions/delete-family-event?id=${eventId}`, { method: 'DELETE' })
    const removeEvent = vi.fn()
    const ownerHandler = createDeleteFamilyEventFunction({
      authenticate: () => authenticatedUser,
      loadEvent: vi.fn().mockResolvedValue(familyEvent),
      removeEvent,
    })
    expect((await ownerHandler(deleteRequest)).status).toBe(204)
    expect(removeEvent).toHaveBeenCalledWith(eventId)

    const blockedRemove = vi.fn()
    const otherHandler = createDeleteFamilyEventFunction({
      authenticate: () => otherUser,
      loadEvent: vi.fn().mockResolvedValue(familyEvent),
      removeEvent: blockedRemove,
    })
    expect((await otherHandler(deleteRequest)).status).toBe(403)
    expect(blockedRemove).not.toHaveBeenCalled()
  })
})
