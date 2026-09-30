import type { GuideContent } from '../../../shared/guideContent.ts'
import { normalizeGuideSheet } from './guide-sheet.mts'

export const guideSheetUrl = 'https://docs.google.com/spreadsheets/d/1TJNToCannccplBpTpoW6mH7dn98eF8PG5b17rB1qz3c/export?format=csv&gid=951480919'
const sheetRequestTimeoutMs = 12_000
const sheetRequestAttempts = 2

async function fetchGuideSheetCsv(fetchSheet: typeof fetch) {
  let lastError: unknown

  for (let attempt = 1; attempt <= sheetRequestAttempts; attempt += 1) {
    try {
      const response = await fetchSheet(guideSheetUrl, {
        headers: { Accept: 'text/csv' },
        signal: AbortSignal.timeout(sheetRequestTimeoutMs),
      })

      if (response.ok) return response.text()
      lastError = new Error(`Sheet request failed with status ${response.status}`)

      if (response.status < 500 && response.status !== 429) break
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Sheet request failed')
}

export async function readGuideContent(
  fetchSheet: typeof fetch = fetch,
  resolveEnvironmentValue: (name: string) => string | undefined = (name) => Netlify.env.get(name),
): Promise<GuideContent[]> {
  return normalizeGuideSheet(await fetchGuideSheetCsv(fetchSheet), resolveEnvironmentValue)
}
