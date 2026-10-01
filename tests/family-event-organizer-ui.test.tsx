// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FamilyEventForm, { type FamilyEventFormValues } from '../src/components/FamilyEventForm'
import EditFamilyEventPage from '../src/pages/EditFamilyEventPage'
import { getFamily } from '../shared/families'

const auth = vi.hoisted(() => ({ currentUser: { id: 'mads', displayName: 'Mads' }, expireSession: vi.fn() }))
vi.mock('../src/auth', () => ({ useAuth: () => auth }))
vi.mock('../src/components/AppFrame', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const eventId = '123e4567-e89b-42d3-a456-426614174000'
const values: FamilyEventFormValues = {
  eventType: 'family-dinner', title: 'Familiemiddag', startDate: '2026-10-18',
  endDate: null, startTime: '', endTime: '', location: '', wishlistUrl: '', moreInfo: '',
}
const familyEvent = { ...values, id: eventId, ownerId: 'mads', createdAt: '', updatedAt: '' }

describe('organizer attendance controls', () => {
  let root: ReturnType<typeof createRoot> | undefined

  afterEach(() => {
    act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  async function render(content: ReactNode) {
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root?.render(<MemoryRouter initialEntries={[`/booking/edit/event/${eventId}`]}>{content}</MemoryRouter>))
    return container
  }

  function checkbox(container: Element, name: string) {
    return [...container.querySelectorAll('label.checkbox-field')].find((label) => label.textContent === name)!.querySelector<HTMLInputElement>('input')!
  }

  function form(onSubmit = vi.fn().mockResolvedValue(undefined), initialValues?: FamilyEventFormValues) {
    return <FamilyEventForm title="Nytt familiearrangement" ownerId="mads" ownerName="Mads"
      initialValues={initialValues} submitLabel="Lagre" submittingLabel="Lagrer …" onSubmit={onSubmit} onCancel={vi.fn()} />
  }

  it('shows every organizer family member unchecked for a new event', async () => {
    const container = await render(form())
    expect(container.querySelector('legend')?.textContent).toBe('Hvem fra din familie kommer?')
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(getFamily('mads')!.members.length)
    for (const member of getFamily('mads')!.members) expect(checkbox(container, member.displayName).checked).toBe(false)
    expect(container.textContent).not.toContain('Anette')
    expect(container.querySelector('#event-more-info')?.closest('.field-group')?.nextElementSibling).toBe(container.querySelector('fieldset'))
  })

  it('submits selected members and allows deselecting everyone', async () => {
    const onSubmit = vi.fn().mockResolvedValue('Kunne ikke lagre arrangementet.')
    const container = await render(form(onSubmit, values))
    act(() => checkbox(container, 'Mads').click())
    act(() => checkbox(container, 'Casper').click())
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(onSubmit).toHaveBeenLastCalledWith({ ...values, organizerMemberIds: ['mads', 'casper'] })
    expect(checkbox(container, 'Mads').checked).toBe(true)
    act(() => checkbox(container, 'Mads').click())
    act(() => checkbox(container, 'Casper').click())
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(onSubmit).toHaveBeenLastCalledWith({ ...values, organizerMemberIds: [] })
  })

  it('loads persisted organizer selections into editing and submits changes', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, options?: RequestInit) => new Response(JSON.stringify(
      options?.method === 'PATCH' ? { message: 'Kunne ikke lagre endringene.' }
        : { event: familyEvent, organizerRsvp: { memberIds: ['mads', 'casper'] } },
    ), { status: options?.method === 'PATCH' ? 500 : 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const container = await render(<Routes><Route path="/booking/edit/event/:eventId" element={<EditFamilyEventPage />} /></Routes>)
    expect(checkbox(container, 'Mads').checked).toBe(true)
    expect(checkbox(container, 'Casper').checked).toBe(true)
    expect(checkbox(container, 'Phillip').checked).toBe(false)
    expect(container.querySelector('#event-more-info')?.closest('.field-group')?.nextElementSibling).toBe(container.querySelector('fieldset'))
    act(() => checkbox(container, 'Mads').click())
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    const save = fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH')
    expect(JSON.parse(String(save?.[1]?.body)).organizerMemberIds).toEqual(['casper'])
    expect(checkbox(container, 'Casper').checked).toBe(true)
  })

  it('keeps legacy events without organizer responses unchecked when editing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ event: familyEvent, organizerRsvp: null }))))
    const container = await render(<Routes><Route path="/booking/edit/event/:eventId" element={<EditFamilyEventPage />} /></Routes>)
    expect([...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every((input) => !input.checked)).toBe(true)
  })
})
