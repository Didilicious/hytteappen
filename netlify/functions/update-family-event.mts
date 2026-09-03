import type { Config } from '@netlify/functions'
import { isValidFamilyEventId } from './_shared/family-event-id.mts'
import { prepareFamilyEventUpdate, type FamilyEventInput } from './_shared/family-event-input.mts'
import { readFamilyEvent, updateFamilyEvent } from './_shared/family-events.mts'
import { clearSessionCookie, getAuthenticatedFamilyMember, jsonResponse } from './_shared/session.mts'

type Dependencies = {
  authenticate: typeof getAuthenticatedFamilyMember
  loadEvent: typeof readFamilyEvent
  saveEvent: typeof updateFamilyEvent
  now: () => string
}

export function createUpdateFamilyEventFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadEvent = readFamilyEvent,
  saveEvent = updateFamilyEvent,
  now = () => new Date().toISOString(),
}: Partial<Dependencies> = {}) {
  return async function updateFamilyEventFunction(request: Request) {
    if (request.method !== 'PATCH') return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })

    try {
      const familyMember = authenticate(request)
      if (!familyMember) {
        return jsonResponse(
          { message: 'Økten har utløpt. Logg inn på nytt.' },
          { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
        )
      }

      const eventId = new URL(request.url).searchParams.get('id')
      if (!isValidFamilyEventId(eventId)) return jsonResponse({ message: 'Ugyldig arrangement.' }, { status: 400 })
      const existing = await loadEvent(eventId)
      if (!existing) return jsonResponse({ message: 'Arrangementet finnes ikke.' }, { status: 404 })
      if (existing.ownerId !== familyMember.id) {
        return jsonResponse({ message: 'Du kan bare redigere dine egne arrangementer.' }, { status: 403 })
      }

      const event = prepareFamilyEventUpdate(await request.json() as FamilyEventInput, existing, now())
      if (!event) return jsonResponse({ message: 'Kontroller opplysningene og prøv igjen.' }, { status: 400 })
      await saveEvent(event)
      return jsonResponse({ event })
    } catch {
      return jsonResponse({ message: 'Kunne ikke lagre endringene. Prøv igjen.' }, { status: 500 })
    }
  }
}

export default createUpdateFamilyEventFunction()

export const config: Config = { method: 'PATCH' }
