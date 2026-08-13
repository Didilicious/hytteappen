import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GuideImage } from '../../shared/guideImages'
import AppFrame from '../components/AppFrame'
import { loadHomeIcons } from '../guideImages'
import { currentHomeIconNames, homeIconNames } from '../homeIcons'

type HomeIconProps = {
  driveIcon?: GuideImage | null
  name: string
}

function warnAboutHomeIcon(message: string) {
  if (import.meta.env.DEV) console.warn(message)
}

function HomeIcon({ driveIcon, name }: HomeIconProps) {
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    setLoadFailed(false)
    if (driveIcon === null) {
      warnAboutHomeIcon(`Fant ikke hjem-ikonet ${name} i Google Drive.`)
    }
  }, [driveIcon, name])

  if (!driveIcon || loadFailed) return null

  return (
    <img
      src={driveIcon.src}
      alt=""
      onError={() => {
        setLoadFailed(true)
        warnAboutHomeIcon(`Kunne ikke laste hjem-ikonet ${name} fra Google Drive.`)
      }}
    />
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const [iconsByName, setIconsByName] = useState<Record<string, GuideImage | null>>({})

  useEffect(() => {
    let isActive = true

    loadHomeIcons(currentHomeIconNames)
      .then((icons) => {
        if (isActive) setIconsByName(icons)
      })
      .catch(() => {
        warnAboutHomeIcon('Kunne ikke laste hjem-ikoner fra Google Drive. Ikonområdene forblir tomme.')
      })

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
            <HomeIcon
              driveIcon={iconsByName[homeIconNames.openCabin]}
              name={homeIconNames.openCabin}
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
            <HomeIcon
              driveIcon={iconsByName[homeIconNames.closeCabin]}
              name={homeIconNames.closeCabin}
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
            <HomeIcon
              driveIcon={iconsByName[homeIconNames.operations]}
              name={homeIconNames.operations}
            />
          </span>
          <span className="task-button__label">Drift av hytte</span>
          <span className="task-button__arrow" aria-hidden="true">→</span>
        </button>

        <button className="task-button" type="button" onClick={() => navigate('/booking')}>
          <span className="task-button__icon" aria-hidden="true">
            <HomeIcon
              driveIcon={iconsByName[homeIconNames.booking]}
              name={homeIconNames.booking}
            />
          </span>
          <span className="task-button__label">Booke hyttetid</span>
          <span className="task-button__arrow" aria-hidden="true">→</span>
        </button>

        <button className="task-button task-button--disabled" type="button" disabled>
          <span className="task-button__icon" aria-hidden="true">
            <HomeIcon
              driveIcon={iconsByName[homeIconNames.food]}
              name={homeIconNames.food}
            />
          </span>
          <span className="task-button__label">Planlegge mat</span>
          <span className="task-button__status">Kommer senere</span>
        </button>
      </div>
    </AppFrame>
  )
}
