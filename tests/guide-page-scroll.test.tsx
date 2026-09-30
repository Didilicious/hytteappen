// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuideContent } from '../shared/guideContent'
import GuidePage from '../src/pages/GuidePage'

const loadGuideContentMock = vi.hoisted(() => vi.fn())

vi.mock('../src/guideContent', () => ({
  loadGuideContent: loadGuideContentMock,
}));

vi.mock('../src/guideImages', () => ({
  loadGuideImages: vi.fn().mockResolvedValue({}),
}));

vi.mock('../src/guideStorage', () => ({
  useGuideState: () => ({
    answers: {},
    progress: {},
    saveAnswer: vi.fn(),
    saveInstructionStatus: vi.fn(),
    resetGuideState: vi.fn(),
  }),
}));

vi.mock('../src/components/GuideLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../src/components/GuideContentSections', () => ({
  default: () => null,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const driftPage: GuideContent = {
  id: 'Nødstrøm',
  guides: ['Drift'],
  type: 'step',
  afterId: null,
  requiredStepIds: [],
  answerRequirements: [],
  title: 'Nødstrøm',
  location: null,
  warning: null,
  instructions: ['Slik bruker du nødstrøm.'],
  checkpoints: null,
  answerOptions: [],
  canSkip: true,
  imageGroup: null,
}

const openPages: GuideContent[] = [
  {
    ...driftPage,
    id: 'first-step',
    guides: ['Åpne'],
    title: 'Første steg',
  },
  {
    ...driftPage,
    id: 'second-step',
    guides: ['Åpne'],
    title: 'Andre steg',
  },
]

describe('Drift reference page navigation', () => {
  let root: ReturnType<typeof createRoot> | undefined

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
    loadGuideContentMock.mockReset()
    vi.restoreAllMocks()
  })

  it('scrolls to the top when a reference article opens', async () => {
    loadGuideContentMock.mockResolvedValue([driftPage])
    const scrollTo = vi.fn()
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo })
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={['/guide/cabin-operations/overview']}>
          <Routes>
            <Route path="/guide/:guideId/:nodeId?" element={<GuidePage />} />
          </Routes>
        </MemoryRouter>,
      )
    })

    expect(scrollTo).not.toHaveBeenCalled()
    const articleButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Nødstrøm'))

    await act(async () => articleButton?.click())

    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    expect(container.querySelector('h1')?.textContent).toBe('Nødstrøm')
  })

  it.each(['Ferdig', 'Hopp over for nå'])('scrolls to the top after %s advances an Åpne step', async (action) => {
    loadGuideContentMock.mockResolvedValue(openPages)
    const scrollTo = vi.fn()
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo })
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={['/guide/open-cabin/first-step']}>
          <Routes>
            <Route path="/guide/:guideId/:nodeId?" element={<GuidePage />} />
          </Routes>
        </MemoryRouter>,
      )
    })

    const actionButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent === action)
    await act(async () => actionButton?.click())

    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    expect(container.querySelector('h1')?.textContent).toBe('Andre steg')
  })

  it('returns to the Drift list from the bottom Ferdig button', async () => {
    loadGuideContentMock.mockResolvedValue([driftPage])
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={['/guide/cabin-operations/Nødstrøm']}>
          <Routes>
            <Route path="/guide/:guideId/:nodeId?" element={<GuidePage />} />
          </Routes>
        </MemoryRouter>,
      )
    })

    const doneButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === 'Ferdig')
    await act(async () => doneButton?.click())

    expect(container.querySelector('h1')?.textContent).toBe('Drift av hytte')
  })
})
