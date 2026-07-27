import type { Config } from '@netlify/functions'
import { readBooking } from './_shared/bookings.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type ReadBookingDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  loadBooking: typeof readBooking
}

const bookingIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidBookingId(value: unknown): value is string {
  return typeof value === 'string' && bookingIdPattern.test(value)
}

export function createReadBookingFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadBooking = readBooking,
}: Partial<ReadBookingDependencies> = {}) {
  return async function readBookingFunction(request: Request) {
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

      const bookingId = new URL(request.url).searchParams.get('id')
      if (!isValidBookingId(bookingId)) {
        return jsonResponse({ message: 'Ugyldig registrering.' }, { status: 400 })
      }

      const booking = await loadBooking(bookingId)
      if (!booking) {
        return jsonResponse({ message: 'Registreringen finnes ikke.' }, { status: 404 })
      }

      return jsonResponse({ booking })
    } catch {
      return jsonResponse({ message: 'Kunne ikke hente registreringen.' }, { status: 500 })
    }
  }
}

export default createReadBookingFunction()

export const config: Config = {
  method: 'GET',
}
