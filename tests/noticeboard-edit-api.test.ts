import { describe, expect, it, vi } from 'vitest'
import { createUpdateNoticeboardPostFunction } from '../netlify/functions/update-noticeboard-post.mts'
import type { NoticeboardPost } from '../shared/noticeboard'

const post: NoticeboardPost = {
  id: '123e4567-e89b-42d3-a456-426614174000', ownerId: 'mads', type: 'Info', title: 'Invitasjon', description: '',
  eventId: '223e4567-e89b-42d3-a456-426614174000', status: 'open', createdAt: '', updatedAt: '',
}

function dependencies() {
  return {
    authenticate: () => ({ id: 'mads', displayName: 'Mads' }),
    loadPost: vi.fn().mockResolvedValue(post),
    savePost: vi.fn().mockResolvedValue(post),
    now: () => '2026-10-01T10:00:00.000Z',
  }
}

function request(input: unknown = { title: 'Ta med dessert!', description: 'Vi gleder oss.' }) {
  return new Request(`https://example.com/post?id=${post.id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

describe('independent noticeboard post editing', () => {
  it('updates content without allowing clients to replace the event ID or owner', async () => {
    const deps = dependencies()
    const response = await createUpdateNoticeboardPostFunction(deps)(request({
      title: ' Ta med dessert! ', description: ' Vi gleder oss. ', eventId: null, ownerId: 'anette', type: 'Må gjøres',
    }))
    expect(response.status).toBe(200)
    expect(deps.savePost).toHaveBeenCalledWith(post.id, 'mads', {
      title: 'Ta med dessert!', description: 'Vi gleder oss.',
    }, deps.now())
    expect(await response.json()).toEqual({ post })
  })

  it('rejects unauthenticated or non-owner edits', async () => {
    const deps = dependencies()
    expect((await createUpdateNoticeboardPostFunction({ ...deps, authenticate: () => null })(request())).status).toBe(401)
    expect((await createUpdateNoticeboardPostFunction({ ...deps, authenticate: () => ({ id: 'anette', displayName: 'Anette' }) })(request())).status).toBe(403)
    expect(deps.savePost).not.toHaveBeenCalled()
  })

  it.each([null, [], { title: '' }, { title: 'A'.repeat(161) }, { title: 'Invitasjon', description: 'A'.repeat(2001) }])('rejects invalid post content: %j', async (input) => {
    const deps = dependencies()
    expect((await createUpdateNoticeboardPostFunction(deps)(request(input))).status).toBe(400)
    expect(deps.savePost).not.toHaveBeenCalled()
  })
})
