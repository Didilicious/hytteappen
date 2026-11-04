import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GuideImage } from '../../shared/guideImages'
import AppFrame from '../components/AppFrame'
import DriveIcon, { warnAboutMissingDriveIcons } from '../components/DriveIcon'
import { loadHomeIcons } from '../guideImages'
import { currentHomeIconNames, homeIconNames } from '../homeIcons'
import type { AppSection } from '../sections'
import { loadNoticeboardUnseenCount } from '../noticeboard'

export default function HomePage({ section }: { section?: AppSection }) {
  const navigate = useNavigate()
  const [iconsByName, setIconsByName] = useState<Record<string, GuideImage | null>>({})
  const [noticeboardUnseenCount, setNoticeboardUnseenCount] = useState(0)

  useEffect(() => {
    let isActive = true

    loadHomeIcons(currentHomeIconNames)
      .then((icons) => {
        if (isActive) setIconsByName(icons)
      })
      .catch(() => {
        warnAboutMissingDriveIcons('hjem-ikoner')
      })

    return () => { isActive = false }
  }, [])

  useEffect(() => {
    let isActive = true
    loadNoticeboardUnseenCount()
      .then((count) => { if (isActive) setNoticeboardUnseenCount(count) })
      .catch(() => undefined)
    return () => { isActive = false }
  }, [])

  const actions = section === 'hytta' ? [
    { label: 'Åpne hytte', icon: homeIconNames.openCabin, path: '/guide/open-cabin' },
    { label: 'Stenge hytte', icon: homeIconNames.closeCabin, path: '/guide/close-cabin' },
    { label: 'Drift av hytte', icon: homeIconNames.operations, path: '/guide/cabin-operations' },
    { label: 'Feilsøking', icon: homeIconNames.troubleshooting, path: '/guide/troubleshooting' },
    { label: 'Hyttebooking', icon: homeIconNames.booking, path: '/booking/calendar?view=bookings' },
    { label: 'Oppslagstavle', icon: homeIconNames.noticeboard, path: '/noticeboard' },
  ] : section === 'familien' ? [
    { label: 'Familiearrangementer', icon: homeIconNames.booking, path: '/booking/calendar?view=events' },
    { label: 'Oppslagstavle', icon: homeIconNames.noticeboard, path: '/noticeboard' },
    { label: 'Familieoversikt', icon: homeIconNames.family, path: '/familieoversikt' },
  ] : [
    { label: 'Hytta', icon: homeIconNames.operations, path: '/hytta' },
    { label: 'Familien', icon: homeIconNames.family, path: '/familien' },
  ]

  return (
    <AppFrame showAccount>
      <div className="home-intro page-enter">
        <h1>{section === 'hytta' ? 'Hytta' : section === 'familien' ? 'Familien' : 'Velkommen'}</h1>
        <p>{section ? 'Hva ønsker du å gjøre?' : 'Velg Hytta eller Familien.'}</p>
      </div>
      <div className="action-grid page-enter page-enter--delay">
        {actions.map((action) => (
          <button className="task-button" type="button" key={action.path} onClick={() => navigate(action.path)}>
            <span className="task-button__icon task-button__icon--badged" aria-hidden="true">
              <DriveIcon driveIcon={iconsByName[action.icon]} name={action.icon} warningLabel="hjem-ikonet" />
              {action.icon === homeIconNames.noticeboard && noticeboardUnseenCount > 0 && (
                <span className="task-button__badge-slot"><span className="task-button__badge">{noticeboardUnseenCount}</span></span>
              )}
            </span>
            <span className="task-button__label">{action.label}</span>
            <span className="task-button__arrow" aria-hidden="true">→</span>
          </button>
        ))}
      </div>
    </AppFrame>
  )
}
