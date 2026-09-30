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
})
