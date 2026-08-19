import type { Config } from '@netlify/functions'
import type { GuideContentResponse } from '../../shared/guideContent.ts'
import { normalizeGuideSheet } from './_shared/guide-sheet.mts'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
} from './_shared/session.mts'

const sheetUrl = 'https://docs.google.com/spreadsheets/d/1TJNToCannccplBpTpoW6mH7dn98eF8PG5b17rB1qz3c/export?format=csv'

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

  let csv: string
  try {
    const response = await fetch(sheetUrl, {
      headers: { Accept: 'text/csv' },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) throw new Error('Sheet request failed')
    csv = await response.text()
  } catch {
    return jsonResponse(
      { code: 'sheet_unavailable', message: 'Kunne ikke laste guideinnholdet.' },
      { status: 502 },
    )
  }

  try {
    const body: GuideContentResponse = {
      content: normalizeGuideSheet(csv, (name) => Netlify.env.get(name)),
    }
    return jsonResponse(body)
  } catch {
    return jsonResponse(
      { code: 'configuration_error', message: 'Guideinnholdet er feil konfigurert.' },
      { status: 500 },
    )
  }
}

export const config: Config = {
  method: 'GET',
}
