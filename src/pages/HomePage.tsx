import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GuideImage } from '../../shared/guideImages'
import AppFrame from '../components/AppFrame'
import DriveIcon, { warnAboutMissingDriveIcons } from '../components/DriveIcon'
import { loadHomeIcons } from '../guideImages'
import { currentHomeIconNames, homeIconNames } from '../homeIcons'
import { loadNoticeboardUnseenCount } from '../noticeboard'

export default function HomePage() {
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

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    let isActive = true

    loadNoticeboardUnseenCount()
      .then((count) => {
        if (isActive) setNoticeboardUnseenCount(count)
      })
      .catch(() => undefined)

    return () => {
      isActive = false
    }
  }, [])

  return (
    <AppFrame showAccount>
      <div className="home-intro page-enter">
        <h1>Velkommen</h1>
        <p>Hva ønsker du å gjøre?</p>
      </div>

      <div className="action-grid page-enter page-enter--delay">
        <button
          className="task-button"
          type="button"
          onClick={() => navigate('/guide/open-cabin/get-key')}
        >
          <span className="task-button__icon" aria-hidden="true">
            <DriveIcon
              driveIcon={iconsByName[homeIconNames.openCabin]}
              name={homeIconNames.openCabin}
              warningLabel="hjem-ikonet"
            />
          </span>
          <span className="task-button__label">Åpne hytte</span>
          <span className="task-button__arrow" aria-hidden="true">→</span>
        </button>

        <button
          className="task-button"
          type="button"
          onClick={() => navigate('/guide/close-cabin/not-ready')}
        >
          <span className="task-button__icon" aria-hidden="true">
            <DriveIcon
              driveIcon={iconsByName[homeIconNames.closeCabin]}
              name={homeIconNames.closeCabin}
              warningLabel="hjem-ikonet"
            />
          </span>
          <span className="task-button__label">Stenge hytte</span>
          <span className="task-button__arrow" aria-hidden="true">→</span>
        </button>

        <button
          className="task-button"
          type="button"
          onClick={() => navigate('/guide/cabin-operations/not-ready')}
        >
          <span className="task-button__icon" aria-hidden="true">
            <DriveIcon
              driveIcon={iconsByName[homeIconNames.operations]}
              name={homeIconNames.operations}
              warningLabel="hjem-ikonet"
            />
          </span>
          <span className="task-button__label">Drift av hytte</span>
          <span className="task-button__arrow" aria-hidden="true">→</span>
        </button>

        <button className="task-button" type="button" onClick={() => navigate('/booking')}>
          <span className="task-button__icon" aria-hidden="true">
            <DriveIcon
              driveIcon={iconsByName[homeIconNames.booking]}
              name={homeIconNames.booking}
              warningLabel="hjem-ikonet"
            />
          </span>
          <span className="task-button__label">Booke hyttetid</span>
          <span className="task-button__arrow" aria-hidden="true">→</span>
        </button>

        <button className="task-button" type="button" onClick={() => navigate('/noticeboard')}>
          <span className="task-button__icon task-button__icon--badged" aria-hidden="true">
            <DriveIcon
              driveIcon={iconsByName[homeIconNames.noticeboard]}
              name={homeIconNames.noticeboard}
              warningLabel="hjem-ikonet"
            />
            <span className="task-button__badge-slot">
              {noticeboardUnseenCount > 0 && (
                <span className="task-button__badge">{noticeboardUnseenCount}</span>
              )}
            </span>
          </span>
          <span className="task-button__label">Oppslagstavle</span>
          <span className="task-button__arrow" aria-hidden="true">→</span>
        </button>

        <button className="task-button task-button--disabled" type="button" disabled>
          <span className="task-button__icon" aria-hidden="true">
            <DriveIcon
              driveIcon={iconsByName[homeIconNames.food]}
              name={homeIconNames.food}
              warningLabel="hjem-ikonet"
            />
          </span>
          <span className="task-button__label">Planlegge mat</span>
          <span className="task-button__status">Kommer senere</span>
        </button>
      </div>
    </AppFrame>
  )
}
