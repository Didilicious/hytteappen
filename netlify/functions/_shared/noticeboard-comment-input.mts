import type { NoticeboardComment } from '../../../shared/noticeboard.ts'
import { isValidNoticeboardPostId } from './noticeboard-id.mts'

export type NoticeboardCommentInput = {
  text?: unknown
  idempotencyKey?: unknown
}

type CommentIdentity = {
  id: string
  postId: string
  ownerId: string
  timestamp: string
}

export function prepareNoticeboardComment(
  input: NoticeboardCommentInput,
  identity: CommentIdentity,
): NoticeboardComment | null {
  if (!isValidNoticeboardPostId(identity.id)) return null
  if (typeof input.text !== 'string') return null

  const text = input.text.trim()
  if (!text) return null

  return {
    id: identity.id,
    postId: identity.postId,
    ownerId: identity.ownerId,
    text,
    createdAt: identity.timestamp,
    updatedAt: identity.timestamp,
  }
}
