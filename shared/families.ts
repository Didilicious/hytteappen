export type FamilyMember = {
  id: string
  displayName: string
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
      { id: 'anne-marie', displayName: 'Anne Marie' },
      { id: 'jan', displayName: 'Jan' },
    ],
  },
  {
    accountId: 'christine',
    displayName: 'Christine',
    members: [
      { id: 'christine', displayName: 'Christine' },
      { id: 'othelie', displayName: 'Othelie' },
      { id: 'emilie', displayName: 'Emilie' },
      { id: 'mathilde', displayName: 'Mathilde' },
    ],
  },
  {
    accountId: 'anette',
    displayName: 'Anette',
    members: [
      { id: 'anette', displayName: 'Anette' },
      { id: 'trond', displayName: 'Trond' },
      { id: 'caroline', displayName: 'Caroline' },
      { id: 'pernille', displayName: 'Pernille' },
      { id: 'oscar', displayName: 'Oscar' },
    ],
  },
  {
    accountId: 'mads',
    displayName: 'Mads',
    members: [
      { id: 'mads', displayName: 'Mads' },
      { id: 'benedickte', displayName: 'Benedickte' },
      { id: 'kristian', displayName: 'Kristian' },
      { id: 'casper', displayName: 'Casper' },
      { id: 'phillip', displayName: 'Phillip' },
    ],
  },
  {
    accountId: 'heidi',
    displayName: 'Heidi',
    members: [
      { id: 'heidi', displayName: 'Heidi' },
      { id: 'aurora', displayName: 'Aurora' },
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
