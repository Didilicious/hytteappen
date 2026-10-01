import type { Config } from '@netlify/functions'
import { isValidNoticeboardPostId } from './_shared/noticeboard-id.mts'
import { deleteNoticeboardPost, readNoticeboardPost, unlinkFamilyEventInvitation } from './_shared/noticeboard-posts.mts'
import { deleteFamilyEvent, readFamilyEvent } from './_shared/family-events.mts'
import { clearSessionCookie, getAuthenticatedFamilyMember, jsonResponse } from './_shared/session.mts'

type Dependencies = {
  authenticate: typeof getAuthenticatedFamilyMember
  loadPost: typeof readNoticeboardPost
  removePost: typeof deleteNoticeboardPost
  loadEvent: typeof readFamilyEvent
  removeEvent: typeof deleteFamilyEvent
  unlinkInvitation: typeof unlinkFamilyEventInvitation
}

export function createDeleteNoticeboardPostFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadPost = readNoticeboardPost,
  removePost = deleteNoticeboardPost,
  loadEvent = readFamilyEvent,
  removeEvent = deleteFamilyEvent,
  unlinkInvitation = unlinkFamilyEventInvitation,
}: Partial<Dependencies> = {}) {
  return async function deletePost(request: Request) {
    if (request.method !== 'DELETE') return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
    try {
      const family = authenticate(request)
      if (!family) return jsonResponse({ message: 'Økten har utløpt. Logg inn på nytt.' }, {
        status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) },
      })
      const postId = new URL(request.url).searchParams.get('id')
      if (!isValidNoticeboardPostId(postId)) return jsonResponse({ message: 'Ugyldig innlegg.' }, { status: 400 })
      const post = await loadPost(postId)
      if (!post) return jsonResponse({ message: 'Innlegget finnes ikke.' }, { status: 404 })
      if (post.ownerId !== family.id) return jsonResponse({ message: 'Du kan bare slette dine egne innlegg.' }, { status: 403 })
      if (post.eventId && new URL(request.url).searchParams.get('deleteLinkedEvent') === 'true') {
        const event = await loadEvent(post.eventId)
        if (event) {
          if (event.ownerId !== family.id) return jsonResponse({ message: 'Du kan bare slette dine egne arrangementer.' }, { status: 403 })
          await unlinkInvitation(event.id)
          await removeEvent(event.id)
        }
      }
      if (!await removePost(postId, family.id)) return jsonResponse({ message: 'Innlegget kunne ikke slettes.' }, { status: 409 })
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
    } catch {
      return jsonResponse({ message: 'Kunne ikke slette innlegget. Prøv igjen.' }, { status: 500 })
    }
  }
}

export default createDeleteNoticeboardPostFunction()
export const config: Config = { method: 'DELETE' }
