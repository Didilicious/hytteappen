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

vi.mock('../src/components/FamilyEventInvitationCard', () => ({ default: () => <section aria-label="Invitasjon til familiearrangement" /> }))

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
    for (const card of cards) {
      const actions = card.querySelector('.noticeboard-card__actions')!
      expect(actions.previousElementSibling?.className).toBe('noticeboard-card__comments')
      expect(actions.querySelector('a')?.textContent).toBe('Se innlegg')
      expect(actions.querySelector('a')?.getAttribute('href')).toBe(card.querySelector('h2 a')?.getAttribute('href'))
      expect(actions.querySelector('button')).toBeNull()
    }
    expect(container.querySelector('a[href="/noticeboard/solved"]')?.textContent).toContain('Vis løste innlegg')
  })

  it('uses Marker som ferdig only for event-linked posts', async () => {
    loadOpenNoticeboardPostsMock.mockResolvedValue([
      createPost({ ownerId: 'anette', eventId: '323e4567-e89b-42d3-a456-426614174000' }),
      createPost({ id: '223e4567-e89b-42d3-a456-426614174000', ownerId: 'anette' }),
    ])
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root?.render(<MemoryRouter><NoticeboardPage /></MemoryRouter>))
    await flushEffects()
    expect([...container.querySelectorAll('.noticeboard-solve-button')].map((button) => button.textContent)).toEqual(['Marker som ferdig', 'Marker som løst'])
    for (const actions of container.querySelectorAll('.noticeboard-card__actions')) {
      expect(actions.firstElementChild?.textContent).toBe('Se innlegg')
      expect(actions.lastElementChild?.classList.contains('noticeboard-solve-button')).toBe(true)
      expect(actions.querySelectorAll('.noticeboard-card__action')).toHaveLength(2)
    }
  })
})
