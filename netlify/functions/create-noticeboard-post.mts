import { randomUUID } from 'node:crypto'
import type { Config } from '@netlify/functions'
import {
  prepareNoticeboardPost,
  type NoticeboardPostInput,
} from './_shared/noticeboard-input.mts'
import { createNoticeboardPost } from './_shared/noticeboard-posts.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type CreateNoticeboardPostDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  savePost: typeof createNoticeboardPost
  createId: () => string
  now: () => string
}

export function createCreateNoticeboardPostFunction({
  authenticate = getAuthenticatedFamilyMember,
  savePost = createNoticeboardPost,
  createId = randomUUID,
  now = () => new Date().toISOString(),
}: Partial<CreateNoticeboardPostDependencies> = {}) {
  return async function createNoticeboardPostFunction(request: Request) {
    if (request.method !== 'POST') {
      return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
    }

    try {
      const familyMember = authenticate(request)
      if (!familyMember) {
        return jsonResponse(
          { message: 'Økten har utløpt. Logg inn på nytt.' },
          { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
        )
      }

      const input = await request.json().catch(() => null) as NoticeboardPostInput | null
      const timestamp = now()
      const post = input && prepareNoticeboardPost(input, {
        id: createId(),
        ownerId: familyMember.id,
        timestamp,
      })

      if (!post) {
        return jsonResponse({ message: 'Velg type og skriv inn en tittel.' }, { status: 400 })
      }

      return jsonResponse({ post: await savePost(post) }, { status: 201 })
    } catch {
      return jsonResponse({ message: 'Kunne ikke lagre innlegget. Prøv igjen.' }, { status: 500 })
    }
  }
}

export default createCreateNoticeboardPostFunction()

export const config: Config = {
  method: 'POST',
}
