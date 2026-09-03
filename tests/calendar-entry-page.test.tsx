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

  it('uses ISO week dates and finite 24-hour time controls', async () => {
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
            initialValues={{
              eventType: '',
              title: '',
              startDate: '2026-09-03',
              endDate: null,
              startTime: '',
              endTime: '',
              location: '',
              wishlistUrl: '',
              moreInfo: '',
            }}
            submitLabel="Lagre"
            submittingLabel="Lagrer …"
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
          />
        </MemoryRouter>,
      )
    })

    const addEndTimeButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent === '+ Legg til Slutt-tid')
    expect(addEndTimeButton).not.toBeUndefined()
    expect(container.textContent).toContain('Tidspunkt')
    expect(container.textContent).not.toContain('Starttid')
    expect(container.textContent).not.toContain('Sluttid')

    const dateTrigger = container.querySelector<HTMLButtonElement>('[aria-controls="event-start-date-picker"]')
    act(() => dateTrigger?.click())
    const calendar = container.querySelector('.date-picker__calendar')
    expect(calendar).not.toBeNull()
    expect([...calendar?.querySelectorAll('thead th') ?? []].map((heading) => heading.textContent)).toEqual([
      'Uke', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn',
    ])
    expect([...calendar?.querySelectorAll('.date-picker__week') ?? []].map((week) => week.textContent)).toContain('36')

    act(() => dateTrigger?.click())
    const timeTrigger = container.querySelector<HTMLButtonElement>('[aria-controls="event-start-time-picker"]')
    act(() => timeTrigger?.click())
    const hourButtons = [...container.querySelectorAll<HTMLButtonElement>('.time-picker__column[aria-label="Timer"] .time-picker__options button')]
    const minuteButtons = [...container.querySelectorAll<HTMLButtonElement>('.time-picker__column[aria-label="Minutter"] .time-picker__options button')]

    expect(hourButtons).toHaveLength(24)
    expect(hourButtons[0].textContent).toBe('00')
    expect(hourButtons.at(-1)?.textContent).toBe('23')
    expect(minuteButtons).toHaveLength(60)
    expect(minuteButtons[0].textContent).toBe('00')
    expect(minuteButtons.at(-1)?.textContent).toBe('59')
    expect(container.textContent).not.toMatch(/\b(?:AM|PM)\b/)

    act(() => hourButtons.at(-1)?.click())
    act(() => minuteButtons.at(-1)?.click())
    const doneButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === 'Ferdig')
    act(() => doneButton?.click())

    expect((container.querySelector('#event-start-time') as HTMLInputElement).value).toBe('23:59')
    expect(timeTrigger?.textContent).toContain('23:59')
    expect([...container.querySelectorAll('button')].find((button) => button.textContent === '+ Legg til Slutt-tid')).not.toBeUndefined()
  })
})
