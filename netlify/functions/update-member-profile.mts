import type { Config } from '@netlify/functions'
import { getFamily } from '../../shared/families.ts'
import type { MemberProfile } from '../../shared/memberProfiles.ts'
import { validateMemberProfileInput } from './_shared/member-profile-input.mts'
import { saveMemberProfile } from './_shared/member-profiles.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type UpdateMemberProfileDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  saveProfile: typeof saveMemberProfile
  now: () => string
}

export function createUpdateMemberProfileFunction({
  authenticate = getAuthenticatedFamilyMember,
  saveProfile = saveMemberProfile,
  now = () => new Date().toISOString(),
}: Partial<UpdateMemberProfileDependencies> = {}) {
  return async function updateMemberProfileFunction(request: Request) {
    if (request.method !== 'PATCH') {
      return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
    }

    try {
      const authenticatedFamily = authenticate(request)
      if (!authenticatedFamily) {
        return jsonResponse(
          { message: 'Økten har utløpt. Logg inn på nytt.' },
          { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
        )
      }

      const url = new URL(request.url)
      const family = getFamily(url.searchParams.get('familyId'))
      const memberId = url.searchParams.get('memberId')
      if (!family || !memberId || !family.members.some((member) => member.id === memberId)) {
        return jsonResponse({ message: 'Familiemedlemmet finnes ikke.' }, { status: 404 })
      }

      if (authenticatedFamily.id !== family.accountId) {
        return jsonResponse({ message: 'Du kan bare redigere din egen familie.' }, { status: 403 })
      }

      const validation = validateMemberProfileInput(await request.json())
      if (!validation.ok) {
        return jsonResponse({ message: validation.message }, { status: 400 })
      }

      const profile: MemberProfile = {
        familyId: family.accountId,
        memberId,
        ...validation.value,
        updatedAt: now(),
      }

      await saveProfile(profile)
      return jsonResponse({ profile })
    } catch {
      return jsonResponse({ message: 'Kunne ikke lagre endringene. Prøv igjen.' }, { status: 500 })
    }
  }
}

export default createUpdateMemberProfileFunction()

export const config: Config = {
  method: 'PATCH',
}
