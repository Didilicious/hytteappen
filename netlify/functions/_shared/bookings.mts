import { getStore } from '@netlify/blobs'

export type Booking = {
  id: string
  ownerId: string
  fromDate: string
  toDate: string
  welcomesOthers: boolean
  partialFamily: boolean
  comment: string
  createdAt: string
  updatedAt: string
}

type LegacyOwner = {
  id?: unknown
  displayName?: unknown
}

type StoredBooking = Partial<Booking> & {
  owner?: LegacyOwner
}

function getBookingsStore() {
  return getStore({ name: 'bookings', consistency: 'strong' })
}

export function normalizeStoredBooking(value: unknown): Booking | null {
  if (!value || typeof value !== 'object') return null

  const storedBooking = value as StoredBooking
  const ownerId = typeof storedBooking.ownerId === 'string'
    ? storedBooking.ownerId
    : typeof storedBooking.owner?.id === 'string'
      ? storedBooking.owner.id
      : null

  if (
    typeof storedBooking.id !== 'string'
    || !ownerId
    || typeof storedBooking.fromDate !== 'string'
    || typeof storedBooking.toDate !== 'string'
    || typeof storedBooking.welcomesOthers !== 'boolean'
    || typeof storedBooking.partialFamily !== 'boolean'
    || typeof storedBooking.comment !== 'string'
    || typeof storedBooking.createdAt !== 'string'
    || typeof storedBooking.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: storedBooking.id,
    ownerId,
    fromDate: storedBooking.fromDate,
    toDate: storedBooking.toDate,
    welcomesOthers: storedBooking.welcomesOthers,
    partialFamily: storedBooking.partialFamily,
    comment: storedBooking.comment,
    createdAt: storedBooking.createdAt,
    updatedAt: storedBooking.updatedAt,
  }
}

export async function createBooking(booking: Booking) {
  await getBookingsStore().setJSON(booking.id, booking)
}

export async function updateBooking(booking: Booking) {
  await getBookingsStore().setJSON(booking.id, booking)
}

export async function deleteBooking(bookingId: string) {
  await getBookingsStore().delete(bookingId)
}

export async function readBooking(bookingId: string) {
  const storedBooking = await getBookingsStore().get(bookingId, { type: 'json' })
  return normalizeStoredBooking(storedBooking)
}

export async function readBookings() {
  const bookingsStore = getBookingsStore()
  const { blobs } = await bookingsStore.list()
  const storedBookings = await Promise.all(
    blobs.map(({ key }) => bookingsStore.get(key, { type: 'json' })),
  )

  return storedBookings
    .map(normalizeStoredBooking)
    .filter((booking): booking is Booking => booking !== null)
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
}
