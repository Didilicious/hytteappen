import type { Config } from '@netlify/functions'
import { readFamilyEvents } from './_shared/family-events.mts'
import { clearSessionCookie, getAuthenticatedFamilyMember, jsonResponse } from './_shared/session.mts'

export default async function readFamilyEventsFunction(request: Request) {
  if (request.method !== 'GET') return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })

  try {
    if (!getAuthenticatedFamilyMember(request)) {
      return jsonResponse(
        { message: 'Økten har utløpt. Logg inn på nytt.' },
        { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
      )
    }
    return jsonResponse({ events: await readFamilyEvents() })
  } catch {
    return jsonResponse({ message: 'Kunne ikke hente familiearrangementer.' }, { status: 500 })
  }
}

export const config: Config = { method: 'GET' }
