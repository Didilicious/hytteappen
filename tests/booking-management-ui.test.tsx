// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EditBookingPage from '../src/pages/EditBookingPage'
import EditBookingsPage from '../src/pages/EditBookingsPage'

const mockedAuth = vi.hoisted(() => ({
  currentUser: { id: 'anette', displayName: 'Anette' },
  expireSession: vi.fn(),
}))

vi.mock('../src/auth', () => ({
  useAuth: () => mockedAuth,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const bookingId = '123e4567-e89b-42d3-a456-426614174000'
const booking = {
  id: bookingId,
  ownerId: 'anette',
  fromDate: '2026-08-20',
  toDate: '2026-08-24',
  welcomesOthers: true,
  partialFamily: false,
  comment: 'Ta med sengetøy.',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('booking management pages', () => {
  let root: ReturnType<typeof createRoot> | undefined

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('loads an existing booking into the reused edit form', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ booking }), { status: 200 })))
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[`/booking/edit/${bookingId}`]}>
          <Routes>
            <Route path="/booking/edit/:bookingId" element={<EditBookingPage />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await flushEffects()

    expect((container.querySelector('#from-date') as HTMLInputElement).value).toBe('2026-08-20')
    expect((container.querySelector('#to-date') as HTMLInputElement).value).toBe('2026-08-24')
    expect((container.querySelector('[name="welcomeOthers"]') as HTMLInputElement).checked).toBe(true)
    expect((container.querySelector('#booking-comment') as HTMLTextAreaElement).value).toBe('Ta med sengetøy.')
    expect(container.textContent).toContain('Registreres for: Anette')
    expect(container.textContent).toContain('Lagre endringer')
    expect([...container.querySelectorAll('button')].some((button) => button.textContent?.includes('Tilbake'))).toBe(true)
  })

  it('requires confirmation before deleting a booking', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      return Promise.resolve(new Response(JSON.stringify(
        url.includes('read-own-family-events') ? { events: [] } : { bookings: [booking] },
      ), { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={['/booking/edit']}>
          <EditBookingsPage />
        </MemoryRouter>,
      )
    })
    await flushEffects()

    const deleteButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Slett')
    act(() => deleteButton?.click())

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull()
    expect(container.textContent).toContain('Slett registreringen?')
    expect(container.textContent).toContain('20. august – 24. august 2026')
    expect(container.textContent).toContain('Avbryt')
  })
})
