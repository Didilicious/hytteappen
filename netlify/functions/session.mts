import {
  clearSessionCookie,
  getRequiredSecret,
  getSessionCookieName,
  jsonResponse,
  readCookie,
  readSessionToken,
} from './_shared/session.mts'

export default async function session(request: Request) {
  if (request.method !== 'GET') {
    return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
  }

  try {
    const sessionSecret = getRequiredSecret('SESSION_SECRET')
    const token = readCookie(request, getSessionCookieName())
    const familyMember = readSessionToken(token, sessionSecret)

    if (!familyMember) {
      return jsonResponse(
        { message: 'Ingen gyldig økt.' },
        { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
      )
    }

    return jsonResponse({ user: familyMember })
  } catch {
    return jsonResponse({ message: 'Kunne ikke kontrollere økten.' }, { status: 500 })
  }
}
