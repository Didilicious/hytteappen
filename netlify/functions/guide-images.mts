import type { Config } from '@netlify/functions'
import type { GuideImagesResponse } from '../../shared/guideImages.ts'
import { fetchDriveImages, matchDriveImages } from './_shared/guide-images.mts'
import { clearSessionCookie, getAuthenticatedFamilyMember, jsonResponse } from './_shared/session.mts'

function readGroups(request: Request) {
  const groups = new URL(request.url).searchParams
    .getAll('group')
    .map((group) => group.trim())
    .filter(Boolean)

  if (groups.length > 100 || groups.some((group) => group.length > 100)) return null
  return [...new Set(groups)]
}

export default async function guideImages(request: Request) {
  if (request.method !== 'GET') {
    return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
  }

  try {
    if (!getAuthenticatedFamilyMember(request)) {
      return jsonResponse(
        { message: 'Ingen gyldig økt.' },
        { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
      )
    }
  } catch {
    return jsonResponse({ message: 'Kunne ikke kontrollere økten.' }, { status: 500 })
  }

  const groups = readGroups(request)
  if (!groups) {
    return jsonResponse({ message: 'Ugyldige bildegrupper.' }, { status: 400 })
  }

  if (groups.length === 0) {
    const body: GuideImagesResponse = { imagesByGroup: {} }
    return jsonResponse(body)
  }

  try {
    const body: GuideImagesResponse = {
      imagesByGroup: matchDriveImages(await fetchDriveImages(), groups),
    }
    return jsonResponse(body)
  } catch {
    return jsonResponse(
      { code: 'drive_unavailable', message: 'Kunne ikke laste guidebilder.' },
      { status: 502 },
    )
  }
}

export const config: Config = {
  method: 'GET',
}
