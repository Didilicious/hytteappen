import type { Config } from '@netlify/functions'
import { isValidFamilyEventId } from './_shared/family-event-id.mts'
import { readFamilyEvent } from './_shared/family-events.mts'
import { clearSessionCookie, getAuthenticatedFamilyMember, jsonResponse } from './_shared/session.mts'

export default async function readFamilyEventFunction(request: Request) {
  if (request.method !== 'GET') return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })

  try {
    const familyMember = getAuthenticatedFamilyMember(request)
    if (!familyMember) {
      return jsonResponse(
        { message: 'Økten har utløpt. Logg inn på nytt.' },
        { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
      )
    }

    const eventId = new URL(request.url).searchParams.get('id')
    if (!isValidFamilyEventId(eventId)) return jsonResponse({ message: 'Ugyldig arrangement.' }, { status: 400 })
    const event = await readFamilyEvent(eventId)
    if (!event) return jsonResponse({ message: 'Arrangementet finnes ikke.' }, { status: 404 })
    if (new URL(request.url).searchParams.get('ownerOnly') === 'true' && event.ownerId !== familyMember.id) {
      return jsonResponse({ message: 'Du kan bare redigere dine egne arrangementer.' }, { status: 403 })
    }
    return jsonResponse({ event })
  } catch {
    return jsonResponse({ message: 'Kunne ikke hente arrangementet.' }, { status: 500 })
  }
}

export const config: Config = { method: 'GET' }
