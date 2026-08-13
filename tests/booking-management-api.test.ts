import { describe, expect, it, vi } from 'vitest'
import type { Booking } from '../netlify/functions/_shared/bookings.mts'
import { createDeleteBookingFunction } from '../netlify/functions/delete-booking.mts'
import { createReadOwnBookingsFunction } from '../netlify/functions/read-own-bookings.mts'
import { createUpdateBookingFunction } from '../netlify/functions/update-booking.mts'

const bookingId = '123e4567-e89b-42d3-a456-426614174000'
const booking: Booking = {
  id: bookingId,
  ownerId: 'anette',
  fromDate: '2026-08-20',
  toDate: '2026-08-24',
  welcomesOthers: true,
  partialFamily: false,
  comment: 'Før endring',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
}
const authenticatedUser = { id: 'anette', displayName: 'Anette' }
const otherUser = { id: 'mads', displayName: 'Mads' }

function updateRequest() {
  return new Request(`https://example.com/.netlify/functions/update-booking?id=${bookingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromDate: '2026-09-02',
      toDate: '2026-09-05',
      welcomesOthers: false,
      partialFamily: true,
      comment: '  Etter endring  ',
    }),
  })
}

describe('owned booking listing', () => {
  it('returns only bookings belonging to the authenticated family', async () => {
    const handler = createReadOwnBookingsFunction({
      authenticate: () => authenticatedUser,
      loadBookings: vi.fn().mockResolvedValue([
        booking,
        { ...booking, id: '223e4567-e89b-42d3-a456-426614174000', ownerId: 'mads' },
      ]),
    })

    const response = await handler(new Request('https://example.com/.netlify/functions/read-own-bookings'))
    const body = await response.json() as { bookings: Booking[] }

    expect(response.status).toBe(200)
    expect(body.bookings).toEqual([booking])
  })
})

describe('update booking endpoint', () => {
  it('updates owned bookings and preserves immutable metadata', async () => {
    const saveBooking = vi.fn()
    const handler = createUpdateBookingFunction({
      authenticate: () => authenticatedUser,
      loadBooking: vi.fn().mockResolvedValue(booking),
      saveBooking,
      now: () => '2026-08-13T12:00:00.000Z',
    })

    const response = await handler(updateRequest())
    const body = await response.json() as { booking: Booking }

    expect(response.status).toBe(200)
    expect(body.booking).toMatchObject({
      id: booking.id,
      ownerId: booking.ownerId,
      createdAt: booking.createdAt,
      updatedAt: '2026-08-13T12:00:00.000Z',
      fromDate: '2026-09-02',
      comment: 'Etter endring',
    })
    expect(saveBooking).toHaveBeenCalledWith(body.booking)
  })

  it('returns 403 when another family attempts an edit', async () => {
    const saveBooking = vi.fn()
    const handler = createUpdateBookingFunction({
      authenticate: () => otherUser,
      loadBooking: vi.fn().mockResolvedValue(booking),
      saveBooking,
    })

    const response = await handler(updateRequest())

    expect(response.status).toBe(403)
    expect(saveBooking).not.toHaveBeenCalled()
  })

  it('returns 404 when the booking no longer exists', async () => {
    const handler = createUpdateBookingFunction({
      authenticate: () => authenticatedUser,
      loadBooking: vi.fn().mockResolvedValue(null),
    })

    expect((await handler(updateRequest())).status).toBe(404)
  })
})

describe('delete booking endpoint', () => {
  function deleteRequest() {
    return new Request(`https://example.com/.netlify/functions/delete-booking?id=${bookingId}`, { method: 'DELETE' })
  }

  it('permanently deletes an owned booking', async () => {
    const removeBooking = vi.fn()
    const handler = createDeleteBookingFunction({
      authenticate: () => authenticatedUser,
      loadBooking: vi.fn().mockResolvedValue(booking),
      removeBooking,
    })

    const response = await handler(deleteRequest())

    expect(response.status).toBe(204)
    expect(removeBooking).toHaveBeenCalledWith(bookingId)
  })

  it('returns 403 when another family attempts a delete', async () => {
    const removeBooking = vi.fn()
    const handler = createDeleteBookingFunction({
      authenticate: () => otherUser,
      loadBooking: vi.fn().mockResolvedValue(booking),
      removeBooking,
    })

    const response = await handler(deleteRequest())

    expect(response.status).toBe(403)
    expect(removeBooking).not.toHaveBeenCalled()
  })

  it('returns 404 when the booking no longer exists', async () => {
    const handler = createDeleteBookingFunction({
      authenticate: () => authenticatedUser,
      loadBooking: vi.fn().mockResolvedValue(null),
    })

    expect((await handler(deleteRequest())).status).toBe(404)
  })
})
