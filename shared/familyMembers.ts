export type FamilyMember = {
  id: string
  displayName: string
}

export const familyMembers: FamilyMember[] = [
  { id: 'anne-jan', displayName: 'Anne Marie & Jan' },
  { id: 'christine', displayName: 'Christine' },
  { id: 'anette', displayName: 'Anette' },
  { id: 'mads', displayName: 'Mads' },
  { id: 'heidi', displayName: 'Heidi' },
]

export function getFamilyMember(accountId: unknown): FamilyMember | null {
  if (typeof accountId !== 'string') return null
  return familyMembers.find((familyMember) => familyMember.id === accountId) ?? null
}
