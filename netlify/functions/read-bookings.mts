import type { Config } from '@netlify/functions'
import { readBookings } from './_shared/bookings.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
} from './_shared/session.mts'

export default async function readBookingsFunction(request: Request) {
  if (request.method !== 'GET') {
    return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
  }

  try {
    const familyMember = getAuthenticatedFamilyMember(request)

    if (!familyMember) {
      return jsonResponse(
        { message: 'Økten har utløpt. Logg inn på nytt.' },
        { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
      )
    }

    return jsonResponse({ bookings: await readBookings() })
  } catch {
    return jsonResponse({ message: 'Kunne ikke hente registrerte tider.' }, { status: 500 })
  }
}

export const config: Config = {
  method: 'GET',
}
