import type { Booking } from './bookings.mts'

export type BookingInput = {
  fromDate?: unknown
  toDate?: unknown
  welcomesOthers?: unknown
  partialFamily?: unknown
  comment?: unknown
}

type BookingMetadata = {
  id: string
  ownerId: string
  timestamp: string
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export function prepareBooking(input: BookingInput, metadata: BookingMetadata): Booking | null {
  const { fromDate, toDate, welcomesOthers, partialFamily } = input
  const comment = typeof input.comment === 'string' ? input.comment.trim() : input.comment ?? ''

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
    return null
  }

  return {
    id: metadata.id,
    ownerId: metadata.ownerId,
    fromDate,
    toDate,
    welcomesOthers,
    partialFamily,
    comment,
    createdAt: metadata.timestamp,
    updatedAt: metadata.timestamp,
  }
}
