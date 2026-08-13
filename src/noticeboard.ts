import type { NoticeboardPost, NoticeboardPostType } from '../shared/noticeboard'

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

  const body = await response.json() as { posts?: NoticeboardPost[] }
  return Array.isArray(body.posts) ? body.posts : []
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
