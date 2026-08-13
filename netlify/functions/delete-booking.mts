import type { Config } from '@netlify/functions'
import { isValidBookingId } from './_shared/booking-id.mts'
import { deleteBooking, readBooking } from './_shared/bookings.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type DeleteBookingDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  loadBooking: typeof readBooking
  removeBooking: typeof deleteBooking
}

export function createDeleteBookingFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadBooking = readBooking,
  removeBooking = deleteBooking,
}: Partial<DeleteBookingDependencies> = {}) {
  return async function deleteBookingFunction(request: Request) {
    if (request.method !== 'DELETE') {
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

      if (booking.ownerId !== familyMember.id) {
        return jsonResponse({ message: 'Du kan bare slette dine egne registreringer.' }, { status: 403 })
      }

      await removeBooking(bookingId)
      return new Response(null, {
        status: 204,
        headers: { 'Cache-Control': 'no-store' },
      })
    } catch {
      return jsonResponse({ message: 'Kunne ikke slette registreringen. Prøv igjen.' }, { status: 500 })
    }
  }
}

export default createDeleteBookingFunction()

export const config: Config = {
  method: 'DELETE',
}
