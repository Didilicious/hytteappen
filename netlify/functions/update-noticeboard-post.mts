import type { Config } from '@netlify/functions'
import { isValidNoticeboardPostId } from './_shared/noticeboard-id.mts'
import { prepareNoticeboardPost } from './_shared/noticeboard-input.mts'
import { readNoticeboardPost, updateNoticeboardPost } from './_shared/noticeboard-posts.mts'
import { clearSessionCookie, getAuthenticatedFamilyMember, jsonResponse } from './_shared/session.mts'

type Dependencies = {
  authenticate: typeof getAuthenticatedFamilyMember
  loadPost: typeof readNoticeboardPost
  savePost: typeof updateNoticeboardPost
  now: () => string
}

export function createUpdateNoticeboardPostFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadPost = readNoticeboardPost,
  savePost = updateNoticeboardPost,
  now = () => new Date().toISOString(),
}: Partial<Dependencies> = {}) {
  return async function updatePost(request: Request) {
    if (request.method !== 'PATCH') return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
    try {
      const family = authenticate(request)
      if (!family) return jsonResponse({ message: 'Økten har utløpt. Logg inn på nytt.' }, {
        status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) },
      })
      const postId = new URL(request.url).searchParams.get('id')
      if (!isValidNoticeboardPostId(postId)) return jsonResponse({ message: 'Ugyldig innlegg.' }, { status: 400 })
      const existingPost = await loadPost(postId)
      if (!existingPost) return jsonResponse({ message: 'Innlegget finnes ikke.' }, { status: 404 })
      if (existingPost.ownerId !== family.id) return jsonResponse({ message: 'Du kan bare endre dine egne innlegg.' }, { status: 403 })
      const input = await request.json().catch(() => null)
      if (!input || typeof input !== 'object' || Array.isArray(input)) return jsonResponse({ message: 'Kontroller innlegget og prøv igjen.' }, { status: 400 })
      const timestamp = now()
      const content = prepareNoticeboardPost({ title: input.title, description: input.description, type: existingPost.type }, {
        id: postId, ownerId: family.id, timestamp,
      })
      if (!content) return jsonResponse({ message: 'Skriv en tittel på maks 160 tegn og en tekst på maks 2000 tegn.' }, { status: 400 })
      const post = await savePost(postId, family.id, { title: content.title, description: content.description }, timestamp)
      if (!post) return jsonResponse({ message: 'Innlegget kunne ikke oppdateres.' }, { status: 409 })
      return jsonResponse({ post })
    } catch {
      return jsonResponse({ message: 'Kunne ikke lagre innlegget. Prøv igjen.' }, { status: 500 })
    }
  }
}

export default createUpdateNoticeboardPostFunction()
export const config: Config = { method: 'PATCH' }
