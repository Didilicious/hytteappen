import type { PropsWithChildren, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import AccountMenu from './AccountMenu'

type AppFrameProps = PropsWithChildren<{
  headerCenter?: ReactNode
  showAccount?: boolean
}>

export default function AppFrame({ children, headerCenter, showAccount = false }: AppFrameProps) {
  return (
    <main className="app-shell">
      <div className="landscape" aria-hidden="true">
        <span className="landscape__ridge landscape__ridge--back" />
        <span className="landscape__ridge landscape__ridge--front" />
      </div>

      <section className="content-panel">
        <header className="brand-row">
          <Link className="brand-link" to="/" aria-label="Hytteguiden – gå til forsiden">
            <span className="cabin-mark" aria-hidden="true">
              <svg viewBox="0 0 48 48" focusable="false">
                <path d="M6 23.5 24 8l18 15.5v17H6v-17Z" />
                <path d="M20 40V28h8v12M13 23.5h22" />
              </svg>
            </span>
            <span className="brand-name">Hytteguiden</span>
          </Link>
          {headerCenter && <div className="brand-row__center">{headerCenter}</div>}
          {showAccount && <div className="brand-row__account"><AccountMenu /></div>}
        </header>

        <div className="page-content">{children}</div>
      </section>
    </main>
  )
}
