import type {
  NoticeboardComment,
  NoticeboardPost,
  NoticeboardPostSummary,
  NoticeboardPostType,
  NoticeboardPostWithCommentCount,
} from '../shared/noticeboard'

type NoticeboardPostInput = {
  type: NoticeboardPostType
  title: string
  description: string
}

async function readErrorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { message?: unknown } | null
  return typeof body?.message === 'string' ? body.message : fallback
}

export async function loadOpenNoticeboardPosts() {
  const response = await fetch('/.netlify/functions/read-noticeboard-posts', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Kunne ikke hente innleggene.'))
  }

  const body = await response.json() as { posts?: NoticeboardPostSummary[] }
  return Array.isArray(body.posts) ? body.posts : []
}

export async function loadSolvedNoticeboardPosts() {
  const response = await fetch('/.netlify/functions/read-solved-noticeboard-posts', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Kunne ikke hente løste innlegg.'))
  }

  const body = await response.json() as { posts?: NoticeboardPostWithCommentCount[] }
  return Array.isArray(body.posts) ? body.posts : []
}

export async function loadNoticeboardPost(postId: string) {
  const response = await fetch(`/.netlify/functions/read-noticeboard-post?id=${encodeURIComponent(postId)}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Kunne ikke hente innlegget.'))
  }

  return await response.json() as {
    post: NoticeboardPost
    comments: NoticeboardComment[] | null
    readThrough: string
  }
}

export async function loadNoticeboardComments(postId: string) {
  const response = await fetch(`/.netlify/functions/read-noticeboard-comments?postId=${encodeURIComponent(postId)}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Kunne ikke hente kommentarene.'))
  }

  const body = await response.json() as { comments?: NoticeboardComment[] }
  return Array.isArray(body.comments) ? body.comments : []
}

export async function createNoticeboardComment(postId: string, text: string, idempotencyKey: string) {
  const response = await fetch(`/.netlify/functions/create-noticeboard-comment?postId=${encodeURIComponent(postId)}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, idempotencyKey }),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Kunne ikke lagre kommentaren. Prøv igjen.'))
  }

  const body = await response.json() as { comment: NoticeboardComment }
  return body.comment
}

export async function loadNoticeboardUnseenCount() {
  const response = await fetch('/.netlify/functions/read-noticeboard-unseen-count', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) throw new Error('Kunne ikke hente nye aktiviteter.')

  const body = await response.json() as { count?: unknown }
  return typeof body.count === 'number' && body.count > 0 ? Math.floor(body.count) : 0
}

export async function createNoticeboardPost(input: NoticeboardPostInput) {
  const response = await fetch('/.netlify/functions/create-noticeboard-post', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Kunne ikke lagre innlegget.'))
  }

  return await response.json() as { post: NoticeboardPost }
}

export async function markNoticeboardPostSolved(postId: string) {
  const response = await fetch(`/.netlify/functions/solve-noticeboard-post?id=${encodeURIComponent(postId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Kunne ikke markere innlegget som løst.'))
  }
}
