import { describe, expect, it, vi } from 'vitest'
import { createDeleteFamilyEventFunction } from '../netlify/functions/delete-family-event.mts'
import type { FamilyEvent } from '../shared/familyEvents'
import type { NoticeboardPost } from '../shared/noticeboard'

const event: FamilyEvent = {
  id: '123e4567-e89b-42d3-a456-426614174000', ownerId: 'mads', eventType: 'family-dinner', title: 'Familiemiddag',
  startDate: '2026-10-18', endDate: null, startTime: '', endTime: '', location: '', wishlistUrl: '', moreInfo: '', createdAt: '', updatedAt: '',
}
const invitation: NoticeboardPost = {
  id: '223e4567-e89b-42d3-a456-426614174000', ownerId: 'mads', type: 'Info', title: 'Invitasjon', description: '',
  eventId: event.id, status: 'open', createdAt: '', updatedAt: '',
}

function dependencies() {
  return {
    authenticate: () => ({ id: 'mads', displayName: 'Mads' }),
    loadEvent: vi.fn().mockResolvedValue(event),
    loadInvitation: vi.fn().mockResolvedValue(invitation),
    unlinkInvitation: vi.fn().mockResolvedValue(undefined),
    removeEvent: vi.fn().mockResolvedValue(undefined),
    removePost: vi.fn().mockResolvedValue(true),
  }
}

function request(choice = '') {
  return new Request(`https://example.com/event?id=${event.id}${choice}`, { method: 'DELETE' })
}

describe('safe linked family event deletion', () => {
  it.each(['', '&deleteLinkedPost=false', '&deleteLinkedPost=1', '&deleteLinkedPost=yes'])('keeps and unlinks the invitation without explicit consent (%s)', async (choice) => {
    const deps = dependencies()
    expect((await createDeleteFamilyEventFunction(deps)(request(choice))).status).toBe(204)
    expect(deps.removePost).not.toHaveBeenCalled()
    expect(deps.unlinkInvitation).toHaveBeenCalledWith(event.id)
    expect(deps.removeEvent).toHaveBeenCalledWith(event.id)
    expect(deps.unlinkInvitation.mock.invocationCallOrder[0]).toBeLessThan(deps.removeEvent.mock.invocationCallOrder[0])
  })

  it('deletes both only after explicit consent', async () => {
    const deps = dependencies()
    expect((await createDeleteFamilyEventFunction(deps)(request('&deleteLinkedPost=true'))).status).toBe(204)
    expect(deps.removePost).toHaveBeenCalledWith(invitation.id, 'mads')
    expect(deps.removeEvent).toHaveBeenCalledWith(event.id)
  })

  it('deletes an event when its invitation has already disappeared', async () => {
    const deps = dependencies()
    deps.loadInvitation.mockResolvedValue(undefined)
    expect((await createDeleteFamilyEventFunction(deps)(request('&deleteLinkedPost=true'))).status).toBe(204)
    expect(deps.removePost).not.toHaveBeenCalled()
    expect(deps.removeEvent).toHaveBeenCalledWith(event.id)
  })

  it('does not delete another family’s linked post or the event when both are requested', async () => {
    const deps = dependencies()
    deps.loadInvitation.mockResolvedValue({ ...invitation, ownerId: 'anette' })
    expect((await createDeleteFamilyEventFunction(deps)(request('&deleteLinkedPost=true'))).status).toBe(403)
    expect(deps.removePost).not.toHaveBeenCalled()
    expect(deps.unlinkInvitation).not.toHaveBeenCalled()
    expect(deps.removeEvent).not.toHaveBeenCalled()
  })

  it('can delete the owned event while retaining and unlinking another family’s invitation', async () => {
    const deps = dependencies()
    deps.loadInvitation.mockResolvedValue({ ...invitation, ownerId: 'anette' })
    expect((await createDeleteFamilyEventFunction(deps)(request())).status).toBe(204)
    expect(deps.removePost).not.toHaveBeenCalled()
    expect(deps.unlinkInvitation).toHaveBeenCalledWith(event.id)
  })

  it.each([null, { id: 'anette', displayName: 'Anette' }])('blocks unauthorized deletion before loading the invitation (%s)', async (family) => {
    const deps = dependencies()
    const response = await createDeleteFamilyEventFunction({ ...deps, authenticate: () => family })(request('&deleteLinkedPost=true'))
    expect(response.status).toBe(family ? 403 : 401)
    expect(deps.loadInvitation).not.toHaveBeenCalled()
    expect(deps.removePost).not.toHaveBeenCalled()
    expect(deps.removeEvent).not.toHaveBeenCalled()
  })

  it('keeps the event when removing the invitation fails', async () => {
    const deps = dependencies()
    deps.removePost.mockResolvedValue(false)
    expect((await createDeleteFamilyEventFunction(deps)(request('&deleteLinkedPost=true'))).status).toBe(409)
    expect(deps.removeEvent).not.toHaveBeenCalled()
  })

  it('keeps the event when unlinking the invitation fails', async () => {
    const deps = dependencies()
    deps.unlinkInvitation.mockRejectedValue(new Error('Database unavailable'))
    expect((await createDeleteFamilyEventFunction(deps)(request())).status).toBe(500)
    expect(deps.removeEvent).not.toHaveBeenCalled()
    expect(deps.removePost).not.toHaveBeenCalled()
  })
})
