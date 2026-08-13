// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bookingIconNames, currentBookingIconNames } from '../src/bookingIcons'
import BookingLandingPage from '../src/pages/BookingLandingPage'

const loadHomeIconsMock = vi.hoisted(() => vi.fn())

vi.mock('../src/guideImages', () => ({
  loadHomeIcons: loadHomeIconsMock,
}));

vi.mock('../src/auth', () => ({
  useAuth: () => ({
    currentUser: { id: 'anette', displayName: 'Anette' },
    logout: vi.fn(),
  }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function LocationPath() {
  return <span data-testid="location">{useLocation().pathname}</span>
}

function findButton(container: HTMLElement, label: string) {
  return [...container.querySelectorAll('button')].find((button) => button.textContent?.includes(label))
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('booking landing page Drive icons', () => {
  let root: ReturnType<typeof createRoot> | undefined

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
    loadHomeIconsMock.mockReset()
    vi.restoreAllMocks()
  })

  async function renderBookingLanding() {
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={['/booking']}>
          <Routes>
            <Route path="*" element={<><BookingLandingPage /><LocationPath /></>} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await flushEffects()
    return container
  }

  it('loads the exact booking icon mappings and displays each only on its matching action', async () => {
    loadHomeIconsMock.mockResolvedValue(Object.fromEntries(currentBookingIconNames.map((name) => [name, {
      name: `${name}.webp`,
      src: `https://drive.example/${name}`,
    }])))

    const container = await renderBookingLanding()

    expect(loadHomeIconsMock).toHaveBeenCalledTimes(1)
    expect(loadHomeIconsMock).toHaveBeenCalledWith(currentBookingIconNames)
    expect(findButton(container, 'Se hyttekalender')?.querySelector('img')?.src).toContain(bookingIconNames.calendar)
    expect(findButton(container, 'Registrer ny tid')?.querySelector('img')?.src).toContain(bookingIconNames.newBooking)
    expect(findButton(container, 'Rediger dine tider')?.querySelector('img')?.src).toContain(bookingIconNames.editBookings)

    expect(findButton(container, 'Se hyttekalender')?.querySelector('img')?.src).not.toContain(bookingIconNames.newBooking)
    expect(findButton(container, 'Se hyttekalender')?.querySelector('img')?.src).not.toContain(bookingIconNames.editBookings)
    expect(findButton(container, 'Registrer ny tid')?.querySelector('img')?.src).not.toContain(bookingIconNames.calendar)
    expect(findButton(container, 'Registrer ny tid')?.querySelector('img')?.src).not.toContain(bookingIconNames.editBookings)
    expect(findButton(container, 'Rediger dine tider')?.querySelector('img')?.src).not.toContain(bookingIconNames.calendar)
    expect(findButton(container, 'Rediger dine tider')?.querySelector('img')?.src).not.toContain(bookingIconNames.newBooking)
  })

  it('keeps all reserved icon areas empty while Drive icons are loading', async () => {
    loadHomeIconsMock.mockReturnValue(new Promise(() => undefined))

    const container = await renderBookingLanding()
    const iconAreas = container.querySelectorAll('.task-button__icon')

    expect(iconAreas).toHaveLength(currentBookingIconNames.length)
    iconAreas.forEach((iconArea) => expect(iconArea.querySelector('img, svg')).toBeNull())
  })

  it('keeps icon areas empty when Drive icons are missing or fail to load', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    loadHomeIconsMock.mockResolvedValue({
      [bookingIconNames.calendar]: null,
      [bookingIconNames.newBooking]: {
        name: `${bookingIconNames.newBooking}.png`,
        src: `https://drive.example/${bookingIconNames.newBooking}`,
      },
      [bookingIconNames.editBookings]: null,
    })

    const container = await renderBookingLanding()
    const newBookingImage = findButton(container, 'Registrer ny tid')?.querySelector('img')

    act(() => newBookingImage?.dispatchEvent(new Event('error')))

    container.querySelectorAll('.task-button__icon').forEach((iconArea) => {
      expect(iconArea.querySelector('img, svg')).toBeNull()
    })
  })

  it.each([
    ['Se hyttekalender', '/booking/calendar'],
    ['Registrer ny tid', '/booking/new'],
    ['Rediger dine tider', '/booking/edit'],
  ])('keeps %s navigation unchanged', async (label, expectedPath) => {
    loadHomeIconsMock.mockResolvedValue({})
    const container = await renderBookingLanding()

    act(() => findButton(container, label)?.click())

    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(expectedPath)
  })
})
