import { describe, expect, it } from 'vitest'
import type { Booking } from '../src/bookings'
import {
  addMonths,
  createLocalDate,
  formatDateKey,
  getBookingsForDate,
  getCalendarDays,
  parseLocalDate,
} from '../src/calendar'

function booking(overrides: Partial<Booking>): Booking {
  return {
    id: 'booking-1',
    ownerId: 'anette',
    fromDate: '2026-07-10',
    toDate: '2026-07-15',
    welcomesOthers: false,
    partialFamily: false,
    comment: '',
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('booking calendar ranges', () => {
  it('shows a same-day booking only on its date', () => {
    const bookings = [booking({ fromDate: '2026-07-12', toDate: '2026-07-12' })]

    expect(getBookingsForDate(bookings, '2026-07-11')).toHaveLength(0)
    expect(getBookingsForDate(bookings, '2026-07-12')).toHaveLength(1)
    expect(getBookingsForDate(bookings, '2026-07-13')).toHaveLength(0)
  })

  it('includes both endpoints of a multi-day booking', () => {
    const bookings = [booking({ fromDate: '2026-07-10', toDate: '2026-07-15' })]

    expect(getBookingsForDate(bookings, '2026-07-10')).toHaveLength(1)
    expect(getBookingsForDate(bookings, '2026-07-15')).toHaveLength(1)
    expect(getBookingsForDate(bookings, '2026-07-16')).toHaveLength(0)
  })

  it('keeps every overlapping booking visible', () => {
    const bookings = [
      booking({ id: 'booking-1', ownerId: 'anette' }),
      booking({ id: 'booking-2', ownerId: 'mads', fromDate: '2026-07-12', toDate: '2026-07-18' }),
    ]

    expect(getBookingsForDate(bookings, '2026-07-13').map(({ id }) => id)).toEqual([
      'booking-1',
      'booking-2',
    ])
  })
})

describe('calendar dates and navigation', () => {
  it('navigates across month and year boundaries', () => {
    const january = createLocalDate(2026, 0, 1)

    expect(formatDateKey(addMonths(january, -1))).toBe('2025-12-01')
    expect(formatDateKey(addMonths(january, 1))).toBe('2026-02-01')
  })

  it('lays out complete weeks starting on Monday', () => {
    const days = getCalendarDays(createLocalDate(2026, 6, 1))

    expect(days).toHaveLength(35)
    expect(days[0].date.getDay()).toBe(1)
    expect(days[0].dateKey).toBe('2026-06-29')
    expect(days.at(-1)?.date.getDay()).toBe(0)
    expect(days.at(-1)?.dateKey).toBe('2026-08-02')
  })

  it('parses date-only values as local calendar dates', () => {
    const date = parseLocalDate('2026-07-10')

    expect(date).not.toBeNull()
    expect(date && formatDateKey(date)).toBe('2026-07-10')
    expect(date?.getHours()).toBe(12)
  })
})
