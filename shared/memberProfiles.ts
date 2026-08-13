export type ContactEntry = {
  id: string
  label: string
  value: string
}

export type MemberProfile = {
  familyId: string
  memberId: string
  phones: ContactEntry[]
  emails: ContactEntry[]
  addresses: ContactEntry[]
  updatedAt: string | null
}

export type MemberProfileInput = Pick<MemberProfile, 'phones' | 'emails' | 'addresses'>

export function createEmptyMemberProfile(familyId: string, memberId: string): MemberProfile {
  return {
    familyId,
    memberId,
    phones: [],
    emails: [],
    addresses: [],
    updatedAt: null,
  }
}
