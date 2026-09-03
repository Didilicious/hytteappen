// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FamilyEventForm from '../src/components/FamilyEventForm'
import NewCalendarEntryPage from '../src/pages/NewCalendarEntryPage'

vi.mock('../src/auth', () => ({
  useAuth: () => ({ currentUser: { id: 'anette', displayName: 'Anette' }, logout: vi.fn() }),
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function LocationPath() {
  return <span data-testid="location">{useLocation().pathname}</span>
}

describe('calendar entry choice', () => {
  let root: ReturnType<typeof createRoot> | undefined

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
  })

  it('offers unchanged cabin booking and new family event paths', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={['/booking/new']}>
          <Routes><Route path="*" element={<><NewCalendarEntryPage /><LocationPath /></>} /></Routes>
        </MemoryRouter>,
      )
    })

    expect(container.textContent).toContain('Hva vil du registrere?')
    expect(container.textContent).not.toContain('Registrer tid på hytta som før.')
    expect(container.textContent).not.toContain('Legg til en aktivitet for hele familien.')
    expect(container.querySelector('.entry-type-card__icon')).toBeNull()
    const buttons = [...container.querySelectorAll('button')]
    act(() => buttons.find((button) => button.textContent?.includes('Hyttebooking'))?.click())
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/booking/new/booking')
  })

  it('shows back navigation and compact auto-growing event fields', async () => {
    const onCancel = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(
        <MemoryRouter>
          <FamilyEventForm
            title="Nytt familiearrangement"
            ownerId="anette"
            ownerName="Anette"
            submitLabel="Lagre"
            submittingLabel="Lagrer …"
            onSubmit={vi.fn()}
            onCancel={onCancel}
          />
        </MemoryRouter>,
      )
    })

    const backButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Tilbake'))
    const location = container.querySelector<HTMLTextAreaElement>('#event-location')
    const moreInfo = container.querySelector<HTMLTextAreaElement>('#event-more-info')

    expect(location?.getAttribute('rows')).toBe('1')
    expect(moreInfo?.getAttribute('rows')).toBe('2')
    expect(location?.classList.contains('auto-resize-textarea')).toBe(true)
    expect(moreInfo?.classList.contains('auto-resize-textarea')).toBe(true)
    act(() => backButton?.click())
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
