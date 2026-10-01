import { and, eq } from 'drizzle-orm'
import { getDb } from '../../../db/index.ts'
import { familyEventRsvps } from '../../../db/schema.ts'
import type { FamilyEventRsvp, FamilyEventRsvpInput } from '../../../shared/familyEventRsvps.ts'

export async function readFamilyEventRsvp(eventId: string, familyId: string): Promise<FamilyEventRsvp | null> {
  const [rsvp] = await getDb().select().from(familyEventRsvps)
    .where(and(eq(familyEventRsvps.eventId, eventId), eq(familyEventRsvps.familyId, familyId))).limit(1)
  return rsvp ?? null
}

export async function saveFamilyEventRsvp(eventId: string, familyId: string, input: FamilyEventRsvpInput, timestamp: string): Promise<FamilyEventRsvp> {
  const [rsvp] = await getDb().insert(familyEventRsvps)
    .values({ ...input, eventId, familyId, createdAt: timestamp, updatedAt: timestamp })
    .onConflictDoUpdate({
      target: [familyEventRsvps.eventId, familyEventRsvps.familyId],
      set: { ...input, updatedAt: timestamp },
    }).returning()
  return rsvp
}
