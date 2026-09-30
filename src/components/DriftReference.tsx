import { useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GuideContent } from '../../shared/guideContent'
import { searchDriftPages } from '../driftReference'

function HighlightedText({ query, text }: { query: string; text: string }) {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return text

  const normalizedText = text.toLocaleLowerCase('nb-NO')
  const normalizedQuery = trimmedQuery.toLocaleLowerCase('nb-NO')
  const parts = []
  let cursor = 0
  let matchIndex = normalizedText.indexOf(normalizedQuery)

  while (matchIndex >= 0) {
    parts.push(text.slice(cursor, matchIndex))
    parts.push(<mark key={`${matchIndex}-${cursor}`}>{text.slice(matchIndex, matchIndex + trimmedQuery.length)}</mark>)
    cursor = matchIndex + trimmedQuery.length
    matchIndex = normalizedText.indexOf(normalizedQuery, cursor)
  }
  parts.push(text.slice(cursor))
  return <>{parts}</>
}

type ReferenceConfig = {
  guideId: string
  title: string
  description: string
  searchLabel: string
  searchPlaceholder: string
  emptyLabel: string
}

export default function DriftReference({ pages, config = {
  guideId: 'cabin-operations',
  title: 'Drift av hytte',
  description: 'Finn rutiner og praktisk informasjon om hytta.',
  searchLabel: 'Søk i driftshåndboken',
  searchPlaceholder: 'Søk etter for eksempel vann, ved eller sikring',
  emptyLabel: 'Drift',
} }: { pages: readonly GuideContent[]; config?: ReferenceConfig }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const inputId = useId()
  const resultsId = useId()
  const results = useMemo(() => searchDriftPages(pages, query), [pages, query])
  const hasQuery = Boolean(query.trim())
  const openPage = (pageId: string) => navigate(`/guide/${config.guideId}/${pageId}`)

  return (
    <>
      <div className="overview-heading page-enter">
        <p className="eyebrow">Oppslagsverk</p>
        <h1>{config.title}</h1>
        <p className="lead">{config.description}</p>
      </div>

      <div className="reference-search page-enter page-enter--delay">
        <label htmlFor={inputId}>{config.searchLabel}</label>
        <div className="reference-search__field">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></svg>
          <input
            id={inputId}
            type="search"
            value={query}
            placeholder={config.searchPlaceholder}
            autoComplete="off"
            aria-controls={hasQuery ? resultsId : undefined}
            aria-expanded={hasQuery}
            aria-haspopup="listbox"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {hasQuery && (
          <div className="reference-search__results" id={resultsId} role="listbox" aria-label="Søkeresultater">
            {results.length > 0 ? results.map(({ page, snippet }) => (
              <button key={page.id} type="button" role="option" aria-selected="false" onClick={() => openPage(page.id)}>
                <strong><HighlightedText text={page.title} query={query} /></strong>
                {snippet && <span><HighlightedText text={snippet} query={query} /></span>}
                <span className="reference-search__arrow" aria-hidden="true">→</span>
              </button>
            )) : (
              <p>Ingen treff på «{query.trim()}».</p>
            )}
          </div>
        )}
      </div>

      {pages.length > 0 ? (
        <ul className="reference-list page-enter page-enter--delay">
          {pages.map((page) => (
            <li key={page.id}>
              <button type="button" onClick={() => openPage(page.id)}>
                <strong>{page.title}</strong>
                <span aria-hidden="true">→</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="guide-content-error page-enter page-enter--delay">
          <p>Ingen publiserte sider er tilgjengelige for {config.emptyLabel} ennå.</p>
        </div>
      )}
    </>
  )
}
