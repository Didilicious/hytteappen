import type { Booking } from './bookings'

export type CalendarDay = {
  date: Date
  dateKey: string
  isCurrentMonth: boolean
}

export const norwegianWeekdays = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

export function createLocalDate(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, day, 12)
}

export function parseLocalDate(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) return null

  const [, year, month, day] = match
  const date = createLocalDate(Number(year), Number(month) - 1, Number(day))

  if (
    date.getFullYear() !== Number(year)
    || date.getMonth() !== Number(month) - 1
    || date.getDate() !== Number(day)
  ) {
    return null
  }

  return date
}

export function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function startOfMonth(date: Date) {
  return createLocalDate(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date: Date, amount: number) {
  return createLocalDate(date.getFullYear(), date.getMonth() + amount, 1)
}

export function getCalendarDays(month: Date): CalendarDay[] {
  const monthStart = startOfMonth(month)
  const mondayOffset = (monthStart.getDay() + 6) % 7
  const gridStart = createLocalDate(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    1 - mondayOffset,
  )
  const nextMonth = addMonths(monthStart, 1)
  const finalDayOffset = Math.ceil((mondayOffset + new Date(
    nextMonth.getFullYear(),
    nextMonth.getMonth(),
    0,
  ).getDate()) / 7) * 7

  return Array.from({ length: finalDayOffset }, (_, index) => {
    const date = createLocalDate(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    )

    return {
      date,
      dateKey: formatDateKey(date),
      isCurrentMonth: date.getMonth() === monthStart.getMonth()
        && date.getFullYear() === monthStart.getFullYear(),
    }
  })
}

export function getBookingsForDate(bookings: Booking[], dateKey: string) {
  return bookings
    .filter((booking) => booking.fromDate <= dateKey && booking.toDate >= dateKey)
    .sort((first, second) => (
      first.ownerId.localeCompare(second.ownerId)
      || first.fromDate.localeCompare(second.fromDate)
      || first.createdAt.localeCompare(second.createdAt)
    ))
}

export function hasBookingsInMonth(bookings: Booking[], month: Date) {
  const firstDate = formatDateKey(startOfMonth(month))
  const lastDate = formatDateKey(createLocalDate(month.getFullYear(), month.getMonth() + 1, 0))
  return bookings.some((booking) => booking.fromDate <= lastDate && booking.toDate >= firstDate)
}
