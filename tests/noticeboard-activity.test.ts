import { describe, expect, it, vi } from 'vitest'
import type { NoticeboardComment, NoticeboardPost } from '../shared/noticeboard'
import {
  countUnseenNoticeboardActivity,
  isNoticeboardPostUnread,
} from '../netlify/functions/_shared/noticeboard-activity.mts'
import { createReadNoticeboardPostFunction } from '../netlify/functions/read-noticeboard-post.mts'
import { createReadNoticeboardPostsFunction } from '../netlify/functions/read-noticeboard-posts.mts'
import { createReadNoticeboardUnseenCountFunction } from '../netlify/functions/read-noticeboard-unseen-count.mts'

const anette = { id: 'anette', displayName: 'Anette' }
const mads = { id: 'mads', displayName: 'Mads' }
const seenThrough = '2026-08-13T09:00:00.000Z'

function post(id: string, ownerId: string, createdAt: string): NoticeboardPost {
  return {
    id,
    ownerId,
    type: 'Info',
    title: id,
    description: '',
    status: 'open',
    createdAt,
    updatedAt: createdAt,
  }
}

function comment(id: string, postId: string, ownerId: string, createdAt: string): NoticeboardComment {
  return { id, postId, ownerId, text: id, createdAt, updatedAt: createdAt }
}

const ownPost = post('123e4567-e89b-42d3-a456-426614174000', anette.id, '2026-08-13T10:00:00.000Z')
const otherPost = post('223e4567-e89b-42d3-a456-426614174000', mads.id, '2026-08-13T10:01:00.000Z')
const ownComment = comment('323e4567-e89b-42d3-a456-426614174000', otherPost.id, anette.id, '2026-08-13T10:02:00.000Z')
const otherCommentOnOwnPost = comment('423e4567-e89b-42d3-a456-426614174000', ownPost.id, mads.id, '2026-08-13T10:03:00.000Z')
const secondOtherPost = post('623e4567-e89b-42d3-a456-426614174000', mads.id, '2026-08-13T10:05:00.000Z')

describe('noticeboard unseen activity', () => {
  it('counts another family post but not an own post', () => {
    expect(countUnseenNoticeboardActivity([ownPost, otherPost], [], anette.id, seenThrough)).toBe(1)
  })

  it('counts another family comment but not an own comment', () => {
    expect(countUnseenNoticeboardActivity([], [ownComment, otherCommentOnOwnPost], anette.id, seenThrough)).toBe(1)
  })

  it('counts another family comment on the current family own post', () => {
    expect(countUnseenNoticeboardActivity([ownPost], [otherCommentOnOwnPost], anette.id, seenThrough)).toBe(1)
  })

  it('counts multiple posts and comments as separate activity items', () => {
    const anotherComment = comment('523e4567-e89b-42d3-a456-426614174000', otherPost.id, mads.id, '2026-08-13T10:04:00.000Z')
    expect(countUnseenNoticeboardActivity(
      [ownPost, otherPost],
      [ownComment, otherCommentOnOwnPost, anotherComment],
      anette.id,
      seenThrough,
    )).toBe(3)
  })

  it('treats all existing activity by other families as unseen for a first-time family', () => {
    expect(countUnseenNoticeboardActivity(
      [ownPost, otherPost],
      [ownComment, otherCommentOnOwnPost],
      anette.id,
      null,
    )).toBe(2)
  })

  it('opening the board stores the loaded activity watermark for the authenticated family', async () => {
    const saveLastSeen = vi.fn()
    const responseWatermark = '2026-08-13T10:02:30.000Z'
    const handler = createReadNoticeboardPostsFunction({
      authenticate: () => anette,
      loadPosts: vi.fn().mockResolvedValue([ownPost, otherPost]),
      loadComments: vi.fn().mockResolvedValue([otherCommentOnOwnPost]),
      loadPostReads: vi.fn().mockResolvedValue({}),
      saveLastSeen,
      savePostsSeen: vi.fn(),
      now: () => responseWatermark,
    })

    const response = await handler(new Request('https://example.com/.netlify/functions/read-noticeboard-posts'))
    const body = await response.json() as { seenThrough: string }

    expect(response.status).toBe(200)
    expect(body.seenThrough).toBe(responseWatermark)
    expect(saveLastSeen).toHaveBeenCalledWith(anette.id, responseWatermark)
  })

  it('opening the board clears current unseen activity', async () => {
    let persistedLastSeen: string | null = null
    const countHandler = createReadNoticeboardUnseenCountFunction({
      authenticate: () => anette,
      loadPosts: vi.fn().mockResolvedValue([ownPost, otherPost]),
      loadComments: vi.fn().mockResolvedValue([otherCommentOnOwnPost]),
      loadLastSeen: async () => persistedLastSeen,
    })
    const openHandler = createReadNoticeboardPostsFunction({
      authenticate: () => anette,
      loadPosts: vi.fn().mockResolvedValue([ownPost, otherPost]),
      loadComments: vi.fn().mockResolvedValue([otherCommentOnOwnPost]),
      loadPostReads: vi.fn().mockResolvedValue({}),
      saveLastSeen: async (_ownerId, value) => { persistedLastSeen = value },
      savePostsSeen: vi.fn(),
      now: () => '2026-08-13T10:04:00.000Z',
    })
    const request = new Request('https://example.com/.netlify/functions/read-noticeboard-unseen-count')

    const before = await (await countHandler(request)).json() as { count: number }
    await openHandler(new Request('https://example.com/.netlify/functions/read-noticeboard-posts'))
    const after = await (await countHandler(request)).json() as { count: number }

    expect(before.count).toBe(2)
    expect(after.count).toBe(0)
  })

  it('activity created after opening becomes unseen', () => {
    expect(countUnseenNoticeboardActivity(
      [otherPost],
      [otherCommentOnOwnPost],
      anette.id,
      otherPost.createdAt,
    )).toBe(1)
  })

  it('loads persisted last-seen state using the authenticated family id', async () => {
    const loadLastSeen = vi.fn().mockResolvedValue(seenThrough)
    const handler = createReadNoticeboardUnseenCountFunction({
      authenticate: () => anette,
      loadPosts: vi.fn().mockResolvedValue([otherPost]),
      loadComments: vi.fn().mockResolvedValue([]),
      loadLastSeen,
    })

    const response = await handler(new Request('https://example.com/.netlify/functions/read-noticeboard-unseen-count'))
    const body = await response.json() as { count: number }

    expect(loadLastSeen).toHaveBeenCalledWith(anette.id)
    expect(body.count).toBe(1)
  })
})

