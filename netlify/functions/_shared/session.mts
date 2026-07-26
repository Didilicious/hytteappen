import { createHmac, timingSafeEqual } from 'node:crypto'

export type FamilyMember = {
  id: string
  displayName: string
}

type SessionPayload = {
  accountId: string
  expiresAt: number
}

export function getFamilyMember(accountId: unknown): FamilyMember | null {
  if (typeof accountId !== 'string') return null

  const familyMembers: Record<string, FamilyMember> = {
    'anne-jan': { id: 'anne-jan', displayName: 'Anne Marie & Jan' },
    christine: { id: 'christine', displayName: 'Christine' },
    anette: { id: 'anette', displayName: 'Anette' },
    mads: { id: 'mads', displayName: 'Mads' },
    heidi: { id: 'heidi', displayName: 'Heidi' },
  }

  return familyMembers[accountId] ?? null
}

export function getRequiredSecret(name: 'FAMILY_PASSWORD' | 'SESSION_SECRET') {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export function secretsMatch(providedValue: unknown, expectedValue: string) {
  if (typeof providedValue !== 'string') return false

  const provided = Buffer.from(providedValue)
  const expected = Buffer.from(expectedValue)

  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

function signValue(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

export function createSessionToken(accountId: string, secret: string) {
  const payload: SessionPayload = {
    accountId,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedPayload}.${signValue(encodedPayload, secret)}`
}

export function readSessionToken(token: string | undefined, secret: string): FamilyMember | null {
  if (!token) return null

  const [encodedPayload, signature, ...extraParts] = token.split('.')
  if (!encodedPayload || !signature || extraParts.length > 0) return null

  const expectedSignature = signValue(encodedPayload, secret)
  if (!secretsMatch(signature, expectedSignature)) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<SessionPayload>
    if (typeof payload.expiresAt !== 'number' || payload.expiresAt <= Date.now()) return null
    return getFamilyMember(payload.accountId)
  } catch {
    return null
  }
}

export function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return undefined

  for (const cookie of cookieHeader.split(';')) {
    const [cookieName, ...valueParts] = cookie.trim().split('=')
    if (cookieName === name) return valueParts.join('=')
  }

  return undefined
}

export function getAuthenticatedFamilyMember(request: Request) {
  const sessionSecret = getRequiredSecret('SESSION_SECRET')
  const token = readCookie(request, getSessionCookieName())
  return readSessionToken(token, sessionSecret)
}

export function getSessionCookieName() {
  return 'hytteguiden_session'
}

export function createSessionCookie(request: Request, token: string) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${getSessionCookieName()}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${secure}`
}

export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${getSessionCookieName()}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`
}

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(body), { ...init, headers })
}
