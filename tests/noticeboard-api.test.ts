import { describe, expect, it, vi } from 'vitest'
import type { NoticeboardPost, NoticeboardPostType } from '../shared/noticeboard'
import { createCreateNoticeboardPostFunction } from '../netlify/functions/create-noticeboard-post.mts'
import { createReadNoticeboardPostsFunction } from '../netlify/functions/read-noticeboard-posts.mts'
import { createSolveNoticeboardPostFunction } from '../netlify/functions/solve-noticeboard-post.mts'

const postId = '123e4567-e89b-42d3-a456-426614174000'
const authenticatedUser = { id: 'anette', displayName: 'Anette' }
const otherUser = { id: 'mads', displayName: 'Mads' }

function createRequest(type: NoticeboardPostType = 'Info', title = 'Ved på terrassen', description = '') {
  return new Request('https://example.com/.netlify/functions/create-noticeboard-post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, title, description }),
  })
}

function createPost(overrides: Partial<NoticeboardPost> = {}): NoticeboardPost {
  return {
    id: postId,
    ownerId: authenticatedUser.id,
    type: 'Info',
    title: 'Ved på terrassen',
    description: '',
    status: 'open',
    createdAt: '2026-08-13T08:00:00.000Z',
    updatedAt: '2026-08-13T08:00:00.000Z',
    ...overrides,
  }
}

describe('noticeboard authentication', () => {
  it.each([
    ['create', createCreateNoticeboardPostFunction({ authenticate: () => null }), createRequest()],
    ['list', createReadNoticeboardPostsFunction({ authenticate: () => null }), new Request('https://example.com/.netlify/functions/read-noticeboard-posts')],
    ['solve', createSolveNoticeboardPostFunction({ authenticate: () => null }), new Request(`https://example.com/.netlify/functions/solve-noticeboard-post?id=${postId}`, { method: 'PATCH' })],
  ])('rejects unauthenticated %s access', async (_name, handler, request) => {
    expect((await handler(request)).status).toBe(401)
  })
})

describe('creating noticeboard posts', () => {
  it.each(['Info', 'Spørsmål', 'Må gjøres'] as const)('creates the %s type', async (type) => {
    const savePost = vi.fn(async (post: NoticeboardPost) => post)
    const handler = createCreateNoticeboardPostFunction({
      authenticate: () => authenticatedUser,
      savePost,
      createId: () => postId,
      now: () => '2026-08-13T10:00:00.000Z',
    })

    const response = await handler(createRequest(type))
    const body = await response.json() as { post: NoticeboardPost }

    expect(response.status).toBe(201)
    expect(body.post).toMatchObject({
      id: postId,
      ownerId: authenticatedUser.id,
      type,
      status: 'open',
      createdAt: '2026-08-13T10:00:00.000Z',
      updatedAt: '2026-08-13T10:00:00.000Z',
    })
  })

  it('requires a non-empty title', async () => {
    const savePost = vi.fn()
    const handler = createCreateNoticeboardPostFunction({ authenticate: () => authenticatedUser, savePost })

    const response = await handler(createRequest('Info', '   '))

    expect(response.status).toBe(400)
    expect(savePost).not.toHaveBeenCalled()
  })

  it('trims title and description whitespace before saving', async () => {
    const savePost = vi.fn(async (post: NoticeboardPost) => post)
    const handler = createCreateNoticeboardPostFunction({
      authenticate: () => authenticatedUser,
      savePost,
      createId: () => postId,
      now: () => '2026-08-13T10:00:00.000Z',
    })

    await handler(createRequest('Spørsmål', '  Er det mer gass?  ', '  Sjekk boden.  '))

    expect(savePost).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Er det mer gass?',
      description: 'Sjekk boden.',
    }))
  })
})

