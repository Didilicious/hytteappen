import { families, type Birthday, type FamilyMember } from '../shared/families'

export type BirthdayMember = FamilyMember & {
  familyId: string
}

const norwegianMonths = [
  'januar',
  'februar',
  'mars',
  'april',
  'mai',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'desember',
]

export const birthdayMembers: readonly BirthdayMember[] = families.flatMap((family) => (
  family.members.map((member) => ({ ...member, familyId: family.accountId }))
))

export function formatBirthday(birthday: Birthday) {
  return `${birthday.day}. ${norwegianMonths[birthday.month - 1]}`
}

export function getBirthdayDescription(displayName: string) {
  return /[sxz]$/i.test(displayName)
    ? `${displayName}’ bursdag`
    : `${displayName}s bursdag`
}

export function getBirthdaysForDate(date: Date) {
  const month = date.getMonth() + 1
  const day = date.getDate()

  return birthdayMembers.filter((member) => (
    member.birthday.month === month && member.birthday.day === day
  ))
}

export function getBirthdayIndicatorLabel(birthdays: readonly BirthdayMember[]) {
  if (birthdays.length === 1) return getBirthdayDescription(birthdays[0].displayName)
  return `${birthdays.length} bursdager`
}
