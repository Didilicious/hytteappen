import type { Config } from '@netlify/functions'
import { getFamily } from '../../shared/families.ts'
import { readMemberProfile } from './_shared/member-profiles.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type ReadFamilyProfileDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  loadMemberProfile: typeof readMemberProfile
}

export function createReadFamilyProfileFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadMemberProfile = readMemberProfile,
}: Partial<ReadFamilyProfileDependencies> = {}) {
  return async function readFamilyProfileFunction(request: Request) {
    if (request.method !== 'GET') {
      return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
    }

    try {
      if (!authenticate(request)) {
        return jsonResponse(
          { message: 'Økten har utløpt. Logg inn på nytt.' },
          { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
        )
      }

      const family = getFamily(new URL(request.url).searchParams.get('familyId'))
      if (!family) {
        return jsonResponse({ message: 'Familien finnes ikke.' }, { status: 404 })
      }

      const profiles = await Promise.all(
        family.members.map((member) => loadMemberProfile(family.accountId, member.id)),
      )

      return jsonResponse({ profiles })
    } catch {
      return jsonResponse({ message: 'Kunne ikke hente kontaktinformasjonen.' }, { status: 500 })
    }
  }
}

export default createReadFamilyProfileFunction()

export const config: Config = {
  method: 'GET',
}