describe('listing open noticeboard posts', () => {
  const olderPost = createPost({ createdAt: '2026-08-12T09:00:00.000Z' })
  const newerPost = createPost({
    id: '223e4567-e89b-42d3-a456-426614174000',
    ownerId: otherUser.id,
    title: 'Nyere spørsmål',
    type: 'Spørsmål',
    createdAt: '2026-08-13T09:00:00.000Z',
  })
  const solvedPost = createPost({
    id: '323e4567-e89b-42d3-a456-426614174000',
    status: 'solved',
  })

  it('returns only open posts, newest first', async () => {
    const handler = createReadNoticeboardPostsFunction({
      authenticate: () => authenticatedUser,
      loadPosts: vi.fn().mockResolvedValue([olderPost, solvedPost, newerPost]),
      loadComments: vi.fn().mockResolvedValue([]),
      loadPostReads: vi.fn().mockResolvedValue({}),
      saveLastSeen: vi.fn(),
      savePostsSeen: vi.fn(),
    })

    const response = await handler(new Request('https://example.com/.netlify/functions/read-noticeboard-posts'))
    const body = await response.json() as { posts: NoticeboardPost[] }

    expect(response.status).toBe(200)
    expect(body.posts.map((post) => post.id)).toEqual([newerPost.id, olderPost.id])
  })

  it('allows every authenticated family to read the same post content with personalized unread state', async () => {
    const posts = [newerPost, olderPost]
    const anetteHandler = createReadNoticeboardPostsFunction({
      authenticate: () => authenticatedUser,
      loadPosts: vi.fn().mockResolvedValue(posts),
      loadComments: vi.fn().mockResolvedValue([]),
      loadPostReads: vi.fn().mockResolvedValue({}),
      saveLastSeen: vi.fn(),
      savePostsSeen: vi.fn(),
    })
    const madsHandler = createReadNoticeboardPostsFunction({
      authenticate: () => otherUser,
      loadPosts: vi.fn().mockResolvedValue(posts),
      loadComments: vi.fn().mockResolvedValue([]),
      loadPostReads: vi.fn().mockResolvedValue({}),
      saveLastSeen: vi.fn(),
      savePostsSeen: vi.fn(),
    })
    const requestUrl = 'https://example.com/.netlify/functions/read-noticeboard-posts'

    const anetteBody = await (await anetteHandler(new Request(requestUrl))).json() as { posts: Array<NoticeboardPost & { unread: boolean }> }
    const madsBody = await (await madsHandler(new Request(requestUrl))).json() as { posts: Array<NoticeboardPost & { unread: boolean }> }

    expect(madsBody.posts.map(({ unread: _unread, ...post }) => post))
      .toEqual(anetteBody.posts.map(({ unread: _unread, ...post }) => post))
    expect(anetteBody.posts.find((post) => post.id === newerPost.id)?.unread).toBe(false)
    expect(madsBody.posts.find((post) => post.id === newerPost.id)?.unread).toBe(false)
  })
})

describe('solving noticeboard posts', () => {
  it('allows the owner to mark a post solved and updates updatedAt', async () => {
    const post = createPost()
    const saveSolvedPost = vi.fn(async (id: string, ownerId: string, updatedAt: string) => ({
      ...post,
      id,
      ownerId,
      status: 'solved' as const,
      updatedAt,
    }))
    const handler = createSolveNoticeboardPostFunction({
      authenticate: () => authenticatedUser,
      loadPost: vi.fn().mockResolvedValue(post),
      saveSolvedPost,
      now: () => '2026-08-13T12:00:00.000Z',
    })

    const response = await handler(new Request(`https://example.com/.netlify/functions/solve-noticeboard-post?id=${postId}`, { method: 'PATCH' }))
    const body = await response.json() as { post: NoticeboardPost }

    expect(response.status).toBe(200)
    expect(saveSolvedPost).toHaveBeenCalledWith(postId, authenticatedUser.id, '2026-08-13T12:00:00.000Z')
    expect(body.post).toMatchObject({ status: 'solved', updatedAt: '2026-08-13T12:00:00.000Z' })
  })

  it('prevents another family from marking the post solved', async () => {
    const saveSolvedPost = vi.fn()
    const handler = createSolveNoticeboardPostFunction({
      authenticate: () => otherUser,
      loadPost: vi.fn().mockResolvedValue(createPost()),
      saveSolvedPost,
    })

    const response = await handler(new Request(`https://example.com/.netlify/functions/solve-noticeboard-post?id=${postId}`, { method: 'PATCH' }))

    expect(response.status).toBe(403)
    expect(saveSolvedPost).not.toHaveBeenCalled()
  })

  it('removes solved posts from the open list without deleting them', async () => {
    let storedPost = createPost()
    const solveHandler = createSolveNoticeboardPostFunction({
      authenticate: () => authenticatedUser,
      loadPost: async () => storedPost,
      saveSolvedPost: async (_id, _ownerId, updatedAt) => {
        storedPost = { ...storedPost, status: 'solved', updatedAt }
        return storedPost
      },
    })
    const listHandler = createReadNoticeboardPostsFunction({
      authenticate: () => authenticatedUser,
      loadPosts: async () => [storedPost],
      loadComments: vi.fn().mockResolvedValue([]),
      loadPostReads: vi.fn().mockResolvedValue({}),
      saveLastSeen: vi.fn(),
      savePostsSeen: vi.fn(),
    })

    await solveHandler(new Request(`https://example.com/.netlify/functions/solve-noticeboard-post?id=${postId}`, { method: 'PATCH' }))
    const body = await (await listHandler(new Request('https://example.com/.netlify/functions/read-noticeboard-posts'))).json() as { posts: NoticeboardPost[] }

    expect(storedPost.status).toBe('solved')
    expect(body.posts).toEqual([])
  })
})
