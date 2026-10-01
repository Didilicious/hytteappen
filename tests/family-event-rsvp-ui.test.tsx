// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getFamily } from '../shared/families'
import { getFamilyEventAttendance, type FamilyEventRsvp } from '../shared/familyEventRsvps'
import FamilyEventDetailsPage from '../src/pages/FamilyEventDetailsPage'
import FamilyEventRsvpPage from '../src/pages/FamilyEventRsvpPage'

const auth = vi.hoisted(() => ({ currentUser: { id: 'anette', displayName: 'Anette' }, expireSession: vi.fn() }))
vi.mock('../src/auth', () => ({ useAuth: () => auth }))
vi.mock('../src/components/AppFrame', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
vi.mock('../src/guideImages', () => ({ loadHomeIcons: vi.fn(async () => ({})) }))
vi.mock('../src/components/DriveIcon', () => ({ default: () => null, warnAboutMissingDriveIcons: vi.fn() }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const eventId = '123e4567-e89b-42d3-a456-426614174000'
const eventPath = `/booking/event/${eventId}`
const familyEvent = {
  id: eventId, ownerId: 'mads', eventType: 'family-dinner', title: 'Søndagsmiddag',
  startDate: '2026-10-18', endDate: null, startTime: '16:00', endTime: '19:00',
  location: 'Skogveien 1', wishlistUrl: '', moreInfo: '',
  createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T08:00:00.000Z',
}
const savedRsvp: FamilyEventRsvp = {
  eventId, familyId: 'anette', memberIds: ['trond'], guestNames: ['Ingrid', 'Sindre'], nobodyAttending: false,
  createdAt: '2026-10-01T09:00:00.000Z', updatedAt: '2026-10-01T09:00:00.000Z',
}

function LocationDisplay() {
  const location = useLocation()
  return <output>{location.pathname}</output>
}

describe('family event invitation response', () => {
  let root: ReturnType<typeof createRoot> | undefined

  afterEach(() => {
    act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
    auth.currentUser = { id: 'anette', displayName: 'Anette' }
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  async function renderPage({ rsvp = null, details = false, ownerId = 'mads', loadStatus = 200, saveStatus = 200 }: {
    rsvp?: FamilyEventRsvp | null; details?: boolean; ownerId?: string; loadStatus?: number; saveStatus?: number
  } = {}) {
    let persisted = rsvp
    const fetchMock = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
      if (String(url).includes('family-event-rsvp')) {
        if (options?.method === 'PUT') {
          if (saveStatus !== 200) return new Response(JSON.stringify({ message: 'Kunne ikke lagre svaret.' }), { status: saveStatus })
          persisted = { ...JSON.parse(String(options.body)), eventId, familyId: auth.currentUser.id, createdAt: persisted?.createdAt ?? savedRsvp.createdAt, updatedAt: '2026-10-01T10:00:00.000Z' }
        }
        return new Response(JSON.stringify({ event: { ...familyEvent, ownerId }, rsvp: persisted, attendance: getFamilyEventAttendance(eventId, persisted ? [persisted] : []) }), { status: loadStatus })
      }
      return new Response(JSON.stringify({ event: { ...familyEvent, ownerId }, attendance: getFamilyEventAttendance(eventId, persisted ? [persisted] : []) }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root?.render(<MemoryRouter initialEntries={[details ? eventPath : `${eventPath}/svar`]}>
      <LocationDisplay />
      <Routes>
        <Route path="/booking/event/:eventId" element={<FamilyEventDetailsPage />} />
        <Route path="/booking/event/:eventId/svar" element={<FamilyEventRsvpPage />} />
      </Routes>
    </MemoryRouter>))
    return { container, fetchMock }
  }

  function checkbox(container: Element, label: string) {
    const target = [...container.querySelectorAll('label.checkbox-field')].find((element) => element.textContent === label)
    expect(target).toBeDefined()
    return target!.querySelector('input') as HTMLInputElement
  }

  function button(container: Element, label: string) {
    const target = [...container.querySelectorAll('button')].find((element) => element.textContent === label)
    expect(target).toBeDefined()
    return target as HTMLButtonElement
  }

  function addGuest(container: Element) {
    const available = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((input) => input.parentElement?.textContent === 'Andre' && !input.checked)
    expect(available).toBeDefined()
    act(() => available!.click())
  }

  function enterName(input: HTMLInputElement, name: string) {
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, name)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it.each(['anette', 'christine', 'heidi'])('shows every member of %s unchecked, with event information', async (familyId) => {
    auth.currentUser = { id: familyId, displayName: getFamily(familyId)!.displayName }
    const { container } = await renderPage()
    expect(container.querySelector('h1')?.textContent).toBe('Søndagsmiddag')
    expect(container.textContent).toContain('Skogveien 1')
    expect(container.textContent).toContain('16:00')
    expect(container.textContent).toContain('19:00')
    expect(container.textContent).toContain('18.')
    expect(container.querySelector('legend')?.textContent).toBe('Hvem kommer?')
    for (const member of getFamily(familyId)!.members) expect(checkbox(container, member.displayName).checked).toBe(false)
    expect(container.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(0)
    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(0)
  })

  it('clears selected members and guests for Ingen kommer, and selecting a member clears it', async () => {
    const { container } = await renderPage()
    act(() => checkbox(container, 'Anette').click())
    addGuest(container)
    act(() => checkbox(container, 'Ingen kommer').click())
    expect(checkbox(container, 'Anette').checked).toBe(false)
    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(0)
    expect(checkbox(container, 'Ingen kommer').checked).toBe(true)
    act(() => checkbox(container, 'Trond').click())
    expect(checkbox(container, 'Ingen kommer').checked).toBe(false)
    expect(checkbox(container, 'Trond').checked).toBe(true)
  })

  it('allows multiple Andre entries, excludes blanks, saves and returns to Endre svar', async () => {
    const { container, fetchMock } = await renderPage()
    act(() => checkbox(container, 'Anette').click())
    addGuest(container)
    enterName(container.querySelector('input[type="text"]')!, ' Ingrid ')
    addGuest(container)
    enterName(container.querySelectorAll<HTMLInputElement>('input[type="text"]')[1], 'Sindre')
    addGuest(container)
    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(3)
    await act(async () => button(container, 'Lagre svar').click())
    const save = fetchMock.mock.calls.find(([, options]) => options?.method === 'PUT')
    expect(JSON.parse(String(save?.[1]?.body))).toEqual({ memberIds: ['anette'], guestNames: ['Ingrid', 'Sindre'], nobodyAttending: false })
    expect(save?.[1]?.credentials).toBe('include')
    expect(container.querySelector('output')?.textContent).toBe(eventPath)
    expect(button(container, 'Endre svar').disabled).toBe(false)
    expect(container.textContent).toContain('Svaret er lagret.')
    await act(async () => button(container, 'Endre svar').click())
    expect(checkbox(container, 'Anette').checked).toBe(true)
    expect([...container.querySelectorAll<HTMLInputElement>('input[type="text"]')].map((input) => input.value)).toEqual(['Ingrid', 'Sindre'])
  })

  it('loads existing responses for editing and updates instead of resetting them', async () => {
    const { container, fetchMock } = await renderPage({ rsvp: savedRsvp })
    expect(container.querySelector('.eyebrow')?.textContent).toBe('Endre svar')
    expect(checkbox(container, 'Trond').checked).toBe(true)
    expect(checkbox(container, 'Anette').checked).toBe(false)
    expect([...container.querySelectorAll<HTMLInputElement>('input[type="text"]')].map((input) => input.value)).toEqual(['Ingrid', 'Sindre'])
    act(() => checkbox(container, 'Ingen kommer').click())
    await act(async () => button(container, 'Lagre svar').click())
    const save = fetchMock.mock.calls.find(([, options]) => options?.method === 'PUT')
    expect(JSON.parse(String(save?.[1]?.body))).toEqual({ memberIds: [], guestNames: [], nobodyAttending: true })
    await act(async () => button(container, 'Endre svar').click())
    expect(checkbox(container, 'Ingen kommer').checked).toBe(true)
    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(0)
  })

  it('clears Ingen kommer when adding a guest and supports removing a guest', async () => {
    const { container } = await renderPage()
    act(() => checkbox(container, 'Ingen kommer').click())
    addGuest(container)
    expect(checkbox(container, 'Ingen kommer').checked).toBe(false)
    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(1)
    act(() => checkbox(container, 'Andre').click())
    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(0)
  })

  it('does not save an unanswered form or blank-only guests', async () => {
    const { container, fetchMock } = await renderPage()
    await act(async () => button(container, 'Lagre svar').click())
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Velg hvem som kommer')
    addGuest(container)
    enterName(container.querySelector('input[type="text"]')!, '   ')
    await act(async () => button(container, 'Lagre svar').click())
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false)
  })

  it('keeps selections and shows an inline error when saving fails', async () => {
    const { container } = await renderPage({ saveStatus: 500 })
    act(() => checkbox(container, 'Anette').click())
    await act(async () => button(container, 'Lagre svar').click())
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Kunne ikke lagre svaret')
    expect(checkbox(container, 'Anette').checked).toBe(true)
    expect(button(container, 'Lagre svar').disabled).toBe(false)
    expect(container.querySelector('output')?.textContent).toBe(`${eventPath}/svar`)
  })

  it('shows Svar på invitasjon for another family and opens the dedicated page', async () => {
    const { container } = await renderPage({ details: true })
    await act(async () => button(container, 'Svar på invitasjon').click())
    expect(container.querySelector('output')?.textContent).toBe(`${eventPath}/svar`)
    expect(container.querySelector('legend')?.textContent).toBe('Hvem kommer?')
  })

  it('shows Endre svar even when the saved answer is Ingen kommer', async () => {
    const { container } = await renderPage({ details: true, rsvp: { ...savedRsvp, memberIds: [], guestNames: [], nobodyAttending: true } })
    expect(button(container, 'Endre svar').disabled).toBe(false)
  })

  it('does not show or request RSVP for the event owner', async () => {
    const { container, fetchMock } = await renderPage({ details: true, ownerId: 'anette' })
    expect(container.textContent).not.toContain('Svar på invitasjon')
    expect(container.textContent).not.toContain('Endre svar')
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('family-event-rsvp'))).toBe(false)
  })

  it.each([true, false])('shows all three person counts and opens each attendance list (details: %s)', async (details) => {
    const { container } = await renderPage({ details, rsvp: savedRsvp })
    const attendance = getFamilyEventAttendance(eventId, [savedRsvp])
    for (const [label, people] of [
      ['Kommer', attendance.attending], ['Kommer ikke', attendance.notAttending], ['Ikke svart', attendance.unanswered],
    ] as const) {
      act(() => button(container, `${label} · ${people.length}`).click())
      const dialog = container.querySelector('dialog')!
      expect(dialog.open).toBe(true)
      expect([...dialog.querySelectorAll('li')].map((entry) => entry.textContent)).toEqual(people.map((person) => person.displayName))
      await act(async () => button(dialog, 'Lukk').click())
      expect(container.querySelector('dialog')).toBeNull()
    }
  })

  it('shows saved attendance summaries below the RSVP form, not unsaved choices', async () => {
    const { container } = await renderPage({ rsvp: savedRsvp })
    const list = container.querySelector('section[aria-label="Deltakelse"]')!
    expect(container.querySelector('form')?.nextElementSibling).toBe(list)
    act(() => checkbox(container, 'Anette').click())
    act(() => button(list, 'Kommer · 3').click())
    const dialog = list.querySelector('dialog')!
    expect([...dialog.querySelectorAll('li')].map((entry) => entry.textContent)).toEqual(['Trond', 'Ingrid', 'Sindre'])
  })

  it.each([
    [403, 'Du kan ikke svare på ditt eget arrangement.'],
    [404, 'Arrangementet finnes ikke lenger.'],
    [500, 'Kunne ikke hente invitasjonen.'],
  ])('handles load status %s without displaying an editable form', async (loadStatus, message) => {
    const { container } = await renderPage({ loadStatus })
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(message)
    expect(container.querySelector('form')).toBeNull()
  })

  it('expires an invalid session instead of offering to save', async () => {
    const { container } = await renderPage({ loadStatus: 401 })
    expect(auth.expireSession).toHaveBeenCalledOnce()
    expect(container.querySelector('form')).toBeNull()
  })
})
