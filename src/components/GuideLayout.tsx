import type { PropsWithChildren } from 'react'
import { Link } from 'react-router-dom'
import type { GuideDefinition, GuideSectionIcon } from '../guideData'
import AppFrame from './AppFrame'

type GuideLayoutProps = PropsWithChildren<{
  guide: GuideDefinition
}>

function SectionIcon({ icon }: { icon: GuideSectionIcon }) {
  if (icon === 'lock') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
  }

  if (icon === 'calendar') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M8 3v6M16 3v6M4 11h16" /></svg>
  }

  if (icon === 'meal') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h9M5 12h9M5 18h9" /><circle cx="18" cy="6" r="1" /><circle cx="18" cy="12" r="1" /><circle cx="18" cy="18" r="1" /></svg>
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-7 9 7v9H3v-9Z" /><path d="M9 20v-6h6v6M7 11h10" /></svg>
}

function OverviewIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></svg>
}

export default function GuideLayout({ children, guide }: GuideLayoutProps) {
  const { section } = guide

  return (
    <AppFrame
      showAccount
      headerCenter={(
        <div className="guide-switcher" aria-label={`Aktiv guide: ${section.label}`}>
          <span className="guide-switcher__active">
            <span className="guide-switcher__icon"><SectionIcon icon={section.icon} /></span>
            <span>{section.label}</span>
          </span>
          {section.overviewNodeId && (
            <Link className="guide-switcher__overview" to={`/guide/${guide.id}/${section.overviewNodeId}`}>
              <span className="guide-switcher__icon"><OverviewIcon /></span>
              <span>Oversikt</span>
            </Link>
          )}
        </div>
      )}
    >
      {children}
    </AppFrame>
  )
}
