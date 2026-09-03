// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuideImage } from '../shared/guideImages'
import Chatbot from '../src/components/Chatbot'

const { expireSession, loadHomeIconsMock } = vi.hoisted(() => ({
  expireSession: vi.fn(),
  loadHomeIconsMock: vi.fn<() => Promise<Record<string, GuideImage | null>>>(),
}))

vi.mock('../src/auth', () => ({
  useAuth: () => ({ expireSession }),
}))

vi.mock('../src/guideImages', () => ({
  loadHomeIcons: loadHomeIconsMock,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  expireSession.mockReset()
  loadHomeIconsMock.mockReset()
  loadHomeIconsMock.mockResolvedValue({
    icon_chatbot: { name: 'icon_chatbot.png', src: 'https://drive.example/icon_chatbot.png' },
  })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('chatbot interface', () => {
  it('loads the Drive icon and opens a compact dialog', async () => {
    await act(async () => root.render(<Chatbot />))
    await act(async () => undefined)

    const trigger = container.querySelector<HTMLButtonElement>('.chatbot-trigger')
    expect(trigger?.querySelector('img')?.src).toBe('https://drive.example/icon_chatbot.png')

    act(() => trigger?.click())

    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(container.textContent).toContain('Hei! Hva kan jeg hjelpe deg med?')
  })

  it('prevents duplicate submissions while waiting for a response', async () => {
    let resolveRequest: ((response: Response) => void) | undefined
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveRequest = resolve
    }))
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => root.render(<Chatbot />))
    act(() => container.querySelector<HTMLButtonElement>('.chatbot-trigger')?.click())

    const textarea = container.querySelector<HTMLTextAreaElement>('#chatbot-input')
    const form = container.querySelector<HTMLFormElement>('.chatbot-form')

    act(() => {
      if (!textarea) return
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
        ?.set?.call(textarea, 'Hva bør vi ta med?')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })

    act(() => {
      if (!form) return
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(container.querySelector<HTMLButtonElement>('.chatbot-form button')?.disabled).toBe(true)

    await act(async () => {
      resolveRequest?.(new Response(JSON.stringify({ message: 'Ta med varme klær og ved.' }), { status: 200 }))
    })

    expect(container.textContent).toContain('Ta med varme klær og ved.')
    expect(container.querySelector<HTMLTextAreaElement>('#chatbot-input')?.disabled).toBe(false)
    expect(container.querySelector<HTMLButtonElement>('.chatbot-form button')?.disabled).toBe(true)
  })
})
