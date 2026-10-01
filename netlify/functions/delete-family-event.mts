import type { Config } from '@netlify/functions'
import { isValidFamilyEventId } from './_shared/family-event-id.mts'
import { deleteFamilyEvent, readFamilyEvent } from './_shared/family-events.mts'
import { deleteNoticeboardPost, readFamilyEventInvitation, unlinkFamilyEventInvitation } from './_shared/noticeboard-posts.mts'
import { clearSessionCookie, getAuthenticatedFamilyMember, jsonResponse } from './_shared/session.mts'

type Dependencies = {
  authenticate: typeof getAuthenticatedFamilyMember
  loadEvent: typeof readFamilyEvent
  removeEvent: typeof deleteFamilyEvent
  loadInvitation: typeof readFamilyEventInvitation
  removePost: typeof deleteNoticeboardPost
  unlinkInvitation: typeof unlinkFamilyEventInvitation
}

export function createDeleteFamilyEventFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadEvent = readFamilyEvent,
  removeEvent = deleteFamilyEvent,
  loadInvitation = readFamilyEventInvitation,
  removePost = deleteNoticeboardPost,
  unlinkInvitation = unlinkFamilyEventInvitation,
}: Partial<Dependencies> = {}) {
  return async function deleteFamilyEventFunction(request: Request) {
    if (request.method !== 'DELETE') return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })

    try {
      const familyMember = authenticate(request)
      if (!familyMember) {
        return jsonResponse(
          { message: 'Økten har utløpt. Logg inn på nytt.' },
          { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
        )
      }

      const eventId = new URL(request.url).searchParams.get('id')
      if (!isValidFamilyEventId(eventId)) return jsonResponse({ message: 'Ugyldig arrangement.' }, { status: 400 })
      const event = await loadEvent(eventId)
      if (!event) return jsonResponse({ message: 'Arrangementet finnes ikke.' }, { status: 404 })
      if (event.ownerId !== familyMember.id) {
        return jsonResponse({ message: 'Du kan bare slette dine egne arrangementer.' }, { status: 403 })
      }

      const deleteLinkedPost = new URL(request.url).searchParams.get('deleteLinkedPost') === 'true'
      const invitation = deleteLinkedPost ? await loadInvitation(eventId) : undefined
      if (deleteLinkedPost && invitation) {
        if (invitation.ownerId !== familyMember.id) {
          return jsonResponse({ message: 'Du kan bare slette dine egne innlegg.' }, { status: 403 })
        }
        if (!await removePost(invitation.id, familyMember.id)) {
          return jsonResponse({ message: 'Invitasjonen kunne ikke slettes. Arrangementet er ikke slettet.' }, { status: 409 })
        }
      }
      await unlinkInvitation(eventId)
      await removeEvent(eventId)
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
    } catch {
      return jsonResponse({ message: 'Kunne ikke slette arrangementet. Prøv igjen.' }, { status: 500 })
    }
  }
}

export default createDeleteFamilyEventFunction()

export const config: Config = { method: 'DELETE' }
