// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuideImage } from '../shared/guideImages'
import Chatbot from '../src/components/Chatbot'

const { expireSession, loadHomeIconsMock, readOfflineGuidesMock, authState } = vi.hoisted(() => ({
  authState: { status: 'authenticated' },
  expireSession: vi.fn(),
  readOfflineGuidesMock: vi.fn(),
  loadHomeIconsMock: vi.fn<() => Promise<Record<string, GuideImage | null>>>(),
}))

vi.mock('../src/offlineGuides', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/offlineGuides')>(),
  readOfflineGuides: readOfflineGuidesMock,
}))

vi.mock('../src/auth', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/auth')>(),
  useAuth: () => ({ expireSession, status: authState.status, currentUser: null }),
}))

vi.mock('../src/guideImages', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/guideImages')>(),
  loadHomeIcons: loadHomeIconsMock,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  authState.status = 'authenticated'
  expireSession.mockReset()
  readOfflineGuidesMock.mockReset()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  loadHomeIconsMock.mockReset()
  loadHomeIconsMock.mockResolvedValue({
    icon_chatbot: { name: 'icon_chatbot.png', src: 'https://drive.example/icon_chatbot.png' },
  })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('chatbot interface', () => {
  it('loads the Drive icon and opens a compact dialog', async () => {
    await act(async () => root.render(<MemoryRouter><Chatbot /></MemoryRouter>))
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

    await act(async () => root.render(<MemoryRouter><Chatbot /></MemoryRouter>))
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

  it('shows controlled links to relevant app sources', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: 'Anne Marie har booket hytta denne helgen.',
      sources: [
        { label: 'Hyttebooking: Anne Marie & Jan', path: '/booking/booking-1' },
        { label: 'Ugyldig', path: 'https://example.com' },
      ],
    }), { status: 200 })))

    await act(async () => root.render(<MemoryRouter><Chatbot /></MemoryRouter>))
    act(() => container.querySelector<HTMLButtonElement>('.chatbot-trigger')?.click())

    const textarea = container.querySelector<HTMLTextAreaElement>('#chatbot-input')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
        ?.set?.call(textarea, 'Hvem er på hytta i helgen?')
      textarea?.dispatchEvent(new Event('input', { bubbles: true }))
      container.querySelector<HTMLFormElement>('.chatbot-form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    const sourceLink = container.querySelector<HTMLAnchorElement>('.chatbot-sources a')
    expect(sourceLink?.getAttribute('href')).toBe('/booking/booking-1')
    expect(sourceLink?.textContent).toContain('Kilde: Hyttebooking: Anne Marie & Jan')
    expect(container.textContent).not.toContain('Ugyldig')
  })
})

async function askQuestion(question: string) {
  await act(async () => root.render(<MemoryRouter><Chatbot /></MemoryRouter>))
  act(() => container.querySelector<HTMLButtonElement>('.chatbot-trigger')?.click())
  await act(async () => {
    const textarea = container.querySelector<HTMLTextAreaElement>('#chatbot-input')
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, question)
    textarea?.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => {
    container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

it('searches downloads offline without sending requests or loading remote icons', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  readOfflineGuidesMock.mockResolvedValue({ content: [{
    id: 'pump', title: 'Vannpumpe', guides: ['Drift'], type: 'step', afterId: null,
    requiredStepIds: [], answerRequirements: [], location: null, warning: 'Slå av strømmen.',
    instructions: ['Kontroller pumpen.'], checkpoints: null, answerOptions: [], canSkip: false, imageGroup: null,
  }] })
  await askQuestion('Hvordan kontrollerer jeg vannpumpen?')
  expect(container.textContent).toContain('Du er offline.')
  expect(container.textContent).toContain('Kontroller pumpen.')
  expect(container.querySelector('.chatbot-sources a')?.getAttribute('href')).toBe('/guide/cabin-operations/pump')
  expect(fetchMock).not.toHaveBeenCalled()
  expect(loadHomeIconsMock).not.toHaveBeenCalled()
})

it('falls back locally when a request loses its connection and preserves input if downloads are missing', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  readOfflineGuidesMock.mockResolvedValue(undefined)
  await askQuestion('Hvor er vannpumpen?')
  expect(readOfflineGuidesMock).toHaveBeenCalledOnce()
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Ingen guider er lastet ned på denne enheten')
  expect(container.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Hvor er vannpumpen?')
  expect(container.textContent).not.toContain('Failed to fetch')
  expect(expireSession).not.toHaveBeenCalled()
})

it('shows a Norwegian error for invalid server JSON', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })))
  await askQuestion('Hvor er vannpumpen?')
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Svaret fra chatboten kunne ikke leses')
})

it('keeps the chatbot available after an offline reload without a restored session', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  authState.status = 'anonymous'
  readOfflineGuidesMock.mockResolvedValue(undefined)
  const { default: App } = await import('../src/App')
  await act(async () => root.render(<MemoryRouter initialEntries={['/offline-innhold']}><App /></MemoryRouter>))
  expect(container.querySelector('.chatbot-trigger')).not.toBeNull()
  act(() => container.querySelector<HTMLButtonElement>('.chatbot-trigger')?.click())
  expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Du er offline.')
})
