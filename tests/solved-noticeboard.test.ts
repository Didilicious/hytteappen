import { describe, expect, it, vi } from 'vitest'
import type { NoticeboardComment, NoticeboardPost } from '../shared/noticeboard'
import { createReadNoticeboardPostFunction } from '../netlify/functions/read-noticeboard-post.mts'
import { createReadSolvedNoticeboardPostsFunction } from '../netlify/functions/read-solved-noticeboard-posts.mts'

const anette = { id: 'anette', displayName: 'Anette' }
const olderSolvedPost: NoticeboardPost = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  ownerId: 'mads',
  type: 'Info',
  title: 'Eldre løst innlegg',
  description: '',
  status: 'solved',
  createdAt: '2026-08-11T09:00:00.000Z',
  updatedAt: '2026-08-12T10:00:00.000Z',
}
const newerSolvedPost: NoticeboardPost = {
  ...olderSolvedPost,
  id: '223e4567-e89b-42d3-a456-426614174000',
  title: 'Nyere løst innlegg',
  updatedAt: '2026-08-13T10:00:00.000Z',
}
const openPost: NoticeboardPost = {
  ...olderSolvedPost,
  id: '323e4567-e89b-42d3-a456-426614174000',
  title: 'Åpent innlegg',
  status: 'open',
}
const solvedComment: NoticeboardComment = {
  id: '423e4567-e89b-42d3-a456-426614174000',
  postId: newerSolvedPost.id,
  ownerId: 'heidi',
  text: 'Dette er ordnet.',
  createdAt: '2026-08-13T09:00:00.000Z',
  updatedAt: '2026-08-13T09:00:00.000Z',
}

describe('solved noticeboard posts', () => {
  it('lists only solved posts by most recently updated first with comment counts', async () => {
    const handler = createReadSolvedNoticeboardPostsFunction({
      authenticate: () => anette,
      loadPosts: vi.fn().mockResolvedValue([olderSolvedPost, openPost, newerSolvedPost]),
      loadComments: vi.fn().mockResolvedValue([solvedComment]),
    })

    const response = await handler(new Request('https://example.com/.netlify/functions/read-solved-noticeboard-posts'))
    const body = await response.json() as { posts: Array<NoticeboardPost & { commentCount: number }> }

    expect(response.status).toBe(200)
    expect(body.posts.map((post) => post.id)).toEqual([newerSolvedPost.id, olderSolvedPost.id])
    expect(body.posts[0]?.commentCount).toBe(1)
    expect(body.posts.some((post) => post.status === 'open')).toBe(false)
  })

  it('keeps solved post details and comments readable', async () => {
    const savePostRead = vi.fn()
    const handler = createReadNoticeboardPostFunction({
      authenticate: () => anette,
      loadPost: vi.fn().mockResolvedValue(newerSolvedPost),
      loadComments: vi.fn().mockResolvedValue([solvedComment]),
      savePostRead,
      now: () => '2026-08-13T11:00:00.000Z',
    })

    const response = await handler(new Request(`https://example.com/.netlify/functions/read-noticeboard-post?id=${newerSolvedPost.id}`))
    const body = await response.json() as { post: NoticeboardPost; comments: NoticeboardComment[] }

    expect(response.status).toBe(200)
    expect(body.post.status).toBe('solved')
    expect(body.comments).toEqual([solvedComment])
    expect(savePostRead).toHaveBeenCalledWith(anette.id, newerSolvedPost.id, '2026-08-13T11:00:00.000Z')
  })

  it('requires authentication for the solved list', async () => {
    const handler = createReadSolvedNoticeboardPostsFunction({
      authenticate: () => null,
      loadPosts: vi.fn(),
      loadComments: vi.fn(),
    })

    const response = await handler(new Request('https://example.com/.netlify/functions/read-solved-noticeboard-posts'))

    expect(response.status).toBe(401)
  })
})
