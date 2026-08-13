import type { Config } from '@netlify/functions'
import { saveNoticeboardPostRead } from './_shared/noticeboard-activity.mts'
import { isValidNoticeboardPostId } from './_shared/noticeboard-id.mts'
import { readNoticeboardComments } from './_shared/noticeboard-comments.mts'
import { readNoticeboardPost } from './_shared/noticeboard-posts.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type ReadNoticeboardCommentsDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  loadPost: typeof readNoticeboardPost
  loadComments: typeof readNoticeboardComments
  savePostRead: typeof saveNoticeboardPostRead
  now: () => string
}

export function createReadNoticeboardCommentsFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadPost = readNoticeboardPost,
  loadComments = readNoticeboardComments,
  savePostRead = saveNoticeboardPostRead,
  now = () => new Date().toISOString(),
}: Partial<ReadNoticeboardCommentsDependencies> = {}) {
  return async function readNoticeboardCommentsFunction(request: Request) {
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

      const postId = new URL(request.url).searchParams.get('postId')
      if (!isValidNoticeboardPostId(postId)) {
        return jsonResponse({ message: 'Ugyldig innlegg.' }, { status: 400 })
      }

      const readThrough = now()
      if (!await loadPost(postId)) {
        return jsonResponse({ message: 'Innlegget finnes ikke.' }, { status: 404 })
      }

      const comments = await loadComments(postId)
      await savePostRead(familyMember.id, postId, readThrough)

      return jsonResponse({ comments, readThrough })
    } catch {
      return jsonResponse({ message: 'Kunne ikke hente kommentarene.' }, { status: 500 })
    }
  }
}

export default createReadNoticeboardCommentsFunction()

export const config: Config = {
  method: 'GET',
}
