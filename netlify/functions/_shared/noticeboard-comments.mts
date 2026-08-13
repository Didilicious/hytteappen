import { getStore } from '@netlify/blobs'
import type { NoticeboardComment } from '../../../shared/noticeboard.ts'

type CommentsDocument = {
  comments: NoticeboardComment[]
}

const commentsKey = 'comments'

function getCommentsStore() {
  return getStore({
    name: 'noticeboard-comments',
    consistency: 'strong',
  })
}

function isNoticeboardComment(value: unknown): value is NoticeboardComment {
  if (!value || typeof value !== 'object') return false
  const comment = value as Partial<NoticeboardComment>
  return typeof comment.id === 'string'
    && typeof comment.postId === 'string'
    && typeof comment.ownerId === 'string'
    && typeof comment.text === 'string'
    && typeof comment.createdAt === 'string'
    && typeof comment.updatedAt === 'string'
}

export function sortNoticeboardComments(comments: NoticeboardComment[]) {
  return [...comments].sort((first, second) => {
    const timestampComparison = first.createdAt.localeCompare(second.createdAt)
    return timestampComparison || first.id.localeCompare(second.id)
  })
}

export async function readAllNoticeboardComments() {
  const commentsStore = getCommentsStore()
  const document = await commentsStore.get(commentsKey, { type: 'json' }) as CommentsDocument | null
  const comments = Array.isArray(document?.comments)
    ? document.comments.filter(isNoticeboardComment)
    : []

  return sortNoticeboardComments(comments)
}

export async function readNoticeboardComments(postId: string) {
  return (await readAllNoticeboardComments()).filter((comment) => comment.postId === postId)
}

export async function saveNoticeboardComment(comment: NoticeboardComment) {
  const commentsStore = getCommentsStore()
  const comments = await readAllNoticeboardComments()
  const existingComment = comments.find((storedComment) => storedComment.id === comment.id)
  if (existingComment) return existingComment

  await commentsStore.setJSON(commentsKey, {
    comments: sortNoticeboardComments([...comments, comment]),
  } satisfies CommentsDocument)

  return comment
}
