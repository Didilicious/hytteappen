import type { Config } from '@netlify/functions'
import { getFamily } from '../../shared/families.ts'
import {
  prepareProfileImage,
  saveProfileImage,
  type ProfileImageTarget,
} from './_shared/profile-images.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type UploadProfileImageDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  prepareImage: (file: File) => Promise<ArrayBuffer>
  saveImage: (target: ProfileImageTarget, data: ArrayBuffer, updatedAt: string) => Promise<void>
  now: () => string
}

export function createUploadProfileImageFunction({
  authenticate = getAuthenticatedFamilyMember,
  prepareImage = prepareProfileImage,
  saveImage = saveProfileImage,
  now = () => new Date().toISOString(),
}: Partial<UploadProfileImageDependencies> = {}) {
  return async function uploadProfileImageFunction(request: Request) {
    if (request.method !== 'POST') {
      return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
    }

    try {
      const authenticatedFamily = authenticate(request)
      if (!authenticatedFamily) {
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

      if (authenticatedFamily.id !== family.accountId) {
        return jsonResponse({ message: 'Du kan bare endre bilder for din egen familie.' }, { status: 403 })
      }

      if (memberId && !family.members.some((member) => member.id === memberId)) {
        return jsonResponse({ message: 'Familiemedlemmet finnes ikke.' }, { status: 404 })
      }

      const formData = await request.formData()
      const image = formData.get('image')
      if (!(image instanceof File) || image.size === 0) {
        return jsonResponse({ message: 'Velg et bilde som skal lastes opp.' }, { status: 400 })
      }

      let preparedImage: ArrayBuffer
      try {
        preparedImage = await prepareImage(image)
      } catch (error) {
        if (error instanceof Error && error.message === 'FILE_TOO_LARGE') {
          return jsonResponse({ message: 'Bildet er for stort. Maksimal filstørrelse er 5 MB.' }, { status: 413 })
        }
        if (error instanceof Error && error.message === 'UNSUPPORTED_TYPE') {
          return jsonResponse({ message: 'Filtypen støttes ikke. Bruk JPEG, PNG eller WebP.' }, { status: 415 })
        }
        if (error instanceof Error && error.message === 'INVALID_IMAGE') {
          return jsonResponse({ message: 'Bildet kunne ikke behandles. Velg en annen bildefil.' }, { status: 400 })
        }
        throw error
      }

      const updatedAt = now()
      await saveImage({ familyId: family.accountId, memberId }, preparedImage, updatedAt)
      return jsonResponse({ updatedAt })
    } catch {
      return jsonResponse({ message: 'Bildet kunne ikke lastes opp. Prøv igjen.' }, { status: 500 })
    }
  }
}

export default createUploadProfileImageFunction()

export const config: Config = {
  method: 'POST',
}
