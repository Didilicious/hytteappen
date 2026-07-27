import { randomUUID } from 'node:crypto'
import type { Config } from '@netlify/functions'
import { createBooking } from './_shared/bookings.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
} from './_shared/session.mts'

type BookingInput = {
  fromDate?: unknown
  toDate?: unknown
  welcomesOthers?: unknown
  partialFamily?: unknown
  comment?: unknown
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/

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

    const body = await request.json() as BookingInput
    const { fromDate, toDate, welcomesOthers, partialFamily } = body
    const comment = body.comment ?? ''

    if (
      typeof fromDate !== 'string'
      || !datePattern.test(fromDate)
      || typeof toDate !== 'string'
      || !datePattern.test(toDate)
      || toDate < fromDate
      || typeof welcomesOthers !== 'boolean'
      || typeof partialFamily !== 'boolean'
      || typeof comment !== 'string'
      || comment.length > 1000
    ) {
      return jsonResponse({ message: 'Kontroller opplysningene og prøv igjen.' }, { status: 400 })
    }

    const timestamp = new Date().toISOString()
    const booking = {
      id: randomUUID(),
      owner: familyMember,
      fromDate,
      toDate,
      welcomesOthers,
      partialFamily,
      comment,
      createdAt: timestamp,
      updatedAt: timestamp,
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
