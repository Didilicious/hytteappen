import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const mocks = vi.hoisted(() => ({ get: vi.fn(), setJSON: vi.fn(), delete: vi.fn(), send: vi.fn(), auth: vi.fn() }))
vi.mock('@netlify/blobs', () => ({ getStore: () => mocks }))
vi.mock('web-push', () => ({ default: { sendNotification: mocks.send } }))
vi.mock('../netlify/functions/_shared/session.mts', () => ({
  getAuthenticatedFamilyMember: mocks.auth,
  jsonResponse: (body: unknown, init?: ResponseInit) => Response.json(body, init),
}))
import handler from '../netlify/functions/push-notifications.mts'

const subscription = { endpoint: 'https://web.push.apple.com/device-secret', keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) } }
function request(action: string, extra: object = {}) {
  return new Request('https://app.test/.netlify/functions/push-notifications', {
    method: 'POST', headers: { Origin: 'https://app.test' }, body: JSON.stringify({ action, subscription, ...extra }),
  })
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockReturnValue({ id: 'family-a' })
  mocks.get.mockResolvedValue(null)
  vi.stubGlobal('Netlify', { env: { get: (key: string) => key === 'VAPID_SUBJECT' ? 'mailto:test@example.com' : 'test-key' } })
})

describe('push API', () => {
  it('requires an authenticated family', async () => {
    mocks.auth.mockReturnValue(null)
    expect((await handler(request('enable'))).status).toBe(401)
    expect(mocks.setJSON).not.toHaveBeenCalled()
  })
  it('uses the session family and a deterministic endpoint hash, ignoring client family IDs', async () => {
    await handler(request('enable', { familyId: 'attacker' }))
    await handler(request('enable'))
    expect(mocks.setJSON.mock.calls[0][0]).toMatch(/^devices\/[a-f0-9]{64}$/)
    expect(mocks.setJSON.mock.calls[0]).toEqual(mocks.setJSON.mock.calls[1])
    expect(mocks.setJSON.mock.calls[0][1].familyId).toBe('family-a')
  })
  it.each(['disable', 'test', 'enable'])('rejects %s for another family device', async (action) => {
    mocks.get.mockResolvedValue({ familyId: 'family-b', subscription })
    expect((await handler(request(action))).status).toBe(409)
    expect(mocks.send).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.setJSON).not.toHaveBeenCalled()
  })
  it('does not send to arbitrary endpoints', async () => {
    expect((await handler(request('enable', { subscription: { ...subscription, endpoint: 'https://127.0.0.1/private' } }))).status).toBe(400)
    expect(mocks.setJSON).not.toHaveBeenCalled()
  })
  it('deletes only the expired device', async () => {
    mocks.get.mockResolvedValue({ familyId: 'family-a', subscription })
    mocks.send.mockRejectedValue({ statusCode: 410 })
    expect((await handler(request('test'))).status).toBe(410)
    expect(mocks.delete).toHaveBeenCalledOnce()
    expect(mocks.delete.mock.calls[0][0]).toMatch(/^devices\//)
  })
  it('sends test notifications only to the stored current device', async () => {
    mocks.get.mockResolvedValue({ familyId: 'family-a', subscription })
    expect((await handler(request('test'))).status).toBe(200)
    expect(mocks.send.mock.calls[0][0]).toEqual(subscription)
    expect(JSON.parse(mocks.send.mock.calls[0][1]).url).toBe('/innstillinger/varsler')
  })
  it('persists preferences for the authenticated family', async () => {
    const preferences = { familyEvent: false, noticeboardPost: true, ownPostComment: true, invitationReminder: false, changesAndCancellations: true }
    expect((await handler(request('preferences', { preferences, familyId: 'other' }))).status).toBe(200)
    expect(mocks.setJSON).toHaveBeenCalledWith('preferences/family-a', preferences)
  })
  it('defaults all preferences to enabled', async () => {
    const response = await handler(new Request('https://app.test/.netlify/functions/push-notifications'))
    const data = await response.json()
    expect(Object.values(data.preferences)).toEqual([true, true, true, true, true])
    expect(data).not.toHaveProperty('privateKey')
  })
  it('rejects cross-origin mutations', async () => {
    const req = request('enable')
    req.headers.set('Origin', 'https://other.test')
    expect((await handler(req)).status).toBe(403)
  })
})

describe('worker push handling', () => {
  function worker() {
    const listeners: Record<string, Function> = {}
    const client = { url: 'https://app.test/', navigate: vi.fn(), focus: vi.fn() }
    const self = {
      location: { origin: 'https://app.test' },
      addEventListener: (name: string, callback: Function) => { listeners[name] = callback },
      registration: { showNotification: vi.fn() },
      clients: { matchAll: vi.fn().mockResolvedValue([client]), openWindow: vi.fn() },
    }
    runInNewContext(readFileSync(new URL('../pwa/service-worker.js', import.meta.url), 'utf8').replace('__SHELL_URLS__', '[]'), { self, URL, Set })
    return { self, listeners, client }
  }
  it('displays a push notification', async () => {
    const { listeners, self } = worker()
    const waitUntil = vi.fn()
    listeners.push({ data: { json: () => ({ title: 'Hytteappen', body: 'Test', url: '/' }) }, waitUntil })
    await waitUntil.mock.calls[0][0]
    expect(self.registration.showNotification).toHaveBeenCalledWith('Hytteappen', expect.objectContaining({ body: 'Test' }))
  })
  it('focuses an existing window and prevents external navigation', async () => {
    const { listeners, client } = worker()
    const waitUntil = vi.fn()
    listeners.notificationclick({ notification: { close: vi.fn(), data: { url: 'https://other.test/' } }, waitUntil })
    await waitUntil.mock.calls[0][0]
    expect(client.navigate).toHaveBeenCalledWith('https://app.test/')
    expect(client.focus).toHaveBeenCalledOnce()
  })
})
