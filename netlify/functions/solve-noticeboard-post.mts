import type { Config } from '@netlify/functions'
import { isValidNoticeboardPostId } from './_shared/noticeboard-id.mts'
import {
  readNoticeboardPost,
  solveNoticeboardPost,
} from './_shared/noticeboard-posts.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type SolveNoticeboardPostDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  loadPost: typeof readNoticeboardPost
  saveSolvedPost: typeof solveNoticeboardPost
  now: () => string
}

export function createSolveNoticeboardPostFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadPost = readNoticeboardPost,
  saveSolvedPost = solveNoticeboardPost,
  now = () => new Date().toISOString(),
}: Partial<SolveNoticeboardPostDependencies> = {}) {
  return async function solveNoticeboardPostFunction(request: Request) {
    if (request.method !== 'PATCH') {
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

      const existingPost = await loadPost(postId)
      if (!existingPost) {
        return jsonResponse({ message: 'Innlegget finnes ikke.' }, { status: 404 })
      }

      if (existingPost.ownerId !== familyMember.id) {
        return jsonResponse({ message: 'Du kan bare endre dine egne innlegg.' }, { status: 403 })
      }

      const post = await saveSolvedPost(postId, familyMember.id, now())
      if (!post) {
        return jsonResponse({ message: 'Innlegget kunne ikke oppdateres.' }, { status: 409 })
      }

      return jsonResponse({ post })
    } catch {
      return jsonResponse({ message: 'Kunne ikke markere innlegget som løst.' }, { status: 500 })
    }
  }
}

export default createSolveNoticeboardPostFunction()

export const config: Config = {
  method: 'PATCH',
}