describe('per-post unread activity', () => {
  it('marks another family new post unread', () => {
    expect(isNoticeboardPostUnread(otherPost, [], anette.id, undefined)).toBe(true)
  })

  it('does not mark an own new post unread', () => {
    expect(isNoticeboardPostUnread(ownPost, [], anette.id, undefined)).toBe(false)
  })

  it('marks a post unread after another family adds a comment', () => {
    expect(isNoticeboardPostUnread(
      ownPost,
      [otherCommentOnOwnPost],
      anette.id,
      {
        postSeenThrough: '2026-08-13T10:02:00.000Z',
        commentsReadThrough: '2026-08-13T10:02:00.000Z',
      },
    )).toBe(true)
  })

  it('does not mark a post unread after the current family own comment', () => {
    expect(isNoticeboardPostUnread(otherPost, [ownComment], anette.id, {
      postSeenThrough: otherPost.createdAt,
      commentsReadThrough: otherPost.createdAt,
    })).toBe(false)
  })

  it('loading the overview clears the home badge and a new-post-only dot', async () => {
    let homeSeenThrough: string | null = null
    const savePostsSeen = vi.fn()
    const countHandler = createReadNoticeboardUnseenCountFunction({
      authenticate: () => anette,
      loadPosts: vi.fn().mockResolvedValue([otherPost]),
      loadComments: vi.fn().mockResolvedValue([]),
      loadLastSeen: async () => homeSeenThrough,
    })
    const boardHandler = createReadNoticeboardPostsFunction({
      authenticate: () => anette,
      loadPosts: vi.fn().mockResolvedValue([otherPost]),
      loadComments: vi.fn().mockResolvedValue([]),
      loadPostReads: vi.fn().mockResolvedValue({}),
      saveLastSeen: async (_ownerId, value) => { homeSeenThrough = value },
      savePostsSeen,
      now: () => '2026-08-13T10:06:00.000Z',
    })

    const before = await (await countHandler(new Request('https://example.com/.netlify/functions/read-noticeboard-unseen-count'))).json() as { count: number }
    const board = await (await boardHandler(new Request('https://example.com/.netlify/functions/read-noticeboard-posts'))).json() as { posts: Array<{ unread: boolean }> }
    const after = await (await countHandler(new Request('https://example.com/.netlify/functions/read-noticeboard-unseen-count'))).json() as { count: number }

    expect(before.count).toBe(1)
    expect(after.count).toBe(0)
    expect(board.posts[0]?.unread).toBe(false)
    expect(savePostsSeen).toHaveBeenCalledWith(anette.id, [otherPost.id], '2026-08-13T10:06:00.000Z')
  })

  it('loading the overview keeps unread-comment dots', async () => {
    const handler = createReadNoticeboardPostsFunction({
      authenticate: () => anette,
      loadPosts: vi.fn().mockResolvedValue([ownPost]),
      loadComments: vi.fn().mockResolvedValue([otherCommentOnOwnPost]),
      loadPostReads: vi.fn().mockResolvedValue({}),
      saveLastSeen: vi.fn(),
      savePostsSeen: vi.fn(),
      now: () => '2026-08-13T10:06:00.000Z',
    })

    const body = await (await handler(new Request('https://example.com/.netlify/functions/read-noticeboard-posts'))).json() as {
      posts: Array<{ unread: boolean }>
    }

    expect(body.posts[0]?.unread).toBe(true)
  })

  it('opening one post clears only that post and leaves other posts unread', async () => {
    const readStateByPostId: Record<string, { postSeenThrough?: string; commentsReadThrough?: string }> = {}
    const unreadCommentOnOpenedPost = comment(
      'a23e4567-e89b-42d3-a456-426614174000',
      otherPost.id,
      mads.id,
      '2026-08-13T10:05:30.000Z',
    )
    const unreadCommentOnSecondPost = comment(
      '923e4567-e89b-42d3-a456-426614174000',
      secondOtherPost.id,
      mads.id,
      '2026-08-13T10:06:30.000Z',
    )
    const detailHandler = createReadNoticeboardPostFunction({
      authenticate: () => anette,
      loadPost: vi.fn().mockResolvedValue(otherPost),
      loadComments: vi.fn().mockResolvedValue([unreadCommentOnOpenedPost]),
      savePostRead: async (ownerId, postId, readThrough) => {
        expect(ownerId).toBe(anette.id)
        readStateByPostId[postId] = {
          postSeenThrough: readThrough,
          commentsReadThrough: readThrough,
        }
      },
      now: () => '2026-08-13T10:06:00.000Z',
    })
    const boardHandler = createReadNoticeboardPostsFunction({
      authenticate: () => anette,
      loadPosts: vi.fn().mockResolvedValue([otherPost, secondOtherPost]),
      loadComments: vi.fn().mockResolvedValue([unreadCommentOnOpenedPost, unreadCommentOnSecondPost]),
      loadPostReads: async () => readStateByPostId,
      saveLastSeen: vi.fn(),
      savePostsSeen: vi.fn(),
      now: () => '2026-08-13T10:07:00.000Z',
    })

    await detailHandler(new Request(`https://example.com/.netlify/functions/read-noticeboard-post?id=${otherPost.id}`))
    const body = await (await boardHandler(new Request('https://example.com/.netlify/functions/read-noticeboard-posts'))).json() as {
      posts: Array<{ id: string; unread: boolean }>
    }

    expect(readStateByPostId[otherPost.id]).toEqual({
      postSeenThrough: '2026-08-13T10:06:00.000Z',
      commentsReadThrough: '2026-08-13T10:06:00.000Z',
    })
    expect(body.posts.find((entry) => entry.id === otherPost.id)?.unread).toBe(false)
    expect(body.posts.find((entry) => entry.id === secondOtherPost.id)?.unread).toBe(true)
  })

  it('does not mark a post created after the overview watermark as seen', async () => {
    const postCreatedDuringLoad = post(
      'b23e4567-e89b-42d3-a456-426614174000',
      mads.id,
      '2026-08-13T10:06:01.000Z',
    )
    const savePostsSeen = vi.fn()
    const handler = createReadNoticeboardPostsFunction({
      authenticate: () => anette,
      loadPosts: vi.fn().mockResolvedValue([postCreatedDuringLoad]),
      loadComments: vi.fn().mockResolvedValue([]),
      loadPostReads: vi.fn().mockResolvedValue({}),
      saveLastSeen: vi.fn(),
      savePostsSeen,
      now: () => '2026-08-13T10:06:00.000Z',
    })

    const body = await (await handler(new Request('https://example.com/.netlify/functions/read-noticeboard-posts'))).json() as {
      posts: Array<{ unread: boolean }>
    }

    expect(body.posts[0]?.unread).toBe(true)
    expect(savePostsSeen).toHaveBeenCalledWith(anette.id, [], '2026-08-13T10:06:00.000Z')
  })

  it('a new comment after reading makes the post unread again', () => {
    const laterComment = comment(
      '723e4567-e89b-42d3-a456-426614174000',
      otherPost.id,
      mads.id,
      '2026-08-13T10:07:00.000Z',
    )

    expect(isNoticeboardPostUnread(
      otherPost,
      [laterComment],
      anette.id,
      {
        postSeenThrough: '2026-08-13T10:06:00.000Z',
        commentsReadThrough: '2026-08-13T10:06:00.000Z',
      },
    )).toBe(true)
  })

  it('persists per-post read state for the authenticated family only', async () => {
    const savePostRead = vi.fn()
    const handler = createReadNoticeboardPostFunction({
      authenticate: () => anette,
      loadPost: vi.fn().mockResolvedValue(otherPost),
      loadComments: vi.fn().mockResolvedValue([]),
      savePostRead,
      now: () => '2026-08-13T10:06:00.000Z',
    })

    const response = await handler(new Request(`https://example.com/.netlify/functions/read-noticeboard-post?id=${otherPost.id}`))

    expect(response.status).toBe(200)
    expect(savePostRead).toHaveBeenCalledWith(anette.id, otherPost.id, '2026-08-13T10:06:00.000Z')
  })

  it('does not mark activity arriving after the post load watermark as read', async () => {
    const arrivingComment = comment(
      '823e4567-e89b-42d3-a456-426614174000',
      otherPost.id,
      mads.id,
      '2026-08-13T10:06:01.000Z',
    )
    let persistedReadThrough: string | null = null
    const handler = createReadNoticeboardPostFunction({
      authenticate: () => anette,
      loadPost: vi.fn().mockResolvedValue(otherPost),
      loadComments: vi.fn().mockResolvedValue([arrivingComment]),
      savePostRead: async (_ownerId, _postId, readThrough) => { persistedReadThrough = readThrough },
      now: () => '2026-08-13T10:06:00.000Z',
    })

    await handler(new Request(`https://example.com/.netlify/functions/read-noticeboard-post?id=${otherPost.id}`))

    expect(persistedReadThrough).toBe('2026-08-13T10:06:00.000Z')
    expect(isNoticeboardPostUnread(otherPost, [arrivingComment], anette.id, {
      postSeenThrough: persistedReadThrough ?? undefined,
      commentsReadThrough: persistedReadThrough ?? undefined,
    })).toBe(true)
  })

  it('provides unread state for all posts with one overview data request per source', async () => {
    const loadPosts = vi.fn().mockResolvedValue([otherPost, secondOtherPost])
    const loadComments = vi.fn().mockResolvedValue([otherCommentOnOwnPost])
    const loadPostReads = vi.fn().mockResolvedValue({
      [otherPost.id]: {
        postSeenThrough: '2026-08-13T10:06:00.000Z',
        commentsReadThrough: '2026-08-13T10:06:00.000Z',
      },
    })
    const handler = createReadNoticeboardPostsFunction({
      authenticate: () => anette,
      loadPosts,
      loadComments,
      loadPostReads,
      saveLastSeen: vi.fn(),
      savePostsSeen: vi.fn(),
      now: () => '2026-08-13T10:07:00.000Z',
    })

    const response = await handler(new Request('https://example.com/.netlify/functions/read-noticeboard-posts'))
    const body = await response.json() as { posts: Array<{ unread: boolean }> }

    expect(response.status).toBe(200)
    expect(body.posts).toHaveLength(2)
    expect(loadPosts).toHaveBeenCalledTimes(1)
    expect(loadComments).toHaveBeenCalledTimes(1)
    expect(loadPostReads).toHaveBeenCalledTimes(1)
    expect(loadPostReads).toHaveBeenCalledWith(anette.id)
  })

  it('rejects unauthenticated attempts before any read state is updated', async () => {
    const savePostRead = vi.fn()
    const handler = createReadNoticeboardPostFunction({
      authenticate: () => null,
      loadPost: vi.fn(),
      loadComments: vi.fn(),
      savePostRead,
    })

    const response = await handler(new Request(`https://example.com/.netlify/functions/read-noticeboard-post?id=${otherPost.id}`))

    expect(response.status).toBe(401)
    expect(savePostRead).not.toHaveBeenCalled()
  })
})
