// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PwaUpdatePrompt from '../src/components/PwaUpdatePrompt'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('PWA update prompt', () => {
  let root: ReturnType<typeof createRoot> | undefined
  afterEach(() => {
    act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  async function renderUpdate(hasController = true) {
    vi.stubEnv('PROD', true)
    const waiting = { postMessage: vi.fn() }
    const installing = new EventTarget()
    const registration = Object.assign(new EventTarget(), {
      waiting: null as typeof waiting | null,
      installing,
      update: vi.fn(async () => {}),
    })
    const serviceWorker = Object.assign(new EventTarget(), {
      controller: hasController ? {} : null,
      register: vi.fn(async () => registration),
    })
    vi.stubGlobal('navigator', { serviceWorker, onLine: true })
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root!.render(<PwaUpdatePrompt />))
    return { container, waiting, registration, installing, serviceWorker }
  }

  it('offers a reload only after an update is ready and the user accepts', async () => {
    const { container, waiting, registration, installing, serviceWorker } = await renderUpdate()
    expect(container.textContent).toBe('')
    expect(serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' })
    registration.waiting = waiting
    act(() => installing.dispatchEvent(new Event('statechange')))
    expect(container.textContent).toContain('En ny versjon av Hytteappen er klar')
    expect(waiting.postMessage).not.toHaveBeenCalled()
    act(() => container.querySelector<HTMLButtonElement>('button')!.click())
    expect(waiting.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'SKIP_WAITING' })
    expect(container.querySelector('button')!.disabled).toBe(true)
  })

  it('allows deferring an update without activating it', async () => {
    const { container, waiting, registration, installing } = await renderUpdate()
    registration.waiting = waiting
    act(() => installing.dispatchEvent(new Event('statechange')))
    act(() => container.querySelectorAll<HTMLButtonElement>('button')[1].click())
    expect(container.textContent).toBe('')
    expect(waiting.postMessage).not.toHaveBeenCalled()
  })

  it('does not show an update prompt for the first installation', async () => {
    const { container, waiting, registration, installing } = await renderUpdate(false)
    registration.waiting = waiting
    act(() => installing.dispatchEvent(new Event('statechange')))
    expect(container.textContent).toBe('')
  })
})
