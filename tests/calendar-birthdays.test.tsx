// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BookingCalendarPage from '../src/pages/BookingCalendarPage'

const mockedAuth = vi.hoisted(() => ({
  currentUser: { id: 'anette', displayName: 'Anette' },
  expireSession: vi.fn(),
}))

vi.mock('../src/auth', () => ({
  useAuth: () => mockedAuth,
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const booking = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  ownerId: 'anette',
  fromDate: '2026-05-07',
  toDate: '2026-05-07',
  welcomesOthers: false,
  partialFamily: false,
  comment: '',
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
}

async function settle() {
  await act(async () => {
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('calendar birthdays', () => {
  let root: ReturnType<typeof createRoot> | undefined

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  async function renderCalendar(initialEntry: string, bookings: unknown[] = []) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ bookings }), { status: 200 })))
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() })
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/booking/calendar" element={<BookingCalendarPage />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await settle()
    return container
  }

  it('shows two birthdays and a booking together, then opens both names', async () => {
    const container = await renderCalendar('/booking/calendar?month=2026-05', [booking])
    const birthdayButton = container.querySelector<HTMLButtonElement>('button[aria-label="2 bursdager"]')
    const calendarDay = birthdayButton?.closest('.calendar-day')

    expect(birthdayButton).not.toBeNull()
    expect(calendarDay?.querySelector('.calendar-booking')).not.toBeNull()

    await act(async () => birthdayButton?.click())

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.querySelector('h2')?.textContent).toBe('Bursdager')
    expect(dialog?.textContent).toContain('Othelies bursdag')
    expect(dialog?.textContent).toContain('Emilies bursdag')
    expect(dialog?.querySelector<HTMLButtonElement>('.birthday-dialog__close')).toBe(document.activeElement)
  })

  it('shows a single recurring birthday after navigating to its month', async () => {
    const container = await renderCalendar('/booking/calendar?month=2027-01')

    expect(container.querySelector('button[aria-label="Heidis bursdag"]')).toBeNull()
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Neste måned"]')?.click()
    })
    await settle()

    const birthdayButton = container.querySelector<HTMLButtonElement>('button[aria-label="Heidis bursdag"]')
    expect(container.querySelector('#calendar-month-title')?.textContent).toContain('februar 2027')
    expect(birthdayButton).not.toBeNull()

    await act(async () => birthdayButton?.click())
    expect(container.querySelector('[role="dialog"] h2')?.textContent).toBe('Heidis bursdag')
  })

  it('shows a birthday without creating any booking element', async () => {
    const container = await renderCalendar('/booking/calendar?month=2026-02')

    expect(container.querySelector('button[aria-label="Heidis bursdag"]')).not.toBeNull()
    expect(container.querySelector('.calendar-booking')).toBeNull()
  })
})
