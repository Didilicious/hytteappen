import { and, desc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from '../../../db/index.ts'
import { noticeboardPosts } from '../../../db/schema.ts'
import type { NoticeboardPost } from './noticeboard-input.mts'
import type { FamilyEvent } from '../../../shared/familyEvents.ts'

export async function createFamilyEventInvitation(event: FamilyEvent) {
  const db = getDb()
  const [post] = await db.insert(noticeboardPosts).values({
    id: randomUUID(),
    ownerId: event.ownerId,
    type: 'Info',
    title: `Invitasjon: ${event.title}`.slice(0, 160),
    description: 'Du er invitert! Svar på invitasjonen i arrangementskortet nedenfor.',
    eventId: event.id,
    status: 'open',
    createdAt: event.createdAt,
    updatedAt: event.createdAt,
  }).onConflictDoNothing({ target: noticeboardPosts.eventId }).returning()
  if (post) return post as NoticeboardPost
  const [existingPost] = await db.select().from(noticeboardPosts).where(eq(noticeboardPosts.eventId, event.id)).limit(1)
  if (!existingPost) throw new Error('Invitation could not be saved')
  return existingPost as NoticeboardPost
}

export async function createNoticeboardPost(post: NoticeboardPost) {
  const db = getDb()
  const [createdPost] = await db.insert(noticeboardPosts).values(post).returning()
  return createdPost as NoticeboardPost
}

export async function readOpenNoticeboardPosts() {
  const db = getDb()
  return await db
    .select()
    .from(noticeboardPosts)
    .where(eq(noticeboardPosts.status, 'open'))
    .orderBy(desc(noticeboardPosts.createdAt), desc(noticeboardPosts.id)) as NoticeboardPost[]
}

export async function readAllNoticeboardPosts() {
  const db = getDb()
  return await db
    .select()
    .from(noticeboardPosts)
    .orderBy(desc(noticeboardPosts.createdAt), desc(noticeboardPosts.id)) as NoticeboardPost[]
}

export async function readNoticeboardPost(id: string) {
  const db = getDb()
  const [post] = await db
    .select()
    .from(noticeboardPosts)
    .where(eq(noticeboardPosts.id, id))
    .limit(1)

  return post as NoticeboardPost | undefined
}

export async function readFamilyEventInvitation(eventId: string) {
  const [post] = await getDb().select().from(noticeboardPosts)
    .where(eq(noticeboardPosts.eventId, eventId)).limit(1)
  return post as NoticeboardPost | undefined
}

export async function unlinkFamilyEventInvitation(eventId: string) {
  await getDb().update(noticeboardPosts).set({ eventId: null })
    .where(eq(noticeboardPosts.eventId, eventId))
}

export async function updateNoticeboardPost(id: string, ownerId: string, content: Pick<NoticeboardPost, 'title' | 'description'>, updatedAt: string) {
  const [post] = await getDb().update(noticeboardPosts)
    .set({ title: content.title, description: content.description, updatedAt })
    .where(and(eq(noticeboardPosts.id, id), eq(noticeboardPosts.ownerId, ownerId)))
    .returning()
  return post as NoticeboardPost | undefined
}

export async function deleteNoticeboardPost(id: string, ownerId: string) {
  const [post] = await getDb().delete(noticeboardPosts)
    .where(and(eq(noticeboardPosts.id, id), eq(noticeboardPosts.ownerId, ownerId)))
    .returning({ id: noticeboardPosts.id })
  return Boolean(post)
}

export async function solveNoticeboardPost(id: string, ownerId: string, updatedAt: string) {
  const db = getDb()
  const [post] = await db
    .update(noticeboardPosts)
    .set({ status: 'solved', updatedAt })
    .where(and(eq(noticeboardPosts.id, id), eq(noticeboardPosts.ownerId, ownerId)))
    .returning()

  return post as NoticeboardPost | undefined
}
