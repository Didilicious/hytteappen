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
})
