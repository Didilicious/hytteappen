import type { Config } from '@netlify/functions'
import { normalizeFamilyEventRsvpInput } from '../../shared/familyEventRsvps.ts'
import { isValidFamilyEventId } from './_shared/family-event-id.mts'
import { readFamilyEvent } from './_shared/family-events.mts'
import { readFamilyEventRsvp, saveFamilyEventRsvp } from './_shared/family-event-rsvps.mts'
import { clearSessionCookie, getAuthenticatedFamilyMember, jsonResponse } from './_shared/session.mts'

type Dependencies = {
  authenticate: typeof getAuthenticatedFamilyMember
  loadEvent: typeof readFamilyEvent
  loadRsvp: typeof readFamilyEventRsvp
  saveRsvp: typeof saveFamilyEventRsvp
  now: () => string
}

export function createFamilyEventRsvpFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadEvent = readFamilyEvent,
  loadRsvp = readFamilyEventRsvp,
  saveRsvp = saveFamilyEventRsvp,
  now = () => new Date().toISOString(),
}: Partial<Dependencies> = {}) {
  return async function familyEventRsvpFunction(request: Request) {
    if (request.method !== 'GET' && request.method !== 'PUT') {
      return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
    }
    try {
      const family = authenticate(request)
      if (!family) {
        return jsonResponse({ message: 'Økten har utløpt. Logg inn på nytt.' }, {
          status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) },
        })
      }
      const eventId = new URL(request.url).searchParams.get('id')
      if (!isValidFamilyEventId(eventId)) return jsonResponse({ message: 'Ugyldig arrangement.' }, { status: 400 })
      const event = await loadEvent(eventId)
      if (!event) return jsonResponse({ message: 'Arrangementet finnes ikke.' }, { status: 404 })
      if (event.ownerId === family.id) {
        return jsonResponse({ message: 'Du kan ikke svare på ditt eget arrangement.' }, { status: 403 })
      }
      if (request.method === 'GET') {
        return jsonResponse({ event, rsvp: await loadRsvp(eventId, family.id) })
      }
      const input = normalizeFamilyEventRsvpInput(await request.json().catch(() => null), family.id)
      if (!input) {
        return jsonResponse({ message: 'Velg hvem som kommer, eller velg «Ingen kommer».' }, { status: 400 })
      }
      return jsonResponse({ rsvp: await saveRsvp(eventId, family.id, input, now()) })
    } catch {
      return jsonResponse({ message: 'Kunne ikke hente eller lagre svaret. Prøv igjen.' }, { status: 500 })
    }
  }
}

export default createFamilyEventRsvpFunction()

export const config: Config = { method: ['GET', 'PUT'] }
