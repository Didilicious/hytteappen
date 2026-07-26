import {
  createSessionCookie,
  createSessionToken,
  getFamilyMember,
  getRequiredSecret,
  jsonResponse,
  secretsMatch,
} from './_shared/session.mts'

export default async function login(request: Request) {
  if (request.method !== 'POST') {
    return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
  }

  try {
    const body = await request.json() as { accountId?: unknown; password?: unknown }
    const familyMember = getFamilyMember(body.accountId)

    if (!familyMember) {
      return jsonResponse({ message: 'Ugyldig familiemedlem.' }, { status: 400 })
    }

    const familyPassword = getRequiredSecret('FAMILY_PASSWORD')
    if (!secretsMatch(body.password, familyPassword)) {
      return jsonResponse({ message: 'Feil passord. Prøv igjen.' }, { status: 401 })
    }

    const sessionSecret = getRequiredSecret('SESSION_SECRET')
    const token = createSessionToken(familyMember.id, sessionSecret)

    return jsonResponse(
      { user: familyMember },
      { status: 200, headers: { 'Set-Cookie': createSessionCookie(request, token) } },
    )
  } catch {
    return jsonResponse({ message: 'Kunne ikke logge inn. Prøv igjen.' }, { status: 500 })
  }
}
