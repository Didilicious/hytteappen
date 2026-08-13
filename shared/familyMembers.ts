import { families } from './families'

export type FamilyMember = {
  id: string
  displayName: string
}

export const familyMembers: FamilyMember[] = families.map((family) => ({
  id: family.accountId,
  displayName: family.displayName,
}))

export function getFamilyMember(accountId: unknown): FamilyMember | null {
  if (typeof accountId !== 'string') return null
  return familyMembers.find((familyMember) => familyMember.id === accountId) ?? null
}
