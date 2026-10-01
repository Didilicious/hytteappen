// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NewFamilyEventPage from '../src/pages/NewFamilyEventPage'
import type { FamilyEventFormValues } from '../src/components/FamilyEventForm'

vi.mock('../src/auth', () => ({ useAuth: () => ({ currentUser: { id: 'mads', displayName: 'Mads' }, expireSession: vi.fn() }) }))
vi.mock('../src/components/FamilyEventForm', () => ({ default: ({ allowInvitation, onSubmit }: {
  allowInvitation?: boolean; onSubmit: (values: FamilyEventFormValues) => Promise<string | void>
}) => <button type="button" onClick={() => void onSubmit({
  eventType: 'family-dinner', title: 'Familiemiddag', startDate: '2026-10-18', endDate: null,
  startTime: '', endTime: '', location: '', wishlistUrl: '', moreInfo: '', createInvitation: true,
})}>{allowInvitation ? 'Opprett med invitasjon' : 'Opprett'}</button> }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Location() {
  const location = useLocation()
  return <output>{location.pathname}</output>
}

describe('invitation creation navigation', () => {
  let root: ReturnType<typeof createRoot> | undefined
  afterEach(() => {
    act(() => root?.unmount())
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('enables the option and returns to the calendar after creation, not Oppslagstavle', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ event: { id: 'event' } }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    const content: ReactNode = <><NewFamilyEventPage /><Location /></>
    await act(async () => root?.render(<MemoryRouter initialEntries={['/booking/new/event']}>{content}</MemoryRouter>))
    expect(container.querySelector('button')?.textContent).toBe('Opprett med invitasjon')
    await act(async () => container.querySelector('button')!.click())
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).createInvitation).toBe(true)
    expect(container.querySelector('output')?.textContent).toBe('/booking/calendar')
  })
})
