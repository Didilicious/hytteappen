import type { Config } from '@netlify/functions'
import { prepareOpenNoticeboardPosts } from './_shared/noticeboard-input.mts'
import { readOpenNoticeboardPosts } from './_shared/noticeboard-posts.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type ReadNoticeboardPostsDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  loadPosts: typeof readOpenNoticeboardPosts
}

export function createReadNoticeboardPostsFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadPosts = readOpenNoticeboardPosts,
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

      return jsonResponse({ posts: prepareOpenNoticeboardPosts(await loadPosts()) })
    } catch {
      return jsonResponse({ message: 'Kunne ikke hente innleggene.' }, { status: 500 })
    }
  }
}

export default createReadNoticeboardPostsFunction()

export const config: Config = {
  method: 'GET',
}
