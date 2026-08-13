// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NoticeboardPostWithCommentCount } from '../shared/noticeboard'
import SolvedNoticeboardPostsPage from '../src/pages/SolvedNoticeboardPostsPage'

const loadSolvedNoticeboardPostsMock = vi.hoisted(() => vi.fn())
const expireSessionMock = vi.hoisted(() => vi.fn())
const logoutMock = vi.hoisted(() => vi.fn())

vi.mock('../src/noticeboard', () => ({
  loadSolvedNoticeboardPosts: loadSolvedNoticeboardPostsMock,
}));

vi.mock('../src/auth', () => ({
  useAuth: () => ({
    currentUser: { id: 'anette', displayName: 'Anette' },
    expireSession: expireSessionMock,
    logout: logoutMock,
  }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function LocationPath() {
  return <span data-testid="location">{useLocation().pathname}</span>
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('solved noticeboard page', () => {
  let root: ReturnType<typeof createRoot> | undefined

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
    loadSolvedNoticeboardPostsMock.mockReset()
    expireSessionMock.mockReset()
    logoutMock.mockReset()
  })

  it('shows solved cards with comment counts and clickable detail links', async () => {
    const solvedPost: NoticeboardPostWithCommentCount = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      ownerId: 'mads',
      type: 'Spørsmål',
      title: 'Hvor er den blå genseren?',
      description: '',
      status: 'solved',
      createdAt: '2026-08-12T09:00:00.000Z',
      updatedAt: '2026-08-13T10:00:00.000Z',
      commentCount: 3,
    }
    loadSolvedNoticeboardPostsMock.mockResolvedValue([solvedPost])
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={['/noticeboard/solved']}>
          <Routes>
            <Route path="/noticeboard/solved" element={<SolvedNoticeboardPostsPage />} />
            <Route path="*" element={<LocationPath />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await flushEffects()

    const detailLink = [...container.querySelectorAll('a')]
      .find((link) => link.textContent?.includes(solvedPost.title))

    expect(container.textContent).toContain('Løste innlegg')
    expect(container.textContent).toContain('3 kommentarer')
    expect(detailLink?.getAttribute('href')).toBe(`/noticeboard/${solvedPost.id}`)

    act(() => detailLink?.click())
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(`/noticeboard/${solvedPost.id}`)
  })
})
