import { describe, expect, it, vi } from 'vitest'
import type { NoticeboardComment, NoticeboardPost } from '../shared/noticeboard'
import { createCreateNoticeboardCommentFunction } from '../netlify/functions/create-noticeboard-comment.mts'
import { createReadNoticeboardCommentsFunction } from '../netlify/functions/read-noticeboard-comments.mts'
import { sortNoticeboardComments } from '../netlify/functions/_shared/noticeboard-comments.mts'

const postId = '123e4567-e89b-42d3-a456-426614174000'
const commentId = '223e4567-e89b-42d3-a456-426614174000'
const anette = { id: 'anette', displayName: 'Anette' }
const mads = { id: 'mads', displayName: 'Mads' }

function createPost(ownerId = anette.id): NoticeboardPost {
  return {
    id: postId,
    ownerId,
    type: 'Info',
    title: 'Ved på terrassen',
    description: '',
    status: 'open',
    createdAt: '2026-08-13T08:00:00.000Z',
    updatedAt: '2026-08-13T08:00:00.000Z',
  }
}

function createRequest(text: string, ownerId = 'spoofed-owner') {
  return new Request(`https://example.com/.netlify/functions/create-noticeboard-comment?postId=${postId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, ownerId, idempotencyKey: commentId }),
  })
}

function createHandler(user: typeof anette, postOwnerId: string) {
  return createCreateNoticeboardCommentFunction({
    authenticate: () => user,
    loadPost: vi.fn().mockResolvedValue(createPost(postOwnerId)),
    saveComment: vi.fn(async (comment: NoticeboardComment) => comment),
    now: () => '2026-08-13T10:00:00.000Z',
  })
}

describe('noticeboard comments', () => {
  it('allows an authenticated family to comment on another family post', async () => {
    const response = await createHandler(mads, anette.id)(createRequest('Jeg tar med ved.'))
    const body = await response.json() as { comment: NoticeboardComment }

    expect(response.status).toBe(201)
    expect(body.comment).toMatchObject({ postId, ownerId: mads.id, text: 'Jeg tar med ved.' })
  })

  it('allows an authenticated family to comment on its own post', async () => {
    const response = await createHandler(anette, anette.id)(createRequest('Oppdatering fra oss.'))

    expect(response.status).toBe(201)
  })

  it('rejects an empty comment', async () => {
    const saveComment = vi.fn()
    const handler = createCreateNoticeboardCommentFunction({
      authenticate: () => anette,
      loadPost: vi.fn().mockResolvedValue(createPost()),
      saveComment,
    })

    const response = await handler(createRequest('   \n  '))

    expect(response.status).toBe(400)
    expect(saveComment).not.toHaveBeenCalled()
  })

  it('trims whitespace and derives owner from the authenticated session', async () => {
    const saveComment = vi.fn(async (comment: NoticeboardComment) => comment)
    const handler = createCreateNoticeboardCommentFunction({
      authenticate: () => mads,
      loadPost: vi.fn().mockResolvedValue(createPost()),
      saveComment,
      now: () => '2026-08-13T10:00:00.000Z',
    })

    await handler(createRequest('  Vi ordner det.  '))

    expect(saveComment).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: mads.id,
      text: 'Vi ordner det.',
    }))
  })

  it('returns comments oldest first', () => {
    const comments = sortNoticeboardComments([
      { id: commentId, postId, ownerId: mads.id, text: 'Ny', createdAt: '2026-08-13T11:00:00.000Z', updatedAt: '2026-08-13T11:00:00.000Z' },
      { id: '323e4567-e89b-42d3-a456-426614174000', postId, ownerId: anette.id, text: 'Gammel', createdAt: '2026-08-13T09:00:00.000Z', updatedAt: '2026-08-13T09:00:00.000Z' },
    ])

    expect(comments.map((comment) => comment.text)).toEqual(['Gammel', 'Ny'])
  })

  it('rejects unauthenticated comment creation and reading', async () => {
    const createHandler = createCreateNoticeboardCommentFunction({
      authenticate: () => null,
      loadPost: vi.fn(),
      saveComment: vi.fn(),
    })
    const readHandler = createReadNoticeboardCommentsFunction({
      authenticate: () => null,
      loadPost: vi.fn(),
      loadComments: vi.fn(),
    })

    const createResponse = await createHandler(createRequest('Kommentar'))
    const readResponse = await readHandler(new Request(`https://example.com/.netlify/functions/read-noticeboard-comments?postId=${postId}`))

    expect(createResponse.status).toBe(401)
    expect(readResponse.status).toBe(401)
  })
})
