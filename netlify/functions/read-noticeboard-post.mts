import type { Config } from '@netlify/functions'
import { saveNoticeboardPostRead } from './_shared/noticeboard-activity.mts'
import { readNoticeboardComments } from './_shared/noticeboard-comments.mts'
import { isValidNoticeboardPostId } from './_shared/noticeboard-id.mts'
import { readNoticeboardPost } from './_shared/noticeboard-posts.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type ReadNoticeboardPostDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  loadPost: typeof readNoticeboardPost
  loadComments: typeof readNoticeboardComments
  savePostRead: typeof saveNoticeboardPostRead
  now: () => string
}

export function createReadNoticeboardPostFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadPost = readNoticeboardPost,
  loadComments = readNoticeboardComments,
  savePostRead = saveNoticeboardPostRead,
  now = () => new Date().toISOString(),
}: Partial<ReadNoticeboardPostDependencies> = {}) {
  return async function readNoticeboardPostFunction(request: Request) {
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

      const postId = new URL(request.url).searchParams.get('id')
      if (!isValidNoticeboardPostId(postId)) {
        return jsonResponse({ message: 'Ugyldig innlegg.' }, { status: 400 })
      }

      const readThrough = now()
      const [postResult, commentsResult] = await Promise.allSettled([
        loadPost(postId),
        loadComments(postId),
      ])
      if (postResult.status === 'rejected') throw postResult.reason

      const post = postResult.value
      if (!post) return jsonResponse({ message: 'Innlegget finnes ikke.' }, { status: 404 })

      if (commentsResult.status === 'rejected') {
        return jsonResponse({ post, comments: null, readThrough })
      }

      await savePostRead(familyMember.id, postId, readThrough)

      return jsonResponse({ post, comments: commentsResult.value, readThrough })
    } catch {
      return jsonResponse({ message: 'Kunne ikke hente innlegget.' }, { status: 500 })
    }
  }
}

export default createReadNoticeboardPostFunction()

export const config: Config = {
  method: 'GET',
}
