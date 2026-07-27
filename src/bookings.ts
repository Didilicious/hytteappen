import { getFamilyMember } from '../shared/familyMembers'

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

type StoredBooking = Partial<Booking> & {
  owner?: {
    id?: unknown
    displayName?: unknown
  }
}

export type BookingOwner = {
  id: string
  displayName: string
  legendName: string
  compactName: string
  marker: string
  styleClass: string
}

export function normalizeBooking(value: unknown): Booking | null {
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

function getCompactName(displayName: string) {
  if (displayName === 'Anne Marie & Jan') return 'A&J'
  return displayName.slice(0, 3)
}

function getLegendName(displayName: string) {
  if (displayName === 'Anne Marie & Jan') return 'Anne & Jan'
  return displayName
}

function getMarker(displayName: string) {
  if (displayName.includes('&')) {
    return displayName
      .split('&')
      .map((name) => name.trim().charAt(0))
      .join('&')
  }

  return displayName.slice(0, 2).toLocaleUpperCase('nb-NO')
}

export function resolveBookingOwner(ownerId: string): BookingOwner {
  const familyMember = getFamilyMember(ownerId)

  if (!familyMember) {
    return {
      id: ownerId,
      displayName: 'Ukjent familie',
      legendName: 'Ukjent',
      compactName: 'Ukj.',
      marker: '?',
      styleClass: 'booking-owner--unknown',
    }
  }

  return {
    ...familyMember,
    legendName: getLegendName(familyMember.displayName),
    compactName: getCompactName(familyMember.displayName),
    marker: getMarker(familyMember.displayName),
    styleClass: `booking-owner--${familyMember.id}`,
  }
}
