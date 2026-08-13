// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NoticeboardPostSummary } from '../shared/noticeboard'
import NoticeboardPage from '../src/pages/NoticeboardPage'

const loadOpenNoticeboardPostsMock = vi.hoisted(() => vi.fn())
const expireSessionMock = vi.hoisted(() => vi.fn())
const logoutMock = vi.hoisted(() => vi.fn())

vi.mock('../src/noticeboard', () => ({
  loadOpenNoticeboardPosts: loadOpenNoticeboardPostsMock,
  markNoticeboardPostSolved: vi.fn(),
}));

vi.mock('../src/auth', () => ({
  useAuth: () => ({
    currentUser: { id: 'anette', displayName: 'Anette' },
    expireSession: expireSessionMock,
    logout: logoutMock,
  }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function createPost(overrides: Partial<NoticeboardPostSummary>): NoticeboardPostSummary {
  return {
    id: '123e4567-e89b-42d3-a456-426614174000',
    ownerId: 'mads',
    type: 'Info',
    title: 'Har noen sett genseren?',
    description: '',
    status: 'open',
    createdAt: '2026-08-13T10:00:00.000Z',
    updatedAt: '2026-08-13T10:00:00.000Z',
    commentCount: 2,
    unread: true,
    ...overrides,
  }
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('noticeboard overview unread dots', () => {
  let root: ReturnType<typeof createRoot> | undefined

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
    loadOpenNoticeboardPostsMock.mockReset()
    expireSessionMock.mockReset()
    logoutMock.mockReset()
  })

  it('shows a dot only on posts returned as unread and reserves the dot slot on every card', async () => {
    loadOpenNoticeboardPostsMock.mockResolvedValue([
      createPost({ unread: true }),
      createPost({
        id: '223e4567-e89b-42d3-a456-426614174000',
        title: 'Tomt for gass',
        commentCount: 1,
        unread: false,
      }),
    ])
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<MemoryRouter><NoticeboardPage /></MemoryRouter>)
    })
    await flushEffects()

    const cards = container.querySelectorAll('.noticeboard-card')
    expect(cards).toHaveLength(2)
    expect(cards[0]?.querySelector('.noticeboard-card__unread-dot')).not.toBeNull()
    expect(cards[1]?.querySelector('.noticeboard-card__unread-dot')).toBeNull()
    expect(container.querySelectorAll('.noticeboard-card__unread-slot')).toHaveLength(2)
    expect(cards[0]?.textContent).toContain('2 kommentarer')
    expect(cards[1]?.textContent).toContain('1 kommentar')
    expect(container.querySelector('a[href="/noticeboard/solved"]')?.textContent).toContain('Vis løste innlegg')
  })
})
