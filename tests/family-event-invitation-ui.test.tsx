// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FamilyEventInvitationCard from '../src/components/FamilyEventInvitationCard'
import NoticeboardPostEditor from '../src/components/NoticeboardPostEditor'
import type { FamilyEvent } from '../shared/familyEvents'
import type { NoticeboardPost } from '../shared/noticeboard'

const auth = vi.hoisted(() => ({ currentUser: { id: 'anette', displayName: 'Anette' }, expireSession: vi.fn() }))
vi.mock('../src/auth', () => ({ useAuth: () => auth }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const event: FamilyEvent = {
  id: '123e4567-e89b-42d3-a456-426614174000', ownerId: 'mads', eventType: 'family-dinner', title: 'Søndagsmiddag',
  startDate: '2026-10-18', endDate: null, startTime: '16:00', endTime: '19:00', location: 'Skogveien 1',
  wishlistUrl: '', moreInfo: '', createdAt: '', updatedAt: '',
}
const initialPost: NoticeboardPost = {
  id: '223e4567-e89b-42d3-a456-426614174000', ownerId: 'mads', type: 'Info', title: 'Min egen tittel',
  description: 'Ta med dessert!', eventId: event.id, status: 'open', createdAt: '', updatedAt: '',
}

function EditableInvitation() {
  const [post, setPost] = useState(initialPost)
  return <article><h1>{post.title}</h1><p className="post-text">{post.description}</p>
    <FamilyEventInvitationCard eventId={post.eventId!} />
    <NoticeboardPostEditor post={post} onUpdated={setPost} />
  </article>
}

describe('live invitation cards', () => {
  let root: ReturnType<typeof createRoot> | undefined

  afterEach(() => {
    act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
    auth.currentUser = { id: 'anette', displayName: 'Anette' }
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  async function render({ rsvp = null, eventStatus = 200, rsvpStatus = 200, location = event.location, editable = false }: {
    rsvp?: unknown; eventStatus?: number; rsvpStatus?: number; location?: string; editable?: boolean
  } = {}) {
    let liveEvent = { ...event, location }
    const fetchMock = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
      if (String(url).includes('update-noticeboard-post')) {
        return new Response(JSON.stringify({ post: { ...initialPost, ...JSON.parse(String(options?.body)) } }))
      }
      const isRsvp = String(url).includes('family-event-rsvp')
      return new Response(JSON.stringify(isRsvp ? { event: liveEvent, rsvp } : { event: liveEvent }), { status: isRsvp ? rsvpStatus : eventStatus })
    })
    vi.stubGlobal('fetch', fetchMock)
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root?.render(<MemoryRouter>{editable ? <EditableInvitation /> : <FamilyEventInvitationCard eventId={event.id} />}</MemoryRouter>))
    return { container, fetchMock, updateEvent: (changes: Partial<FamilyEvent>) => { liveEvent = { ...liveEvent, ...changes } } }
  }

  it('reads current event data and links directly to the existing RSVP page', async () => {
    const { container, fetchMock } = await render()
    expect(container.querySelector('h3')?.textContent).toBe('Søndagsmiddag')
    expect(container.textContent).toContain('Søndag 18. oktober 2026 · kl. 16:00–19:00')
    expect(container.textContent).toContain('Skogveien 1')
    const link = container.querySelector<HTMLAnchorElement>('a')!
    expect(link.textContent).toBe('Svar på invitasjon')
    expect(link.getAttribute('href')).toBe(`/booking/event/${event.id}/svar`)
    expect(fetchMock).toHaveBeenCalledWith(`/.netlify/functions/read-family-event?id=${event.id}`, expect.objectContaining({ credentials: 'include', cache: 'no-store' }))
  })

  it('shows Endre svar for a saved Ingen kommer response', async () => {
    const { container } = await render({ rsvp: { nobodyAttending: true, memberIds: [], guestNames: [] } })
    expect(container.querySelector('a')?.textContent).toBe('Endre svar')
  })

  it('omits the location when none is provided', async () => {
    const { container } = await render({ location: '' })
    expect(container.querySelector('.family-event-invitation__location')).toBeNull()
  })

  it('includes weekdays on both dates for multi-day events and omits kl. without a time', async () => {
    const { container, updateEvent } = await render()
    updateEvent({ startDate: '2026-10-04', endDate: '2026-10-05', startTime: '', endTime: '' })
    await act(async () => window.dispatchEvent(new Event('focus')))
    expect(container.textContent).toContain('Søndag 4. oktober 2026–Mandag 5. oktober 2026')
    expect(container.textContent).not.toContain('kl.')
  })

  it('formats a single event time with the requested weekday and kl. prefix', async () => {
    const { container, updateEvent } = await render()
    updateEvent({ startDate: '2026-10-04', startTime: '18:00', endTime: '' })
    await act(async () => window.dispatchEvent(new Event('focus')))
    expect(container.textContent).toContain('Søndag 4. oktober 2026 · kl. 18:00')
  })

  it('shows the organizer the event rather than requesting an RSVP', async () => {
    auth.currentUser = { id: 'mads', displayName: 'Mads' }
    const { container, fetchMock } = await render()
    expect(container.querySelector('a')?.textContent).toBe('Se arrangement')
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('family-event-rsvp'))).toBe(false)
  })

  it('refreshes event edits without changing independently edited post content', async () => {
    const { container, updateEvent } = await render({ editable: true })
    updateEvent({ title: 'Lørdagsmiddag', startDate: '2026-10-24', startTime: '17:00', location: 'Hytta' })
    await act(async () => window.dispatchEvent(new Event('focus')))
    expect(container.querySelector('h3')?.textContent).toBe('Lørdagsmiddag')
    expect(container.textContent).toContain('Lørdag 24. oktober 2026 · kl. 17:00–19:00')
    expect(container.querySelector('.family-event-invitation__location')?.textContent).toBe('Hytta')
    expect(container.querySelector('h1')?.textContent).toBe(initialPost.title)
    expect(container.querySelector('.post-text')?.textContent).toBe(initialPost.description)
  })

  it('saves manual post edits independently while keeping the event card and ID', async () => {
    auth.currentUser = { id: 'mads', displayName: 'Mads' }
    const { container, fetchMock } = await render({ editable: true })
    act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Rediger innlegg')!.click())
    const input = container.querySelector<HTMLInputElement>('#post-edit-title')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Velkommen til middag!')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    const save = fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH')!
    expect(JSON.parse(String(save[1]?.body))).toEqual({ title: 'Velkommen til middag!', description: initialPost.description })
    expect(container.querySelector('h1')?.textContent).toBe('Velkommen til middag!')
    expect(container.querySelector('h3')?.textContent).toBe(event.title)
    expect(container.querySelector('a')?.getAttribute('href')).toBe(`/booking/event/${event.id}`)
  })

  it('keeps a deleted event invitation readable without an RSVP link', async () => {
    const { container } = await render({ eventStatus: 404, editable: true })
    expect(container.textContent).toContain('Arrangementet finnes ikke lenger.')
    expect(container.querySelector('h1')?.textContent).toBe(initialPost.title)
    expect(container.querySelector('a')).toBeNull()
  })

  it('shows a retryable event error', async () => {
    const { container } = await render({ eventStatus: 500 })
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Kunne ikke hente arrangementet.')
    expect(container.querySelector('button')?.textContent).toBe('Prøv igjen')
  })

  it('does not offer an incorrect RSVP action when loading the saved answer fails', async () => {
    const { container } = await render({ rsvpStatus: 500 })
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Kunne ikke hente svaret ditt.')
    expect(container.querySelector<HTMLButtonElement>('.primary-button')?.disabled).toBe(true)
    expect(container.querySelector('a')).toBeNull()
  })

  it.each([{ eventStatus: 401 }, { rsvpStatus: 401 }])('expires invalid sessions: %j', async (options) => {
    await render(options)
    expect(auth.expireSession).toHaveBeenCalledOnce()
  })
})
