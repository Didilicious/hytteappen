import {
  noticeboardPostTypes,
  type NoticeboardPost,
  type NoticeboardPostType,
} from '../../../shared/noticeboard.ts'

export { noticeboardPostTypes }
export type { NoticeboardPost, NoticeboardPostType }

export type NoticeboardPostInput = {
  type?: unknown
  title?: unknown
  description?: unknown
}

export function isNoticeboardPostType(value: unknown): value is NoticeboardPostType {
  return typeof value === 'string' && noticeboardPostTypes.includes(value as NoticeboardPostType)
}

export function prepareNoticeboardPost(
  input: NoticeboardPostInput,
  metadata: { id: string; ownerId: string; timestamp: string },
): NoticeboardPost | null {
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const description = typeof input.description === 'string' ? input.description.trim() : ''

  if (
    !isNoticeboardPostType(input.type)
    || !title
    || title.length > 160
    || description.length > 2000
  ) {
    return null
  }

  return {
    id: metadata.id,
    ownerId: metadata.ownerId,
    type: input.type,
    title,
    description,
    status: 'open',
    createdAt: metadata.timestamp,
    updatedAt: metadata.timestamp,
  }
}

export function prepareOpenNoticeboardPosts(posts: NoticeboardPost[]) {
  return posts
    .filter((post) => post.status === 'open')
    .toSorted((first, second) => {
      const createdAtComparison = second.createdAt.localeCompare(first.createdAt)
      return createdAtComparison || second.id.localeCompare(first.id)
    })
}

export function prepareSolvedNoticeboardPosts(posts: NoticeboardPost[]) {
  return posts
    .filter((post) => post.status === 'solved')
    .toSorted((first, second) => {
      const updatedAtComparison = second.updatedAt.localeCompare(first.updatedAt)
      return updatedAtComparison || second.id.localeCompare(first.id)
    })
}
