// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HomePage from '../src/pages/HomePage'
import { currentHomeIconNames, homeIconNames } from '../src/homeIcons'

const loadHomeIconsMock = vi.hoisted(() => vi.fn())
const loadNoticeboardUnseenCountMock = vi.hoisted(() => vi.fn())

vi.mock('../src/guideImages', () => ({
  loadHomeIcons: loadHomeIconsMock,
}));

vi.mock('../src/noticeboard', () => ({
  loadNoticeboardUnseenCount: loadNoticeboardUnseenCountMock,
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

describe('home page Drive icons', () => {
  let root: ReturnType<typeof createRoot> | undefined

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
    loadHomeIconsMock.mockReset()
    loadNoticeboardUnseenCountMock.mockReset()
    vi.restoreAllMocks()
  })

  async function renderHome() {
    if (!loadNoticeboardUnseenCountMock.getMockImplementation()) {
      loadNoticeboardUnseenCountMock.mockResolvedValue(0)
    }
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="*" element={<><HomePage /><LocationPath /></>} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await flushEffects()
    return container
  }

  it('loads all current icon mappings in one request and displays the matching Drive images', async () => {
    loadHomeIconsMock.mockResolvedValue(Object.fromEntries(currentHomeIconNames.map((name) => [name, {
      name: `${name}.png`,
      src: `https://drive.example/${name}`,
    }])))

    const container = await renderHome()

    expect(loadHomeIconsMock).toHaveBeenCalledTimes(1)
    expect(loadHomeIconsMock).toHaveBeenCalledWith(currentHomeIconNames)
    expect(findButton(container, 'Åpne hytte')?.querySelector('img')?.src).toContain(homeIconNames.openCabin)
    expect(findButton(container, 'Stenge hytte')?.querySelector('img')?.src).toContain(homeIconNames.closeCabin)
    expect(findButton(container, 'Drift av hytte')?.querySelector('img')?.src).toContain(homeIconNames.operations)
    expect(findButton(container, 'Booke hyttetid')?.querySelector('img')?.src).toContain(homeIconNames.booking)
    expect(findButton(container, 'Oppslagstavle')?.querySelector('img')?.src).toContain(homeIconNames.noticeboard)
    expect(findButton(container, 'Familieoversikt')?.querySelector('img')?.src).toContain(homeIconNames.family)
    expect(findButton(container, 'Planlegge mat')?.querySelector('img')?.src).toContain(homeIconNames.food)
  })

  it('keeps the reserved icon areas empty while Drive icons are loading', async () => {
    loadHomeIconsMock.mockReturnValue(new Promise(() => undefined))

    const container = await renderHome()
    const iconAreas = container.querySelectorAll('.task-button__icon')

    expect(iconAreas).toHaveLength(currentHomeIconNames.length)
    iconAreas.forEach((iconArea) => expect(iconArea.querySelector('img')).toBeNull())
  })

  it('keeps the reserved icon areas empty when Drive icons are missing', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    loadHomeIconsMock.mockResolvedValue(Object.fromEntries(currentHomeIconNames.map((name) => [name, null])))

    const container = await renderHome()

    container.querySelectorAll('.task-button__icon').forEach((iconArea) => {
      expect(iconArea.querySelector('img')).toBeNull()
    })
    expect(warning).toHaveBeenCalledTimes(currentHomeIconNames.length)
    expect(warning.mock.calls.flat().join(' ')).toContain(homeIconNames.noticeboard)
    expect(warning.mock.calls.flat().join(' ')).toContain(homeIconNames.family)
  })

  it('keeps an icon area empty when its Drive image fails to load', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    loadHomeIconsMock.mockResolvedValue(Object.fromEntries(currentHomeIconNames.map((name) => [name, {
      name: `${name}.png`,
      src: `https://drive.example/${name}`,
    }])))

    const container = await renderHome()
    const openCabinIcon = findButton(container, 'Åpne hytte')?.querySelector('img')

    act(() => openCabinIcon?.dispatchEvent(new Event('error')))

    expect(findButton(container, 'Åpne hytte')?.querySelector('.task-button__icon img')).toBeNull()
    expect(warning).toHaveBeenCalledWith(expect.stringContaining(homeIconNames.openCabin))
  })

  it.each([
    ['Åpne hytte', '/guide/open-cabin/get-key'],
    ['Stenge hytte', '/guide/close-cabin/not-ready'],
    ['Drift av hytte', '/guide/cabin-operations/not-ready'],
    ['Booke hyttetid', '/booking'],
    ['Oppslagstavle', '/noticeboard'],
    ['Familieoversikt', '/familieoversikt'],
  ])('keeps %s navigation unchanged', async (label, expectedPath) => {
    loadHomeIconsMock.mockResolvedValue({})
    const container = await renderHome()

    act(() => findButton(container, label)?.click())

    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(expectedPath)
  })

  it('keeps Planlegge mat disabled while Oppslagstavle is active', async () => {
    loadHomeIconsMock.mockResolvedValue({})
    const container = await renderHome()
    const foodButton = findButton(container, 'Planlegge mat')

    expect(foodButton?.disabled).toBe(true)
    expect(findButton(container, 'Oppslagstavle')?.disabled).toBe(false)
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/')
  })

  it('shows the unseen count without changing the noticeboard Drive icon', async () => {
    loadHomeIconsMock.mockResolvedValue({
      [homeIconNames.noticeboard]: {
        name: `${homeIconNames.noticeboard}.png`,
        src: `https://drive.example/${homeIconNames.noticeboard}`,
      },
    })
    loadNoticeboardUnseenCountMock.mockResolvedValue(12)

    const container = await renderHome()
    const noticeboardButton = findButton(container, 'Oppslagstavle')

    expect(noticeboardButton?.querySelector('.task-button__badge')?.textContent).toBe('12')
    expect(noticeboardButton?.querySelector('img')?.src).toContain(homeIconNames.noticeboard)
  })

  it('keeps the home page usable when unseen count loading fails', async () => {
    loadHomeIconsMock.mockResolvedValue({})
    loadNoticeboardUnseenCountMock.mockRejectedValue(new Error('network'))

    const container = await renderHome()

    expect(findButton(container, 'Oppslagstavle')).toBeDefined()
    expect(container.querySelector('.task-button__badge')).toBeNull()
  })
})
