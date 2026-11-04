import type { PropsWithChildren } from 'react'
import { Link } from 'react-router-dom'
import type { GuideDefinition } from '../guideData'
import AppFrame from './AppFrame'

type GuideLayoutProps = PropsWithChildren<{
  guide: GuideDefinition
}>

function OverviewIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></svg>
}

export default function GuideLayout({ children, guide }: GuideLayoutProps) {
  const { section } = guide

  return (
    <AppFrame
      showAccount
      headerCenter={section.overviewNodeId && !['cabin-operations', 'troubleshooting'].includes(guide.id) && (
        <Link
          className="guide-switcher__overview"
          to={`/guide/${guide.id}/${section.overviewNodeId}`}
          aria-label={`Oversikt: ${section.label}`}
        >
          <span className="guide-switcher__icon"><OverviewIcon /></span>
          <span>Oversikt</span>
        </Link>
      )}
    >
      {children}
    </AppFrame>
  )
}
