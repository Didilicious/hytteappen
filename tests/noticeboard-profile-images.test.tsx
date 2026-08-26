// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoticeboardComment, NoticeboardPost, NoticeboardPostSummary } from '../shared/noticeboard'
import NoticeboardPage from '../src/pages/NoticeboardPage'
import NoticeboardPostPage from '../src/pages/NoticeboardPostPage'
import { rememberProfileImageVersion } from '../src/profileImages'

const noticeboardMocks = vi.hoisted(() => ({
  createNoticeboardComment: vi.fn(),
  loadNoticeboardComments: vi.fn(),
  loadNoticeboardPost: vi.fn(),
  loadOpenNoticeboardPosts: vi.fn(),
  markNoticeboardPostSolved: vi.fn(),
}))
const authMocks = vi.hoisted(() => ({
  expireSession: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('../src/noticeboard', () => noticeboardMocks)

vi.mock('../src/auth', () => ({
  useAuth: () => ({
    currentUser: { id: 'anette', displayName: 'Anette' },
    expireSession: authMocks.expireSession,
    logout: authMocks.logout,
  }),
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const post: NoticeboardPost = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  ownerId: 'heidi',
  type: 'Info',
  title: 'Ved til peisen',
  description: 'Det er mer ved i boden.',
  status: 'open',
  createdAt: '2026-08-13T10:00:00.000Z',
  updatedAt: '2026-08-13T10:00:00.000Z',
}

const comment: NoticeboardComment = {
  id: '223e4567-e89b-42d3-a456-426614174000',
  postId: post.id,
  ownerId: 'christine',
  text: 'Takk for beskjed!',
  createdAt: '2026-08-13T11:00:00.000Z',
  updatedAt: '2026-08-13T11:00:00.000Z',
}

async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('noticeboard profile images', () => {
  let root: ReturnType<typeof createRoot> | undefined

  beforeEach(() => {
    noticeboardMocks.loadOpenNoticeboardPosts.mockResolvedValue([{ ...post, commentCount: 1, unread: false } satisfies NoticeboardPostSummary])
    noticeboardMocks.loadNoticeboardPost.mockResolvedValue({ post, comments: [comment] })
    noticeboardMocks.loadNoticeboardComments.mockResolvedValue([comment])
  })

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
    Object.values(noticeboardMocks).forEach((mock) => mock.mockReset())
    Object.values(authMocks).forEach((mock) => mock.mockReset())
  })

  async function renderOverview() {
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => root?.render(<MemoryRouter><NoticeboardPage /></MemoryRouter>))
    await settle()
    return container
  }

  async function renderDetail() {
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => root?.render(
      <MemoryRouter initialEntries={[`/noticeboard/${post.id}`]}>
        <Routes>
          <Route path="/noticeboard/:postId" element={<NoticeboardPostPage />} />
        </Routes>
      </MemoryRouter>,
    ))
    await settle()
    return container
  }

  it('uses the post owner family picture and refreshes it without changing post data', async () => {
    const container = await renderOverview()
    const image = container.querySelector<HTMLImageElement>('.noticeboard-card .noticeboard-family-avatar img')

    expect(image).not.toBeNull()
    expect(new URL(image!.src).searchParams.get('familyId')).toBe('heidi')
    expect(new URL(image!.src).searchParams.has('memberId')).toBe(false)

    await act(async () => rememberProfileImageVersion({ familyId: 'heidi' }, '2026-08-26T08:00:00.000Z'))

    const refreshedImage = container.querySelector<HTMLImageElement>('.noticeboard-card .noticeboard-family-avatar img')
    expect(new URL(refreshedImage!.src).searchParams.get('v')).toBe('2026-08-26T08:00:00.000Z')
    expect(noticeboardMocks.loadOpenNoticeboardPosts).toHaveBeenCalledTimes(1)
  })

  it('uses family pictures for the detail owner and comment author, never member pictures', async () => {
    const container = await renderDetail()
    const postImage = container.querySelector<HTMLImageElement>('.noticeboard-detail__author img')
    const commentImage = container.querySelector<HTMLImageElement>('.noticeboard-comment img')

    expect(new URL(postImage!.src).searchParams.get('familyId')).toBe('heidi')
    expect(new URL(postImage!.src).searchParams.has('memberId')).toBe(false)
    expect(new URL(commentImage!.src).searchParams.get('familyId')).toBe('christine')
    expect(new URL(commentImage!.src).searchParams.has('memberId')).toBe(false)
  })

  it('keeps the neutral family placeholder when a family picture is missing', async () => {
    const container = await renderDetail()
    const commentAvatar = container.querySelector<HTMLElement>('.noticeboard-comment__avatar')
    const image = commentAvatar?.querySelector<HTMLImageElement>('img')

    await act(async () => image?.dispatchEvent(new Event('error')))

    expect(commentAvatar?.querySelector('img')).toBeNull()
    expect(commentAvatar?.querySelector('.profile-placeholder--family')).not.toBeNull()
  })
})
