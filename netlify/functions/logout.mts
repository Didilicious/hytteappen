import { clearSessionCookie, jsonResponse } from './_shared/session.mts'

export default async function logout(request: Request) {
  if (request.method !== 'POST') {
    return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
  }

  return jsonResponse(
    { ok: true },
    { status: 200, headers: { 'Set-Cookie': clearSessionCookie(request) } },
  )
}
