// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import NotificationSettingsPage from '../src/pages/NotificationSettingsPage'
import { defaultNotificationPreferences } from '../shared/pushNotifications'
vi.mock('../src/components/AppFrame', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
let root: ReturnType<typeof createRoot>
afterEach(() => { act(() => root?.unmount()); vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = '' })
it('requests permission only on enable and registers the current device', async () => {
  const requestPermission = vi.fn().mockResolvedValue('granted')
  vi.stubGlobal('Notification', { permission: 'default', requestPermission })
  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal('isSecureContext', true)
  const subscription = { toJSON: () => ({ endpoint: 'https://web.push.apple.com/device' }) }
  const subscribe = vi.fn().mockResolvedValue(subscription)
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {
    getRegistration: vi.fn().mockResolvedValue({ active: {}, pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe } }),
  } })
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ publicKey: 'AQID', preferences: defaultNotificationPreferences })).mockResolvedValue(Response.json({ ok: true }))
  vi.stubGlobal('fetch', fetchMock)
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>))
  expect(requestPermission).not.toHaveBeenCalled()
  const button = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Aktiver varsler')!
  expect(button.disabled).toBe(false)
  await act(async () => button.click())
  expect(requestPermission).toHaveBeenCalledOnce()
  expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }))
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).action).toBe('enable')
  expect(container.textContent).toContain('Varsler er aktivert på denne enheten.')
})
