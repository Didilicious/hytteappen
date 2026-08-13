import type { Config } from '@netlify/functions'
import { readBookings } from './_shared/bookings.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type ReadOwnBookingsDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  loadBookings: typeof readBookings
}

export function createReadOwnBookingsFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadBookings = readBookings,
}: Partial<ReadOwnBookingsDependencies> = {}) {
  return async function readOwnBookingsFunction(request: Request) {
    if (request.method !== 'GET') {
      return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
    }

    try {
      const familyMember = authenticate(request)
      if (!familyMember) {
        return jsonResponse(
          { message: 'Økten har utløpt. Logg inn på nytt.' },
          { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
        )
      }

      const bookings = (await loadBookings()).filter(({ ownerId }) => ownerId === familyMember.id)
      return jsonResponse({ bookings })
    } catch {
      return jsonResponse({ message: 'Kunne ikke hente registrerte tider.' }, { status: 500 })
    }
  }
}

export default createReadOwnBookingsFunction()

export const config: Config = {
  method: 'GET',
}
