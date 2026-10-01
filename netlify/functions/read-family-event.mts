import type { Config } from '@netlify/functions'
import { getFamilyEventAttendance } from '../../shared/familyEventRsvps.ts'
import { readFamilyEventRsvps } from './_shared/family-event-rsvps.mts'
import { isValidFamilyEventId } from './_shared/family-event-id.mts'
import { readFamilyEvent } from './_shared/family-events.mts'
import { readFamilyEventInvitation } from './_shared/noticeboard-posts.mts'
import { clearSessionCookie, getAuthenticatedFamilyMember, jsonResponse } from './_shared/session.mts'

type Dependencies = {
  authenticate: typeof getAuthenticatedFamilyMember
  loadEvent: typeof readFamilyEvent
  loadRsvps: typeof readFamilyEventRsvps
  loadInvitation: typeof readFamilyEventInvitation
}

export function createReadFamilyEventFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadEvent = readFamilyEvent,
  loadRsvps = readFamilyEventRsvps,
  loadInvitation = readFamilyEventInvitation,
}: Partial<Dependencies> = {}) {
  return async function readFamilyEventFunction(request: Request) {
    if (request.method !== 'GET') return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })

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
      const event = await loadEvent(eventId)
      if (!event) return jsonResponse({ message: 'Arrangementet finnes ikke.' }, { status: 404 })
      if (new URL(request.url).searchParams.get('ownerOnly') === 'true' && event.ownerId !== familyMember.id) {
        return jsonResponse({ message: 'Du kan bare redigere dine egne arrangementer.' }, { status: 403 })
      }
      const rsvps = await loadRsvps(eventId)
      const invitation = event.ownerId === familyMember.id && new URL(request.url).searchParams.get('includeInvitation') === 'true'
        ? await loadInvitation(eventId) : undefined
      return jsonResponse({
        event,
        ...(new URL(request.url).searchParams.get('includeInvitation') === 'true'
          ? { invitation: invitation ? { id: invitation.id, ownerId: invitation.ownerId } : null } : {}),
        attendance: getFamilyEventAttendance(eventId, rsvps),
        ...(event.ownerId === familyMember.id ? { organizerRsvp: rsvps.find((rsvp) => rsvp.familyId === familyMember.id) ?? null } : {}),
      })
    } catch {
      return jsonResponse({ message: 'Kunne ikke hente arrangementet.' }, { status: 500 })
    }
  }
}

export default createReadFamilyEventFunction()

export const config: Config = { method: 'GET' }
