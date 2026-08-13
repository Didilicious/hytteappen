import { getStore } from '@netlify/blobs'
import type { NoticeboardComment, NoticeboardPost } from '../../../shared/noticeboard.ts'

type LastSeenDocument = {
  seenThrough: string
}

export type NoticeboardPostReadState = {
  postSeenThrough?: string
  commentsReadThrough?: string
}

type PostReadsDocument = {
  readStateByPostId?: Record<string, NoticeboardPostReadState>
  readThroughByPostId?: Record<string, string>
}

function lastSeenKey(ownerId: string) {
  return `last-seen/${ownerId}`
}

function postReadsKey(ownerId: string) {
  return `post-reads/${ownerId}`
}

function getActivityStore() {
  return getStore({
    name: 'noticeboard-activity',
    consistency: 'strong',
  })
}

export async function readNoticeboardLastSeen(ownerId: string) {
  const activityStore = getActivityStore()
  const document = await activityStore.get(lastSeenKey(ownerId), { type: 'json' }) as LastSeenDocument | null
  return typeof document?.seenThrough === 'string' ? document.seenThrough : null
}

export async function saveNoticeboardLastSeen(ownerId: string, seenThrough: string) {
  const activityStore = getActivityStore()
  await activityStore.setJSON(lastSeenKey(ownerId), { seenThrough } satisfies LastSeenDocument)
}

export async function readNoticeboardPostReads(ownerId: string) {
  const activityStore = getActivityStore()
  const document = await activityStore.get(postReadsKey(ownerId), { type: 'json' }) as PostReadsDocument | null
  const readStateByPostId: Record<string, NoticeboardPostReadState> = document?.readStateByPostId && typeof document.readStateByPostId === 'object'
    ? Object.fromEntries(Object.entries(document.readStateByPostId).filter(([, state]) => (
      state && typeof state === 'object'
    )))
    : {}

  if (document?.readThroughByPostId && typeof document.readThroughByPostId === 'object') {
    for (const [postId, readThrough] of Object.entries(document.readThroughByPostId)) {
      if (typeof readThrough !== 'string' || readStateByPostId[postId]) continue
      readStateByPostId[postId] = {
        postSeenThrough: readThrough,
        commentsReadThrough: readThrough,
      }
    }
  }

  return readStateByPostId
}

export async function saveNoticeboardPostRead(ownerId: string, postId: string, readThrough: string) {
  const activityStore = getActivityStore()
  const readStateByPostId = await readNoticeboardPostReads(ownerId)
  const existingState = readStateByPostId[postId] ?? {}
  const postSeenThrough = !existingState.postSeenThrough || readThrough > existingState.postSeenThrough
    ? readThrough
    : existingState.postSeenThrough
  const commentsReadThrough = !existingState.commentsReadThrough || readThrough > existingState.commentsReadThrough
    ? readThrough
    : existingState.commentsReadThrough

  if (
    postSeenThrough !== existingState.postSeenThrough
    || commentsReadThrough !== existingState.commentsReadThrough
  ) {
    readStateByPostId[postId] = { postSeenThrough, commentsReadThrough }
    await activityStore.setJSON(postReadsKey(ownerId), {
      readStateByPostId,
    } satisfies PostReadsDocument)
  }
}

export async function saveNoticeboardPostsSeen(
  ownerId: string,
  postIds: string[],
  seenThrough: string,
) {
  if (postIds.length === 0) return

  const activityStore = getActivityStore()
  const readStateByPostId = await readNoticeboardPostReads(ownerId)
  let changed = false

  for (const postId of postIds) {
    const existingState = readStateByPostId[postId] ?? {}
    if (!existingState.postSeenThrough || seenThrough > existingState.postSeenThrough) {
      readStateByPostId[postId] = { ...existingState, postSeenThrough: seenThrough }
      changed = true
    }
  }

  if (changed) {
    await activityStore.setJSON(postReadsKey(ownerId), {
      readStateByPostId,
    } satisfies PostReadsDocument)
  }
}

export function isNoticeboardPostUnread(
  post: NoticeboardPost,
  comments: NoticeboardComment[],
  ownerId: string,
  readState: NoticeboardPostReadState | undefined,
) {
  const isUnreadPost = post.ownerId !== ownerId
    && (!readState?.postSeenThrough || post.createdAt > readState.postSeenThrough)
  const hasUnreadComments = comments.some((comment) => (
    comment.postId === post.id
    && comment.ownerId !== ownerId
    && (!readState?.commentsReadThrough || comment.createdAt > readState.commentsReadThrough)
  ))

  return isUnreadPost || hasUnreadComments
}

export function countUnseenNoticeboardActivity(
  posts: NoticeboardPost[],
  comments: NoticeboardComment[],
  ownerId: string,
  seenThrough: string | null,
) {
  const isUnseen = (activityOwnerId: string, createdAt: string) => (
    activityOwnerId !== ownerId && (!seenThrough || createdAt > seenThrough)
  )

  return posts.filter((post) => isUnseen(post.ownerId, post.createdAt)).length
    + comments.filter((comment) => isUnseen(comment.ownerId, comment.createdAt)).length
}
