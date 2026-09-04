import type { GuideContent } from '../../../shared/guideContent.ts'
import { normalizeGuideSheet } from './guide-sheet.mts'

export const guideSheetUrl = 'https://docs.google.com/spreadsheets/d/1TJNToCannccplBpTpoW6mH7dn98eF8PG5b17rB1qz3c/export?format=csv'

export async function readGuideContent(
  fetchSheet: typeof fetch = fetch,
  resolveEnvironmentValue: (name: string) => string | undefined = (name) => Netlify.env.get(name),
): Promise<GuideContent[]> {
  const response = await fetchSheet(guideSheetUrl, {
    headers: { Accept: 'text/csv' },
    signal: AbortSignal.timeout(8_000),
  })

  if (!response.ok) throw new Error('Sheet request failed')
  return normalizeGuideSheet(await response.text(), resolveEnvironmentValue)
}
