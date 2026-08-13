import { describe, expect, it, vi } from 'vitest'
import { createReadBookingFunction, isValidBookingId } from '../netlify/functions/read-booking.mts'
import type { Booking } from '../netlify/functions/_shared/bookings.mts'

const bookingId = '123e4567-e89b-42d3-a456-426614174000'
const booking: Booking = {
  id: bookingId,
  ownerId: 'anette',
  fromDate: '2026-08-10',
  toDate: '2026-08-12',
  welcomesOthers: true,
  partialFamily: false,
  comment: '',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
}

const authenticatedUser = { id: 'anette', displayName: 'Anette' }

describe('read booking endpoint', () => {
  it('loads a booking by validated ID', async () => {
    const loadBooking = vi.fn().mockResolvedValue(booking)
    const handler = createReadBookingFunction({
      authenticate: () => authenticatedUser,
      loadBooking,
    })

    const response = await handler(new Request(`https://example.com/.netlify/functions/read-booking?id=${bookingId}`))

    expect(response.status).toBe(200)
    expect(loadBooking).toHaveBeenCalledWith(bookingId)
    expect(await response.json()).toEqual({ booking })
  })

  it('returns 404 when the booking does not exist', async () => {
    const handler = createReadBookingFunction({
      authenticate: () => authenticatedUser,
      loadBooking: vi.fn().mockResolvedValue(null),
    })

    const response = await handler(new Request(`https://example.com/.netlify/functions/read-booking?id=${bookingId}`))

    expect(response.status).toBe(404)
  })

  it('returns 403 when an edit load targets another family booking', async () => {
    const handler = createReadBookingFunction({
      authenticate: () => ({ id: 'mads', displayName: 'Mads' }),
      loadBooking: vi.fn().mockResolvedValue(booking),
    })

    const response = await handler(new Request(
      `https://example.com/.netlify/functions/read-booking?id=${bookingId}&ownerOnly=true`,
    ))

    expect(response.status).toBe(403)
  })

  it('rejects invalid booking IDs before reading storage', async () => {
    const loadBooking = vi.fn()
    const handler = createReadBookingFunction({
      authenticate: () => authenticatedUser,
      loadBooking,
    })

    const response = await handler(new Request('https://example.com/.netlify/functions/read-booking?id=not-a-booking'))

    expect(response.status).toBe(400)
    expect(loadBooking).not.toHaveBeenCalled()
    expect(isValidBookingId(bookingId)).toBe(true)
  })

  it('returns 401 for an invalid session', async () => {
    const handler = createReadBookingFunction({ authenticate: () => null })
    const response = await handler(new Request(`https://example.com/.netlify/functions/read-booking?id=${bookingId}`))

    expect(response.status).toBe(401)
  })
})
