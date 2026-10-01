// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BookingCalendarPage from '../src/pages/BookingCalendarPage'
import FamilyEventDetailsPage from '../src/pages/FamilyEventDetailsPage'
import EditFamilyEventPage from '../src/pages/EditFamilyEventPage'

const mockedAuth = vi.hoisted(() => ({
  currentUser: { id: 'anette', displayName: 'Anette' },
  expireSession: vi.fn(),
}))

vi.mock('../src/auth', () => ({ useAuth: () => mockedAuth }))
vi.mock('../src/guideImages', () => ({ loadHomeIcons: vi.fn(async () => ({})) }))
vi.mock('../src/components/DriveIcon', () => ({ default: () => null, warnAboutMissingDriveIcons: vi.fn() }))
vi.mock('../src/components/ProfileImage', () => ({ default: () => null }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const familyEvent = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  ownerId: 'anette',
  eventType: 'family-dinner',
  title: 'Søndagsmiddag',
  startDate: '2026-09-20',
  endDate: null,
  startTime: '16:00',
  endTime: '19:00',
  location: 'Skogveien 1',
  wishlistUrl: '',
  moreInfo: '',
  createdAt: '2026-09-03T10:00:00.000Z',
  updatedAt: '2026-09-03T10:00:00.000Z',
}

function LocationDisplay() {
  const location = useLocation()
  return <output>{location.pathname}{location.search}</output>
}

describe('family event details deletion', () => {
  let root: ReturnType<typeof createRoot> | undefined

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
    window.sessionStorage.clear()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  async function renderDetails({ ownerId = 'anette', deleteStatus = 204, fromCalendar = false, fromRegistrations = false } = {}) {
    let deleted = false
    const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (options?.method === 'DELETE') {
        deleted = deleteStatus === 204
        return new Response(deleted ? null : JSON.stringify({ message: 'Kunne ikke slette arrangementet.' }), { status: deleteStatus })
      }
      if (url.includes('read-family-events')) {
        return new Response(JSON.stringify({ events: deleted ? [] : [{ ...familyEvent, ownerId }] }), { status: 200 })
      }
      if (url.includes('read-bookings')) return new Response(JSON.stringify({ bookings: [] }), { status: 200 })
      return new Response(JSON.stringify({ event: { ...familyEvent, ownerId } }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[fromRegistrations ? `/booking/edit/event/${familyEvent.id}` : fromCalendar ? '/booking/calendar?month=2026-09' : {
          pathname: `/booking/event/${familyEvent.id}`,
          state: { calendarPath: '/booking/calendar?month=2026-09' },
        }]}>
          <LocationDisplay />
          <Routes>
            <Route path="/booking/event/:eventId" element={<FamilyEventDetailsPage />} />
            <Route path="/booking/edit/event/:eventId" element={<EditFamilyEventPage />} />
            <Route path="/booking/edit" element={<h1>Rediger dine registreringer</h1>} />
            <Route path="/booking/calendar" element={<BookingCalendarPage />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    return { container, fetchMock }
  }

  function button(container: Element, label: string) {
    const target = [...container.querySelectorAll('button')].find((entry) => entry.textContent === label)
    expect(target).toBeDefined()
    return target as HTMLButtonElement
  }

  it('shows delete next to edit only for the owning family', async () => {
    const { container } = await renderDetails()
    const actions = container.querySelector('.booking-edit-card__actions')
    expect(actions?.textContent).toBe('Rediger arrangementetSlett')
  })

  it.each(['Avbryt', 'Lagre endringer'])('returns to the previously viewed calendar month after %s', async (action) => {
    const { container, fetchMock } = await renderDetails({ fromCalendar: true })
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Se arrangementet Søndagsmiddag"]')!.click())
    await act(async () => button(container, 'Rediger arrangementet').click())
    expect(container.querySelector('output')?.textContent).toBe(`/booking/edit/event/${familyEvent.id}`)
    await act(async () => button(container, action).click())
    expect(container.querySelector('output')?.textContent).toBe('/booking/calendar?month=2026-09')
    expect(container.querySelector('.calendar-grid')).not.toBeNull()
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(action === 'Lagre endringer')
  })

  it.each(['Avbryt', 'Lagre endringer'])('returns to registrations after %s when editing from registrations', async (action) => {
    const { container } = await renderDetails({ fromRegistrations: true })
    await act(async () => button(container, action).click())
    expect(container.querySelector('output')?.textContent).toBe('/booking/edit')
    expect(container.querySelector('h1')?.textContent).toBe('Rediger dine registreringer')
  })

  it('hides both owner actions for another family', async () => {
    const { container } = await renderDetails({ ownerId: 'mads' })
    expect(container.querySelector('.booking-edit-card__actions')).toBeNull()
    expect(container.querySelector('.danger-button')).toBeNull()
  })

  it('asks for confirmation and does nothing when cancelled', async () => {
    const { container, fetchMock } = await renderDetails()
    act(() => button(container, 'Slett').click())
    expect(container.querySelector('[role="alertdialog"]')?.textContent).toContain('Er du sikker på at du vil slette dette arrangementet?')
    act(() => button(container, 'Avbryt').click())
    expect(container.querySelector('[role="alertdialog"]')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(container.querySelector('output')?.textContent).toBe(`/booking/event/${familyEvent.id}`)
  })

  it('reuses event deletion and immediately reloads the calendar without the deleted event', async () => {
    const { container, fetchMock } = await renderDetails({ fromCalendar: true })
    const eventButton = container.querySelector<HTMLButtonElement>('[aria-label="Se arrangementet Søndagsmiddag"]')
    expect(eventButton).not.toBeNull()
    await act(async () => eventButton?.click())
    act(() => button(container, 'Slett').click())
    const dialog = container.querySelector('[role="alertdialog"]') as Element
    await act(async () => button(dialog, 'Slett').click())
    expect(fetchMock).toHaveBeenCalledWith(`/.netlify/functions/delete-family-event?id=${familyEvent.id}`, {
      method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json' },
    })
    expect(container.querySelector('output')?.textContent).toBe('/booking/calendar?month=2026-09')
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('read-family-events'))).toHaveLength(2)
    expect(container.querySelector('.calendar-grid')).not.toBeNull()
    expect(container.querySelector('[aria-label="Se arrangementet Søndagsmiddag"]')).toBeNull()
  })

  it('keeps the details open and shows the error when deletion fails', async () => {
    const { container } = await renderDetails({ deleteStatus: 500 })
    act(() => button(container, 'Slett').click())
    const dialog = container.querySelector('[role="alertdialog"]') as Element
    await act(async () => button(dialog, 'Slett').click())
    expect(dialog.querySelector('[role="alert"]')?.textContent).toBe('Kunne ikke slette arrangementet.')
    expect(button(dialog, 'Slett').disabled).toBe(false)
    expect(container.querySelector('output')?.textContent).toBe(`/booking/event/${familyEvent.id}`)
  })

  it('expires the session when deletion is unauthorized', async () => {
    const { container } = await renderDetails({ deleteStatus: 401 })
    act(() => button(container, 'Slett').click())
    const dialog = container.querySelector('[role="alertdialog"]') as Element
    await act(async () => button(dialog, 'Slett').click())
    expect(mockedAuth.expireSession).toHaveBeenCalledOnce()
    expect(container.querySelector('output')?.textContent).toBe(`/booking/event/${familyEvent.id}`)
  })
})
