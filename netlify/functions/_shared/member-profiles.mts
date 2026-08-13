import { getStore } from '@netlify/blobs'
import { createEmptyMemberProfile, type MemberProfile } from '../../../shared/memberProfiles.ts'

const storeName = 'family-member-profiles'

function getProfileStore() {
  return getStore(storeName)
}

function profileKey(familyId: string, memberId: string) {
  return `${familyId}/${memberId}`
}

export async function readMemberProfile(familyId: string, memberId: string): Promise<MemberProfile> {
  const profile = await getProfileStore().get(profileKey(familyId, memberId), { type: 'json' }) as MemberProfile | null
  return profile ?? createEmptyMemberProfile(familyId, memberId)
}

export async function saveMemberProfile(profile: MemberProfile) {
  const hasContactInformation = profile.phones.length > 0 || profile.emails.length > 0 || profile.addresses.length > 0
  const key = profileKey(profile.familyId, profile.memberId)

  if (!hasContactInformation) {
    await getProfileStore().delete(key)
    return
  }

  await getProfileStore().setJSON(key, profile)
}
