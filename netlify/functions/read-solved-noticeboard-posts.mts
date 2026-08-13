import type { Config } from '@netlify/functions'
import { prepareSolvedNoticeboardPosts } from './_shared/noticeboard-input.mts'
import { readAllNoticeboardComments } from './_shared/noticeboard-comments.mts'
import { readAllNoticeboardPosts } from './_shared/noticeboard-posts.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type ReadSolvedNoticeboardPostsDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  loadPosts: typeof readAllNoticeboardPosts
  loadComments: typeof readAllNoticeboardComments
}

export function createReadSolvedNoticeboardPostsFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadPosts = readAllNoticeboardPosts,
  loadComments = readAllNoticeboardComments,
}: Partial<ReadSolvedNoticeboardPostsDependencies> = {}) {
  return async function readSolvedNoticeboardPostsFunction(request: Request) {
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

      const [allPosts, comments] = await Promise.all([loadPosts(), loadComments()])
      const commentCounts = comments.reduce<Record<string, number>>((counts, comment) => {
        counts[comment.postId] = (counts[comment.postId] ?? 0) + 1
        return counts
      }, {})
      const posts = prepareSolvedNoticeboardPosts(allPosts).map((post) => ({
        ...post,
        commentCount: commentCounts[post.id] ?? 0,
      }))

      return jsonResponse({ posts })
    } catch {
      return jsonResponse({ message: 'Kunne ikke hente løste innlegg.' }, { status: 500 })
    }
  }
}

export default createReadSolvedNoticeboardPostsFunction()

export const config: Config = {
  method: 'GET',
}
