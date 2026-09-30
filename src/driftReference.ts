import type { GuideContent } from '../shared/guideContent'

export type DriftSearchResult = {
  page: GuideContent
  snippet: string | null
}

export function getReferencePages(content: readonly GuideContent[], guideName: 'Drift' | 'Feilsøking') {
  return content.filter((page) => page.guides.includes(guideName))
}

export function getDriftPages(content: readonly GuideContent[]) {
  return getReferencePages(content, 'Drift')
}

function getPageContent(page: GuideContent) {
  return [
    page.location,
    page.warning,
    ...page.instructions,
    page.checkpoints,
    ...page.answerOptions,
  ].filter((value): value is string => Boolean(value)).join(' ')
}

function createSnippet(content: string, query: string, maximumLength = 132) {
  const matchIndex = content.toLocaleLowerCase('nb-NO').indexOf(query.toLocaleLowerCase('nb-NO'))
  if (matchIndex < 0) return null

  const padding = Math.max(0, maximumLength - query.length)
  let start = Math.max(0, matchIndex - Math.floor(padding / 2))
  let end = Math.min(content.length, start + maximumLength)

  if (end - start < maximumLength) start = Math.max(0, end - maximumLength)

  const firstSpace = content.indexOf(' ', start)
  if (start > 0 && firstSpace > start && firstSpace < matchIndex) start = firstSpace + 1

  const lastSpace = content.lastIndexOf(' ', end)
  if (end < content.length && lastSpace > matchIndex + query.length) end = lastSpace

  return `${start > 0 ? '…' : ''}${content.slice(start, end).trim()}${end < content.length ? '…' : ''}`
}

export function searchDriftPages(pages: readonly GuideContent[], rawQuery: string): DriftSearchResult[] {
  const query = rawQuery.trim()
  if (!query) return []
  const normalizedQuery = query.toLocaleLowerCase('nb-NO')

  return pages.flatMap((page) => {
    const titleMatches = page.title.toLocaleLowerCase('nb-NO').includes(normalizedQuery)
    const snippet = createSnippet(getPageContent(page), query)
    return titleMatches || snippet ? [{ page, snippet }] : []
  })
}
