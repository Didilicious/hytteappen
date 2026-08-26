export type Birthday = {
  month: number
  day: number
}

export type FamilyMember = {
  id: string
  displayName: string
  birthday: Birthday
}

export type Family = {
  accountId: string
  displayName: string
  members: readonly FamilyMember[]
}

export const families: readonly Family[] = [
  {
    accountId: 'anne-jan',
    displayName: 'Anne Marie & Jan',
    members: [
      { id: 'anne-marie', displayName: 'Anne Marie', birthday: { month: 10, day: 21 } },
      { id: 'jan', displayName: 'Jan', birthday: { month: 10, day: 19 } },
    ],
  },
  {
    accountId: 'christine',
    displayName: 'Christine',
    members: [
      { id: 'christine', displayName: 'Christine', birthday: { month: 6, day: 22 } },
      { id: 'othelie', displayName: 'Othelie', birthday: { month: 5, day: 7 } },
      { id: 'emilie', displayName: 'Emilie', birthday: { month: 5, day: 7 } },
      { id: 'mathilde', displayName: 'Mathilde', birthday: { month: 6, day: 20 } },
    ],
  },
  {
    accountId: 'anette',
    displayName: 'Anette',
    members: [
      { id: 'anette', displayName: 'Anette', birthday: { month: 10, day: 14 } },
      { id: 'trond', displayName: 'Trond', birthday: { month: 4, day: 20 } },
      { id: 'caroline', displayName: 'Caroline', birthday: { month: 11, day: 16 } },
      { id: 'pernille', displayName: 'Pernille', birthday: { month: 10, day: 1 } },
      { id: 'oscar', displayName: 'Oscar', birthday: { month: 2, day: 17 } },
    ],
  },
  {
    accountId: 'mads',
    displayName: 'Mads',
    members: [
      { id: 'mads', displayName: 'Mads', birthday: { month: 1, day: 19 } },
      { id: 'benedickte', displayName: 'Benedickte', birthday: { month: 5, day: 22 } },
      { id: 'kristian', displayName: 'Kristian', birthday: { month: 1, day: 27 } },
      { id: 'casper', displayName: 'Casper', birthday: { month: 1, day: 14 } },
      { id: 'phillip', displayName: 'Phillip', birthday: { month: 7, day: 4 } },
    ],
  },
  {
    accountId: 'heidi',
    displayName: 'Heidi',
    members: [
      { id: 'heidi', displayName: 'Heidi', birthday: { month: 2, day: 6 } },
      { id: 'aurora', displayName: 'Aurora', birthday: { month: 3, day: 2 } },
    ],
  },
]

export function getFamily(accountId: unknown): Family | null {
  if (typeof accountId !== 'string') return null
  return families.find((family) => family.accountId === accountId) ?? null
}

export function getFamilyForMember(memberId: unknown): Family | null {
  if (typeof memberId !== 'string') return null
  return families.find((family) => family.members.some((member) => member.id === memberId)) ?? null
}
