import type { Config } from '@netlify/functions'
import type { GuideContentResponse } from '../../shared/guideContent.ts'
import { GuideSheetConfigurationError } from './_shared/guide-sheet.mts'
import { readGuideContent } from './_shared/guide-content.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
} from './_shared/session.mts'

export default async function guideContent(request: Request) {
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

  try {
    const body: GuideContentResponse = {
      content: await readGuideContent(),
    }
    return jsonResponse(body)
  } catch (error) {
    if (!(error instanceof GuideSheetConfigurationError)) {
      return jsonResponse(
        { code: 'sheet_unavailable', message: 'Kunne ikke laste guideinnholdet.' },
        { status: 502 },
      )
    }

    return jsonResponse(
      { code: 'configuration_error', message: 'Guideinnholdet er feil konfigurert.' },
      { status: 500 },
    )
  }
}

export const config: Config = {
  method: 'GET',
}
