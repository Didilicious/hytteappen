import { randomUUID } from 'node:crypto'
import type { Config } from '@netlify/functions'
import {
  prepareNoticeboardComment,
  type NoticeboardCommentInput,
} from './_shared/noticeboard-comment-input.mts'
import { saveNoticeboardComment } from './_shared/noticeboard-comments.mts'
import { isValidNoticeboardPostId } from './_shared/noticeboard-id.mts'
import { readNoticeboardPost } from './_shared/noticeboard-posts.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type CreateNoticeboardCommentDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  loadPost: typeof readNoticeboardPost
  saveComment: typeof saveNoticeboardComment
  createId: () => string
  now: () => string
}

export function createCreateNoticeboardCommentFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadPost = readNoticeboardPost,
  saveComment = saveNoticeboardComment,
  createId = randomUUID,
  now = () => new Date().toISOString(),
}: Partial<CreateNoticeboardCommentDependencies> = {}) {
  return async function createNoticeboardCommentFunction(request: Request) {
    if (request.method !== 'POST') {
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

      if (!await loadPost(postId)) {
        return jsonResponse({ message: 'Innlegget finnes ikke.' }, { status: 404 })
      }

      const input = await request.json().catch(() => null) as NoticeboardCommentInput | null
      const requestedId = input?.idempotencyKey
      if (requestedId !== undefined && !isValidNoticeboardPostId(requestedId)) {
        return jsonResponse({ message: 'Ugyldig kommentar.' }, { status: 400 })
      }

      const timestamp = now()
      const comment = input && prepareNoticeboardComment(input, {
        id: typeof requestedId === 'string' ? requestedId : createId(),
        postId,
        ownerId: familyMember.id,
        timestamp,
      })

      if (!comment) {
        return jsonResponse({ message: 'Skriv en kommentar før du sender.' }, { status: 400 })
      }

      return jsonResponse({ comment: await saveComment(comment) }, { status: 201 })
    } catch {
      return jsonResponse({ message: 'Kunne ikke lagre kommentaren. Prøv igjen.' }, { status: 500 })
    }
  }
}

export default createCreateNoticeboardCommentFunction()

export const config: Config = {
  method: 'POST',
}
