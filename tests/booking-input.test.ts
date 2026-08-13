import { describe, expect, it } from 'vitest'
import { prepareBooking, prepareBookingUpdate } from '../netlify/functions/_shared/booking-input.mts'

const metadata = {
  id: 'booking-id',
  ownerId: 'christine',
  timestamp: '2026-07-27T12:00:00.000Z',
}

const validInput = {
  fromDate: '2026-07-27',
  toDate: '2026-07-30',
  welcomesOthers: false,
  partialFamily: false,
  comment: '',
}

describe('prepareBooking', () => {
  it('stores only the authenticated ownerId', () => {
    const booking = prepareBooking({
      ...validInput,
      ownerId: 'mads',
      owner: { id: 'mads', displayName: 'Feil navn' },
    } as typeof validInput, metadata)

    expect(booking).toMatchObject({ ownerId: 'christine' })
    expect(booking).not.toHaveProperty('owner')
  })

  it('trims comments before validation and storage', () => {
    const booking = prepareBooking({ ...validInput, comment: '  Hyggelig tur! \n' }, metadata)
    expect(booking?.comment).toBe('Hyggelig tur!')
  })

  it('stores whitespace-only comments as an empty string', () => {
    const booking = prepareBooking({ ...validInput, comment: ' \n\t ' }, metadata)
    expect(booking?.comment).toBe('')
  })

  it('applies the length limit to the trimmed comment', () => {
    expect(prepareBooking({ ...validInput, comment: `  ${'a'.repeat(1000)}  ` }, metadata)).not.toBeNull()
    expect(prepareBooking({ ...validInput, comment: `  ${'a'.repeat(1001)}  ` }, metadata)).toBeNull()
  })

  it('preserves immutable metadata and updates updatedAt when editing', () => {
    const existing = prepareBooking(validInput, metadata)
    expect(existing).not.toBeNull()

    expect(prepareBookingUpdate(
      { ...validInput, comment: '  Endret  ' },
      existing!,
      '2026-08-13T12:00:00.000Z',
    )).toMatchObject({
      id: metadata.id,
      ownerId: metadata.ownerId,
      createdAt: metadata.timestamp,
      updatedAt: '2026-08-13T12:00:00.000Z',
      comment: 'Endret',
    })
  })
})
