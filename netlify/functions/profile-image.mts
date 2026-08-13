import type { Config } from '@netlify/functions'
import { getFamily } from '../../shared/families.ts'
import { readProfileImage, type ProfileImageTarget, type StoredProfileImage } from './_shared/profile-images.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type ReadProfileImageDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  loadImage: (target: ProfileImageTarget) => Promise<StoredProfileImage | null>
}

export function createReadProfileImageFunction({
  authenticate = getAuthenticatedFamilyMember,
  loadImage = readProfileImage,
}: Partial<ReadProfileImageDependencies> = {}) {
  return async function readProfileImageFunction(request: Request) {
    if (request.method !== 'GET') {
      return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
    }

    try {
      if (!authenticate(request)) {
        return jsonResponse(
          { message: 'Økten har utløpt. Logg inn på nytt.' },
          { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
        )
      }

      const url = new URL(request.url)
      const family = getFamily(url.searchParams.get('familyId'))
      const memberId = url.searchParams.get('memberId') || undefined
      if (!family) {
        return jsonResponse({ message: 'Familien finnes ikke.' }, { status: 404 })
      }
      if (memberId && !family.members.some((member) => member.id === memberId)) {
        return jsonResponse({ message: 'Familiemedlemmet finnes ikke.' }, { status: 404 })
      }

      const image = await loadImage({ familyId: family.accountId, memberId })
      if (!image) {
        return jsonResponse({ message: 'Bildet finnes ikke.' }, { status: 404 })
      }

      if (image.etag && request.headers.get('if-none-match') === image.etag) {
        return new Response(null, {
          status: 304,
          headers: { 'Cache-Control': 'private, max-age=300', ETag: image.etag },
        })
      }

      const headers = new Headers({
        'Cache-Control': 'private, max-age=300',
        'Content-Type': image.contentType,
        'X-Content-Type-Options': 'nosniff',
      })
      if (image.etag) headers.set('ETag', image.etag)

      return new Response(image.data, { status: 200, headers })
    } catch {
      return jsonResponse({ message: 'Bildet kunne ikke hentes.' }, { status: 500 })
    }
  }
}

export default createReadProfileImageFunction()

export const config: Config = {
  method: 'GET',
}
