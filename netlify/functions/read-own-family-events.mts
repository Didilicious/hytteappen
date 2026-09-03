import type { Config } from '@netlify/functions'
import { readFamilyEvents } from './_shared/family-events.mts'
import { clearSessionCookie, getAuthenticatedFamilyMember, jsonResponse } from './_shared/session.mts'

type Dependencies = {
  authenticate: typeof getAuthenticatedFamilyMember
  loadEvents: typeof readFamilyEvents
}

export function createReadOwnFamilyEventsFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadEvents = readFamilyEvents,
}: Partial<Dependencies> = {}) {
  return async function readOwnFamilyEventsFunction(request: Request) {
    if (request.method !== 'GET') return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })

    try {
      const familyMember = authenticate(request)
      if (!familyMember) {
        return jsonResponse(
          { message: 'Økten har utløpt. Logg inn på nytt.' },
          { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
        )
      }
      const events = (await loadEvents()).filter(({ ownerId }) => ownerId === familyMember.id)
      return jsonResponse({ events })
    } catch {
      return jsonResponse({ message: 'Kunne ikke hente familiearrangementene.' }, { status: 500 })
    }
  }
}

export default createReadOwnFamilyEventsFunction()

export const config: Config = { method: 'GET' }
