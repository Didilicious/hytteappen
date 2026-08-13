import type { Config } from '@netlify/functions'
import { isValidBookingId } from './_shared/booking-id.mts'
import { prepareBookingUpdate, type BookingInput } from './_shared/booking-input.mts'
import { readBooking, updateBooking } from './_shared/bookings.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type UpdateBookingDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  loadBooking: typeof readBooking
  saveBooking: typeof updateBooking
  now: () => string
}

export function createUpdateBookingFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadBooking = readBooking,
  saveBooking = updateBooking,
  now = () => new Date().toISOString(),
}: Partial<UpdateBookingDependencies> = {}) {
  return async function updateBookingFunction(request: Request) {
    if (request.method !== 'PATCH') {
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

      const existingBooking = await loadBooking(bookingId)
      if (!existingBooking) {
        return jsonResponse({ message: 'Registreringen finnes ikke.' }, { status: 404 })
      }

      if (existingBooking.ownerId !== familyMember.id) {
        return jsonResponse({ message: 'Du kan bare redigere dine egne registreringer.' }, { status: 403 })
      }

      const booking = prepareBookingUpdate(await request.json() as BookingInput, existingBooking, now())
      if (!booking) {
        return jsonResponse({ message: 'Kontroller opplysningene og prøv igjen.' }, { status: 400 })
      }

      await saveBooking(booking)
      return jsonResponse({ booking })
    } catch {
      return jsonResponse({ message: 'Kunne ikke lagre endringene. Prøv igjen.' }, { status: 500 })
    }
  }
}

export default createUpdateBookingFunction()

export const config: Config = {
  method: 'PATCH',
}
