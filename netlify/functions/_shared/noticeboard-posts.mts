import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '../../../db/index.ts'
import { noticeboardPosts } from '../../../db/schema.ts'
import type { NoticeboardPost } from './noticeboard-input.mts'

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

export async function solveNoticeboardPost(id: string, ownerId: string, updatedAt: string) {
  const db = getDb()
  const [post] = await db
    .update(noticeboardPosts)
    .set({ status: 'solved', updatedAt })
    .where(and(eq(noticeboardPosts.id, id), eq(noticeboardPosts.ownerId, ownerId)))
    .returning()

  return post as NoticeboardPost | undefined
}
