import { describe, expect, it, vi } from 'vitest'
import { createDeleteNoticeboardPostFunction } from '../netlify/functions/delete-noticeboard-post.mts'
import type { NoticeboardPost } from '../shared/noticeboard'

const post: NoticeboardPost = {
  id: '123e4567-e89b-42d3-a456-426614174000', ownerId: 'mads', type: 'Info', title: 'Invitasjon', description: '',
  eventId: '223e4567-e89b-42d3-a456-426614174000', status: 'open', createdAt: '', updatedAt: '',
}

function dependencies() {
  return {
    authenticate: () => ({ id: 'mads', displayName: 'Mads' }),
    loadPost: vi.fn().mockResolvedValue(post),
    removePost: vi.fn().mockResolvedValue(true),
    loadEvent: vi.fn().mockResolvedValue({ id: post.eventId, ownerId: 'mads' }),
    removeEvent: vi.fn().mockResolvedValue(undefined),
    unlinkInvitation: vi.fn().mockResolvedValue(undefined),
  }
}

function request(method = 'DELETE', id = post.id) {
  return new Request(`https://example.com/post?id=${id}`, { method })
}

describe('owner-only noticeboard deletion', () => {
  it.each([undefined, post.eventId])('deletes an owned ordinary or invitation post (%s)', async (eventId) => {
    const deps = dependencies()
    deps.loadPost.mockResolvedValue({ ...post, eventId })
    const response = await createDeleteNoticeboardPostFunction(deps)(request())
    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(deps.removePost).toHaveBeenCalledExactlyOnceWith(post.id, 'mads')
    expect(deps.loadEvent).not.toHaveBeenCalled()
    expect(deps.removeEvent).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated deletion without loading or deleting a post', async () => {
    const deps = dependencies()
    expect((await createDeleteNoticeboardPostFunction({ ...deps, authenticate: () => null })(request())).status).toBe(401)
    expect(deps.loadPost).not.toHaveBeenCalled()
    expect(deps.removePost).not.toHaveBeenCalled()
  })

  it('prevents another family from deleting the post', async () => {
    const deps = dependencies()
    expect((await createDeleteNoticeboardPostFunction({ ...deps, authenticate: () => ({ id: 'anette', displayName: 'Anette' }) })(request())).status).toBe(403)
    expect(deps.removePost).not.toHaveBeenCalled()
  })

  it('rejects invalid IDs before reading storage', async () => {
    const deps = dependencies()
    expect((await createDeleteNoticeboardPostFunction(deps)(request('DELETE', 'invalid'))).status).toBe(400)
    expect(deps.loadPost).not.toHaveBeenCalled()
    expect(deps.removePost).not.toHaveBeenCalled()
  })

  it('returns not found without attempting deletion', async () => {
    const deps = dependencies()
    deps.loadPost.mockResolvedValue(undefined)
    expect((await createDeleteNoticeboardPostFunction(deps)(request())).status).toBe(404)
    expect(deps.removePost).not.toHaveBeenCalled()
  })

  it('does not report success when storage did not delete the post', async () => {
    const deps = dependencies()
    deps.removePost.mockResolvedValue(false)
    expect((await createDeleteNoticeboardPostFunction(deps)(request())).status).toBe(409)
  })

  it('handles storage failures', async () => {
    const deps = dependencies()
    deps.removePost.mockRejectedValue(new Error('Database unavailable'))
    expect((await createDeleteNoticeboardPostFunction(deps)(request())).status).toBe(500)
  })

  it('rejects other methods before touching storage', async () => {
    const deps = dependencies()
    expect((await createDeleteNoticeboardPostFunction(deps)(request('POST'))).status).toBe(405)
    expect(deps.loadPost).not.toHaveBeenCalled()
    expect(deps.removePost).not.toHaveBeenCalled()
  })

  it('deletes the linked event only with explicit confirmation, unlinking first', async () => {
    const deps = dependencies()
    const response = await createDeleteNoticeboardPostFunction(deps)(new Request(`${request().url}&deleteLinkedEvent=true`, { method: 'DELETE' }))
    expect(response.status).toBe(204)
    expect(deps.loadEvent).toHaveBeenCalledWith(post.eventId)
    expect(deps.unlinkInvitation).toHaveBeenCalledWith(post.eventId)
    expect(deps.removeEvent).toHaveBeenCalledWith(post.eventId)
    expect(deps.unlinkInvitation.mock.invocationCallOrder[0]).toBeLessThan(deps.removeEvent.mock.invocationCallOrder[0])
    expect(deps.removePost).toHaveBeenCalledWith(post.id, 'mads')
  })

  it.each(['false', '1', 'yes'])('does not treat %s as consent to delete the event', async (choice) => {
    const deps = dependencies()
    expect((await createDeleteNoticeboardPostFunction(deps)(new Request(`${request().url}&deleteLinkedEvent=${choice}`, { method: 'DELETE' }))).status).toBe(204)
    expect(deps.removeEvent).not.toHaveBeenCalled()
  })

  it('does not delete either side when the linked event belongs to another family', async () => {
    const deps = dependencies()
    deps.loadEvent.mockResolvedValue({ id: post.eventId, ownerId: 'anette' })
    expect((await createDeleteNoticeboardPostFunction(deps)(new Request(`${request().url}&deleteLinkedEvent=true`, { method: 'DELETE' }))).status).toBe(403)
    expect(deps.unlinkInvitation).not.toHaveBeenCalled()
    expect(deps.removeEvent).not.toHaveBeenCalled()
    expect(deps.removePost).not.toHaveBeenCalled()
  })

  it('still deletes a post if its linked event no longer exists', async () => {
    const deps = dependencies()
    deps.loadEvent.mockResolvedValue(null)
    expect((await createDeleteNoticeboardPostFunction(deps)(new Request(`${request().url}&deleteLinkedEvent=true`, { method: 'DELETE' }))).status).toBe(204)
    expect(deps.removeEvent).not.toHaveBeenCalled()
    expect(deps.removePost).toHaveBeenCalledWith(post.id, 'mads')
  })

  it('stops deletion if removing the event fails, leaving the retained post unlinked', async () => {
    const deps = dependencies()
    deps.removeEvent.mockRejectedValue(new Error('Storage unavailable'))
    expect((await createDeleteNoticeboardPostFunction(deps)(new Request(`${request().url}&deleteLinkedEvent=true`, { method: 'DELETE' }))).status).toBe(500)
    expect(deps.unlinkInvitation).toHaveBeenCalledWith(post.eventId)
    expect(deps.removePost).not.toHaveBeenCalled()
  })

  it('does not delete either side if unlinking fails', async () => {
    const deps = dependencies()
    deps.unlinkInvitation.mockRejectedValue(new Error('Database unavailable'))
    expect((await createDeleteNoticeboardPostFunction(deps)(new Request(`${request().url}&deleteLinkedEvent=true`, { method: 'DELETE' }))).status).toBe(500)
    expect(deps.removeEvent).not.toHaveBeenCalled()
    expect(deps.removePost).not.toHaveBeenCalled()
  })

  it('leaves a retained post unlinked if post deletion fails after the event was removed', async () => {
    const deps = dependencies()
    deps.removePost.mockResolvedValue(false)
    expect((await createDeleteNoticeboardPostFunction(deps)(new Request(`${request().url}&deleteLinkedEvent=true`, { method: 'DELETE' }))).status).toBe(409)
    expect(deps.unlinkInvitation).toHaveBeenCalledWith(post.eventId)
    expect(deps.removeEvent).toHaveBeenCalledWith(post.eventId)
  })
})
