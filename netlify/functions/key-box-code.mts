import type { Config } from '@netlify/functions'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
} from './_shared/session.mts'

export default async function keyBoxCode(request: Request) {
  if (request.method !== 'GET') {
    return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
  }

  try {
    const familyMember = getAuthenticatedFamilyMember(request)

    if (!familyMember) {
      return jsonResponse(
        { message: 'Ingen gyldig økt.' },
        { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
      )
    }

    const code = Netlify.env.get('KEY_BOX_CODE')

    if (!code) {
      return jsonResponse({ message: 'Kunne ikke hente nøkkelbokskoden.' }, { status: 500 })
    }

    return jsonResponse({ code })
  } catch {
    return jsonResponse({ message: 'Kunne ikke hente nøkkelbokskoden.' }, { status: 500 })
  }
}

export const config: Config = {
  method: 'GET',
}
