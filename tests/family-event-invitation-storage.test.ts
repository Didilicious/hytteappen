import { beforeEach, describe, expect, it, vi } from 'vitest'
import { noticeboardPosts } from '../db/schema'
import { createFamilyEventInvitation, deleteNoticeboardPost, updateNoticeboardPost } from '../netlify/functions/_shared/noticeboard-posts.mts'
import { and, eq } from 'drizzle-orm'
import type { FamilyEvent } from '../shared/familyEvents'

const database = vi.hoisted(() => ({ insert: vi.fn(), select: vi.fn(), update: vi.fn(), delete: vi.fn() }))
vi.mock('../db/index.ts', () => ({ getDb: () => database }))

const event: FamilyEvent = {
  id: '123e4567-e89b-42d3-a456-426614174000', ownerId: 'mads', eventType: 'family-dinner', title: 'Søndagsmiddag',
  startDate: '2026-10-18', endDate: null, startTime: '16:00', endTime: '19:00', location: 'Skogveien 1',
  wishlistUrl: '', moreInfo: '', createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z',
}

describe('persistent invitation posts', () => {
  beforeEach(() => vi.clearAllMocks())

  function insertReturning(posts: unknown[]) {
    const returning = vi.fn().mockResolvedValue(posts)
    const onConflictDoNothing = vi.fn().mockReturnValue({ returning })
    const values = vi.fn().mockReturnValue({ onConflictDoNothing })
    database.insert.mockReturnValue({ values })
    return { values, onConflictDoNothing }
  }

  it('creates an ordinary organizer-owned Info post linked by event ID', async () => {
    const { values, onConflictDoNothing } = insertReturning([{ id: 'post', eventId: event.id }])
    await createFamilyEventInvitation(event)
    expect(database.insert).toHaveBeenCalledWith(noticeboardPosts)
    expect(values).toHaveBeenCalledWith({
      id: expect.any(String), ownerId: event.ownerId, type: 'Info', status: 'open',
      title: 'Invitasjon: Søndagsmiddag', description: expect.any(String), eventId: event.id,
      createdAt: event.createdAt, updatedAt: event.createdAt,
    })
    expect(onConflictDoNothing).toHaveBeenCalledWith({ target: noticeboardPosts.eventId })
  })

  it('keeps an existing invitation and its manually edited text on repeat creation', async () => {
    const existingPost = { id: 'post', eventId: event.id, title: 'Min egen tittel', description: 'Ta med dessert!', status: 'solved' }
    const { onConflictDoNothing } = insertReturning([])
    const limit = vi.fn().mockResolvedValue([existingPost])
    const where = vi.fn().mockReturnValue({ limit })
    database.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where }) })
    expect(await createFamilyEventInvitation({ ...event, title: 'Endret arrangement' })).toEqual(existingPost)
    expect(onConflictDoNothing).toHaveBeenCalledWith({ target: noticeboardPosts.eventId })
    expect(where).toHaveBeenCalledOnce()
    expect(database.update).not.toHaveBeenCalled()
  })

  it('caps the initial post title at the normal editable title limit', async () => {
    const { values } = insertReturning([{ id: 'post' }])
    await createFamilyEventInvitation({ ...event, title: 'A'.repeat(200) })
    expect(values.mock.calls[0][0].title).toHaveLength(160)
  })

  it('updates only post content and update time, never the permanent event link', async () => {
    const returning = vi.fn().mockResolvedValue([{ eventId: event.id }])
    const where = vi.fn().mockReturnValue({ returning })
    const set = vi.fn().mockReturnValue({ where })
    database.update.mockReturnValue({ set })
    const content = { title: 'Min egen tittel', description: 'Ta med dessert!' }
    await updateNoticeboardPost('post', 'mads', content, event.updatedAt)
    expect(set).toHaveBeenCalledWith({ ...content, updatedAt: event.updatedAt })
    expect(where).toHaveBeenCalledOnce()
  })

  it('deletes only a matching post owned by the current family', async () => {
    const returning = vi.fn().mockResolvedValueOnce([{ id: 'post' }]).mockResolvedValueOnce([])
    const where = vi.fn().mockReturnValue({ returning })
    database.delete.mockReturnValue({ where })
    expect(await deleteNoticeboardPost('post', 'mads')).toBe(true)
    expect(database.delete).toHaveBeenCalledWith(noticeboardPosts)
    expect(where).toHaveBeenCalledWith(and(eq(noticeboardPosts.id, 'post'), eq(noticeboardPosts.ownerId, 'mads')))
    expect(await deleteNoticeboardPost('post', 'anette')).toBe(false)
  })
})
