import type { Config } from '@netlify/functions'
import {
  countUnseenNoticeboardActivity,
  readNoticeboardLastSeen,
} from './_shared/noticeboard-activity.mts'
import { readAllNoticeboardComments } from './_shared/noticeboard-comments.mts'
import { readAllNoticeboardPosts } from './_shared/noticeboard-posts.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type ReadNoticeboardUnseenCountDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  loadPosts: typeof readAllNoticeboardPosts
  loadComments: typeof readAllNoticeboardComments
  loadLastSeen: typeof readNoticeboardLastSeen
}

export function createReadNoticeboardUnseenCountFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadPosts = readAllNoticeboardPosts,
  loadComments = readAllNoticeboardComments,
  loadLastSeen = readNoticeboardLastSeen,
}: Partial<ReadNoticeboardUnseenCountDependencies> = {}) {
  return async function readNoticeboardUnseenCountFunction(request: Request) {
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

      const [posts, comments, seenThrough] = await Promise.all([
        loadPosts(),
        loadComments(),
        loadLastSeen(familyMember.id),
      ])

      return jsonResponse({
        count: countUnseenNoticeboardActivity(posts, comments, familyMember.id, seenThrough),
      })
    } catch {
      return jsonResponse({ message: 'Kunne ikke hente nye aktiviteter.' }, { status: 500 })
    }
  }
}

export default createReadNoticeboardUnseenCountFunction()

export const config: Config = {
  method: 'GET',
}
