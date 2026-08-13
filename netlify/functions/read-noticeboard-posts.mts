import type { Config } from '@netlify/functions'
import { prepareOpenNoticeboardPosts } from './_shared/noticeboard-input.mts'
import {
  isNoticeboardPostUnread,
  readNoticeboardPostReads,
  saveNoticeboardLastSeen,
  saveNoticeboardPostsSeen,
} from './_shared/noticeboard-activity.mts'
import { readAllNoticeboardComments } from './_shared/noticeboard-comments.mts'
import { readAllNoticeboardPosts } from './_shared/noticeboard-posts.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type ReadNoticeboardPostsDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  loadPosts: typeof readAllNoticeboardPosts
  loadComments: typeof readAllNoticeboardComments
  loadPostReads: typeof readNoticeboardPostReads
  saveLastSeen: typeof saveNoticeboardLastSeen
  savePostsSeen: typeof saveNoticeboardPostsSeen
  now: () => string
}

export function createReadNoticeboardPostsFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadPosts = readAllNoticeboardPosts,
  loadComments = readAllNoticeboardComments,
  loadPostReads = readNoticeboardPostReads,
  saveLastSeen = saveNoticeboardLastSeen,
  savePostsSeen = saveNoticeboardPostsSeen,
  now = () => new Date().toISOString(),
}: Partial<ReadNoticeboardPostsDependencies> = {}) {
  return async function readNoticeboardPostsFunction(request: Request) {
    if (request.method !== 'GET') {
      return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
    }

    try {
      const familyMember = authenticate(request)
      if (!familyMember) {
        return jsonResponse(
          { message: 'Økten har utløpt. Logg inn på nytt.' },
          { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
        )
      }

      const seenThrough = now()
      const [allPosts, comments, readThroughByPostId] = await Promise.all([
        loadPosts(),
        loadComments(),
        loadPostReads(familyMember.id),
      ])
      const commentCounts = comments.reduce<Record<string, number>>((counts, comment) => {
        counts[comment.postId] = (counts[comment.postId] ?? 0) + 1
        return counts
      }, {})
      const openPosts = prepareOpenNoticeboardPosts(allPosts)
      const visiblePostIds = openPosts
        .filter((post) => post.createdAt <= seenThrough)
        .map((post) => post.id)
      const posts = openPosts.map((post) => ({
        ...post,
        commentCount: commentCounts[post.id] ?? 0,
        unread: isNoticeboardPostUnread(
          post,
          comments,
          familyMember.id,
          {
            ...readThroughByPostId[post.id],
            postSeenThrough: visiblePostIds.includes(post.id)
              ? seenThrough
              : readThroughByPostId[post.id]?.postSeenThrough,
          },
        ),
      }))
      await Promise.all([
        saveLastSeen(familyMember.id, seenThrough),
        savePostsSeen(familyMember.id, visiblePostIds, seenThrough),
      ])

      return jsonResponse({ posts, seenThrough })
    } catch {
      return jsonResponse({ message: 'Kunne ikke hente innleggene.' }, { status: 500 })
    }
  }
}

export default createReadNoticeboardPostsFunction()

export const config: Config = {
  method: 'GET',
}
