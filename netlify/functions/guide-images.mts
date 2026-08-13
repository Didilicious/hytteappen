import type { Config } from '@netlify/functions'
import type { GuideImagesResponse } from '../../shared/guideImages.ts'
import { fetchDriveImages, matchDriveIcons, matchDriveImages } from './_shared/guide-images.mts'
import { clearSessionCookie, getAuthenticatedFamilyMember, jsonResponse } from './_shared/session.mts'

function readNames(request: Request, parameter: 'group' | 'icon') {
  const names = new URL(request.url).searchParams
    .getAll(parameter)
    .map((name) => name.trim())
    .filter(Boolean)

  if (names.length > 100 || names.some((name) => name.length > 100)) return null
  return [...new Set(names)]
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

  const groups = readNames(request, 'group')
  const iconNames = readNames(request, 'icon')
  if (!groups || !iconNames) {
    return jsonResponse({ message: 'Ugyldige bildefiltre.' }, { status: 400 })
  }

  if (groups.length === 0 && iconNames.length === 0) {
    const body: GuideImagesResponse = { imagesByGroup: {}, iconsByName: {} }
    return jsonResponse(body)
  }

  try {
    const files = await fetchDriveImages()
    const body: GuideImagesResponse = {
      imagesByGroup: matchDriveImages(files, groups),
      iconsByName: matchDriveIcons(files, iconNames),
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
