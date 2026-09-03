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
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('read-bookings')) return Promise.resolve(new Response(JSON.stringify({ bookings }), { status: 200 }))
      if (url.includes('read-family-events')) return Promise.resolve(new Response(JSON.stringify({ events: [] }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify({ iconsByName: {} }), { status: 200 }))
    }))
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
    const portraits = [...birthdayButton!.querySelectorAll<HTMLImageElement>('.calendar-birthday-portrait img')]
    expect(portraits).toHaveLength(2)
    expect(portraits.map((portrait) => {
      const url = new URL(portrait.src)
      return [url.searchParams.get('familyId'), url.searchParams.get('memberId')]
    })).toEqual([
      ['christine', 'othelie'],
      ['christine', 'emilie'],
    ])

    await act(async () => birthdayButton?.click())

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.querySelector('h2')?.textContent).toBe('Bursdager')
    expect(dialog?.textContent).toContain('Othelies bursdag')
    expect(dialog?.textContent).toContain('Emilies bursdag')
    const dialogPeople = [...dialog!.querySelectorAll<HTMLLIElement>('li')]
    expect(dialogPeople.map((person) => {
      const portrait = person.querySelector<HTMLImageElement>('.birthday-dialog__portrait img')
      const url = new URL(portrait!.src)
      return [person.textContent, url.searchParams.get('familyId'), url.searchParams.get('memberId')]
    })).toEqual([
      ['Othelies bursdag', 'christine', 'othelie'],
      ['Emilies bursdag', 'christine', 'emilie'],
    ])
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
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')
    const portrait = dialog?.querySelector<HTMLImageElement>('.birthday-dialog__portrait img')

    expect(dialog?.querySelector('h2')?.textContent).toBe('Heidis bursdag')
    expect(new URL(portrait!.src).searchParams.get('familyId')).toBe('heidi')
    expect(new URL(portrait!.src).searchParams.get('memberId')).toBe('heidi')
  })

  it('shows a birthday without creating any booking element', async () => {
    const container = await renderCalendar('/booking/calendar?month=2026-02')

    const birthdayButton = container.querySelector<HTMLButtonElement>('button[aria-label="Heidis bursdag"]')
    const portrait = birthdayButton?.querySelector<HTMLImageElement>('.calendar-birthday-portrait img')

    expect(birthdayButton).not.toBeNull()
    expect(new URL(portrait!.src).searchParams.get('familyId')).toBe('heidi')
    expect(new URL(portrait!.src).searchParams.get('memberId')).toBe('heidi')
    expect(container.querySelector('.calendar-booking')).toBeNull()
  })

  it('uses the individual placeholder when a birthday portrait is missing', async () => {
    const container = await renderCalendar('/booking/calendar?month=2026-03')
    const birthdayButton = container.querySelector<HTMLButtonElement>('button[aria-label="Auroras bursdag"]')
    const portrait = birthdayButton?.querySelector<HTMLImageElement>('.calendar-birthday-portrait img')

    expect(new URL(portrait!.src).searchParams.get('familyId')).toBe('heidi')
    expect(new URL(portrait!.src).searchParams.get('memberId')).toBe('aurora')

    await act(async () => portrait?.dispatchEvent(new Event('error')))

    expect(birthdayButton?.querySelector('.calendar-birthday-portrait img')).toBeNull()
    expect(birthdayButton?.querySelector('.profile-placeholder--member')).not.toBeNull()
    expect(birthdayButton?.querySelector('.calendar-birthday-indicator__cue')).not.toBeNull()
  })

  it('uses the member placeholder when the popup portrait is missing', async () => {
    const container = await renderCalendar('/booking/calendar?month=2026-03')
    const birthdayButton = container.querySelector<HTMLButtonElement>('button[aria-label="Auroras bursdag"]')

    await act(async () => birthdayButton?.click())

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')
    const portrait = dialog?.querySelector<HTMLImageElement>('.birthday-dialog__portrait img')
    const portraitUrl = new URL(portrait!.src)

    expect(portraitUrl.searchParams.get('familyId')).toBe('heidi')
    expect(portraitUrl.searchParams.get('memberId')).toBe('aurora')

    await act(async () => portrait?.dispatchEvent(new Event('error')))

    expect(dialog?.querySelector('.birthday-dialog__portrait img')).toBeNull()
    expect(dialog?.querySelector('.birthday-dialog__portrait .profile-placeholder--member')).not.toBeNull()
  })
})
