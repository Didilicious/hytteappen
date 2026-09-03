import { createLocalDate, formatDateKey, startOfMonth } from './calendar'

export const calendarReturnStorageKey = 'hytteguiden_calendar_return'

export type CalendarReturnState = {
  path: string
  scrollX: number
  scrollY: number
}

export function getCalendarMonthKey(month: Date) {
  return formatDateKey(startOfMonth(month)).slice(0, 7)
}

export function parseCalendarMonth(search: string, fallback: Date) {
  const value = new URLSearchParams(search).get('month')
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '')
  if (!match) return startOfMonth(fallback)

  const month = createLocalDate(Number(match[1]), Number(match[2]) - 1, 1)
  return getCalendarMonthKey(month) === value ? month : startOfMonth(fallback)
}

export function getCalendarPath(month: Date) {
  return `/booking/calendar?month=${getCalendarMonthKey(month)}`
}

export function getBookingDetailsPath(bookingId: string) {
  return `/booking/${encodeURIComponent(bookingId)}`
}

export function getFamilyEventDetailsPath(eventId: string) {
  return `/booking/event/${encodeURIComponent(eventId)}`
}
