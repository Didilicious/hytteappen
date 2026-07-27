import { randomUUID } from 'node:crypto'
import type { Config } from '@netlify/functions'
import { prepareBooking, type BookingInput } from './_shared/booking-input.mts'
import { createBooking } from './_shared/bookings.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
} from './_shared/session.mts'

export default async function createBookingFunction(request: Request) {
  if (request.method !== 'POST') {
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

    const timestamp = new Date().toISOString()
    const booking = prepareBooking(await request.json() as BookingInput, {
      id: randomUUID(),
      ownerId: familyMember.id,
      timestamp,
    })

    if (!booking) {
      return jsonResponse({ message: 'Kontroller opplysningene og prøv igjen.' }, { status: 400 })
    }

    await createBooking(booking)

    return jsonResponse({ booking }, { status: 201 })
  } catch {
    return jsonResponse({ message: 'Kunne ikke lagre tiden. Prøv igjen.' }, { status: 500 })
  }
}

export const config: Config = {
  method: 'POST',
}
