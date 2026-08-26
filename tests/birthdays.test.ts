import { describe, expect, it } from 'vitest'
import { getFamily } from '../shared/families'
import { formatBirthday } from '../src/birthdays'

describe('family member birthday data', () => {
  it('stores birthdays beside the correct stable family member IDs', () => {
    const heidi = getFamily('heidi')?.members.find((member) => member.id === 'heidi')
    const aurora = getFamily('heidi')?.members.find((member) => member.id === 'aurora')
    const othelie = getFamily('christine')?.members.find((member) => member.id === 'othelie')

    expect(heidi?.birthday).toEqual({ month: 2, day: 6 })
    expect(aurora?.birthday).toEqual({ month: 3, day: 2 })
    expect(othelie?.birthday).toEqual({ month: 5, day: 7 })
  })

  it('formats birthdays naturally in Norwegian without a year', () => {
    const birthday = getFamily('anne-jan')?.members.find((member) => member.id === 'anne-marie')?.birthday

    expect(birthday && formatBirthday(birthday)).toBe('21. oktober')
    expect(birthday && formatBirthday(birthday)).not.toMatch(/\b\d{4}\b/)
  })
})
