// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ScrollToTop from '../src/components/ScrollToTop'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function TestRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Link to="/next">Neste side</Link>} />
        <Route path="/next" element={<Link className="back-button" to="/">Tilbake</Link>} />
      </Routes>
    </>
  )
}

describe('route scroll behavior', () => {
  let root: ReturnType<typeof createRoot> | undefined

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('scrolls new pages to the top except when a back control is used', async () => {
    const scrollTo = vi.fn()
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo })
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<MemoryRouter><TestRoutes /></MemoryRouter>)
    })
    scrollTo.mockClear()

    await act(async () => container.querySelector<HTMLAnchorElement>('a')?.click())
    expect(scrollTo).toHaveBeenCalledWith(0, 0)

    scrollTo.mockClear()
    await act(async () => container.querySelector<HTMLAnchorElement>('a')?.click())
    expect(scrollTo).not.toHaveBeenCalled()
  })
})
