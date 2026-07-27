import { describe, expect, it } from 'vitest'
import { normalizeStoredBooking } from '../netlify/functions/_shared/bookings.mts'
import { normalizeBooking, resolveBookingOwner } from '../src/bookings'

const storedBooking = {
  id: 'booking-id',
  fromDate: '2026-07-10',
  toDate: '2026-07-15',
  welcomesOthers: true,
  partialFamily: false,
  comment: '',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
}

describe('booking normalization', () => {
  it('supports the old owner object and ignores its displayName', () => {
    const oldBooking = {
      ...storedBooking,
      owner: { id: 'anne-jan', displayName: 'Gammelt lagret navn' },
    }

    expect(normalizeStoredBooking(oldBooking)).toMatchObject({ ownerId: 'anne-jan' })
    expect(normalizeBooking(oldBooking)).toMatchObject({ ownerId: 'anne-jan' })
    expect(resolveBookingOwner('anne-jan').displayName).toBe('Anne Marie & Jan')
    expect(resolveBookingOwner('anne-jan').styleClass).toBe('booking-owner--anne-jan')
  })

  it('prefers ownerId over a legacy owner object', () => {
    const mixedBooking = {
      ...storedBooking,
      ownerId: 'heidi',
      owner: { id: 'mads', displayName: 'Mads' },
    }

    expect(normalizeStoredBooking(mixedBooking)?.ownerId).toBe('heidi')
    expect(normalizeBooking(mixedBooking)?.ownerId).toBe('heidi')
  })

  it('provides stable semantic color classes for every family', () => {
    expect(['anne-jan', 'christine', 'anette', 'mads', 'heidi'].map((ownerId) => (
      resolveBookingOwner(ownerId).styleClass
    ))).toEqual([
      'booking-owner--anne-jan',
      'booking-owner--christine',
      'booking-owner--anette',
      'booking-owner--mads',
      'booking-owner--heidi',
    ])
  })
})
