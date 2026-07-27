import { getStore } from '@netlify/blobs'
import type { FamilyMember } from './session.mts'

export type Booking = {
  id: string
  owner: FamilyMember
  fromDate: string
  toDate: string
  welcomesOthers: boolean
  partialFamily: boolean
  comment: string
  createdAt: string
  updatedAt: string
}

function getBookingsStore() {
  return getStore('bookings')
}

function isBooking(value: unknown): value is Booking {
  if (!value || typeof value !== 'object') return false

  const booking = value as Partial<Booking>
  return (
    typeof booking.id === 'string'
    && typeof booking.owner?.id === 'string'
    && typeof booking.owner.displayName === 'string'
    && typeof booking.fromDate === 'string'
    && typeof booking.toDate === 'string'
    && typeof booking.welcomesOthers === 'boolean'
    && typeof booking.partialFamily === 'boolean'
    && typeof booking.comment === 'string'
    && typeof booking.createdAt === 'string'
    && typeof booking.updatedAt === 'string'
  )
}

export async function createBooking(booking: Booking) {
  await getBookingsStore().setJSON(booking.id, booking)
}

export async function readBookings() {
  const bookingsStore = getBookingsStore()
  const { blobs } = await bookingsStore.list()
  const storedBookings = await Promise.all(
    blobs.map(({ key }) => bookingsStore.get(key, { type: 'json' })),
  )

  return storedBookings
    .filter(isBooking)
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
}
