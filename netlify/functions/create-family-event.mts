import { randomUUID } from 'node:crypto'
import type { Config } from '@netlify/functions'
import { normalizeOrganizerAttendance } from '../../shared/familyEventRsvps.ts'
import { saveFamilyEventRsvp } from './_shared/family-event-rsvps.mts'
import { prepareFamilyEvent, type FamilyEventInput } from './_shared/family-event-input.mts'
import { createFamilyEvent } from './_shared/family-events.mts'
import { clearSessionCookie, getAuthenticatedFamilyMember, jsonResponse } from './_shared/session.mts'

type Dependencies = {
  authenticate: typeof getAuthenticatedFamilyMember
  saveEvent: typeof createFamilyEvent
  saveRsvp: typeof saveFamilyEventRsvp
  now: () => string
  createId: () => string
}

export function createFamilyEventFunction({
  authenticate = getAuthenticatedFamilyMember,
  saveEvent = createFamilyEvent,
  saveRsvp = saveFamilyEventRsvp,
  now = () => new Date().toISOString(),
  createId = randomUUID,
}: Partial<Dependencies> = {}) {
  return async function familyEventFunction(request: Request) {
    if (request.method !== 'POST') return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })

    try {
      const familyMember = authenticate(request)
      if (!familyMember) {
        return jsonResponse(
          { message: 'Økten har utløpt. Logg inn på nytt.' },
          { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
        )
      }

      const timestamp = now()
      const input = await request.json().catch(() => null) as FamilyEventInput | null
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return jsonResponse({ message: 'Kontroller opplysningene og prøv igjen.' }, { status: 400 })
      }
      const attendance = normalizeOrganizerAttendance(input.organizerMemberIds === undefined ? [] : input.organizerMemberIds, familyMember.id)
      if (!attendance) return jsonResponse({ message: 'Velg gyldige familiemedlemmer.' }, { status: 400 })
      const event = prepareFamilyEvent(input, {
        id: createId(),
        ownerId: familyMember.id,
        timestamp,
      })
      if (!event) return jsonResponse({ message: 'Kontroller opplysningene og prøv igjen.' }, { status: 400 })

      await saveEvent(event)
      await saveRsvp(event.id, familyMember.id, attendance, timestamp)
      return jsonResponse({ event }, { status: 201 })
    } catch {
      return jsonResponse({ message: 'Kunne ikke lagre arrangementet. Prøv igjen.' }, { status: 500 })
    }
  }
}

export default createFamilyEventFunction()

export const config: Config = { method: 'POST' }
