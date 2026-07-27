import { getFamilyMember } from '../shared/familyMembers'
import { parseLocalDate } from './calendar'
import type { Booking } from './bookings'

const detailDateFormatter = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const detailDateWithoutYearFormatter = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'long',
})

export function formatBookingDate(dateKey: string) {
  const date = parseLocalDate(dateKey)
  return date ? detailDateFormatter.format(date) : dateKey
}

export function formatBookingDateRange(booking: Pick<Booking, 'fromDate' | 'toDate'>) {
  if (booking.fromDate === booking.toDate) return formatBookingDate(booking.fromDate)

  const fromDate = parseLocalDate(booking.fromDate)
  const toDate = parseLocalDate(booking.toDate)
  if (!fromDate || !toDate) {
    return `${formatBookingDate(booking.fromDate)} – ${formatBookingDate(booking.toDate)}`
  }

  if (fromDate.getFullYear() === toDate.getFullYear()) {
    return `${detailDateWithoutYearFormatter.format(fromDate)} – ${detailDateFormatter.format(toDate)}`
  }

  return `${detailDateFormatter.format(fromDate)} – ${detailDateFormatter.format(toDate)}`
}

export function getBookingOwnerDisplayName(ownerId: string) {
  return getFamilyMember(ownerId)?.displayName ?? 'Ukjent familie'
}

export function isBookingOwner(booking: Pick<Booking, 'ownerId'>, currentOwnerId: string | undefined) {
  return booking.ownerId === currentOwnerId
}

export function hasBookingComment(comment: string) {
  return comment.trim().length > 0
}
