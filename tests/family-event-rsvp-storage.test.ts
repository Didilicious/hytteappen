import { beforeEach, describe, expect, it, vi } from 'vitest'
import { familyEventRsvps } from '../db/schema'
import { readFamilyEventRsvp, saveFamilyEventRsvp } from '../netlify/functions/_shared/family-event-rsvps.mts'

const database = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn() }))
vi.mock('../db/index.ts', () => ({ getDb: () => database }))

const eventId = '123e4567-e89b-42d3-a456-426614174000'
const timestamp = '2026-10-01T10:00:00.000Z'
const input = { memberIds: ['anette'], guestNames: ['Ingrid'], nobodyAttending: false }
const response = { ...input, eventId, familyId: 'anette', createdAt: timestamp, updatedAt: timestamp }

describe('persistent RSVP storage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts by stable event/family key and atomically updates only response fields and update time', async () => {
    const returning = vi.fn().mockResolvedValue([response])
    const onConflictDoUpdate = vi.fn().mockReturnValue({ returning })
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate })
    database.insert.mockReturnValue({ values })

    expect(await saveFamilyEventRsvp(eventId, 'anette', input, timestamp)).toEqual(response)
    expect(database.insert).toHaveBeenCalledWith(familyEventRsvps)
    expect(values).toHaveBeenCalledWith(response)
    expect(onConflictDoUpdate).toHaveBeenCalledWith({
      target: [familyEventRsvps.eventId, familyEventRsvps.familyId],
      set: { ...input, updatedAt: timestamp },
    })
  })

  it('reads the stored response or returns null when no response exists', async () => {
    const limit = vi.fn().mockResolvedValueOnce([response]).mockResolvedValueOnce([])
    const where = vi.fn().mockReturnValue({ limit })
    const from = vi.fn().mockReturnValue({ where })
    database.select.mockReturnValue({ from })

    expect(await readFamilyEventRsvp(eventId, 'anette')).toEqual(response)
    expect(await readFamilyEventRsvp(eventId, 'anette')).toBeNull()
    expect(from).toHaveBeenCalledWith(familyEventRsvps)
    expect(where).toHaveBeenCalledTimes(2)
    expect(limit).toHaveBeenCalledWith(1)
  })
})
