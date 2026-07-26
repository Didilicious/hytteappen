import { useNavigate } from 'react-router-dom'
import AppFrame from '../components/AppFrame'
import cabinIcon from '../assets/icons/icon_cabin.png'
import lockedCabinIcon from '../assets/icons/icon_cabin_locked.png'
import openCabinIcon from '../assets/icons/icon_cabin_open.png'

type ActionIconProps = {
  type: 'calendar' | 'pizza'
}

function ActionIcon({ type }: ActionIconProps) {
  if (type === 'calendar') {
    return (
      <svg viewBox="0 0 48 48" focusable="false">
        <path d="M10 16.5h28M16 8v7M32 8v7M11 11.5h26a2 2 0 0 1 2 2v25H9v-25a2 2 0 0 1 2-2Z" />
        <path d="M16 23h5M27 23h5M16 30h5M27 30h5" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 48 48" focusable="false">
      <path d="M10 39 20 10c8.5 2.2 15.2 6.4 19 13L10 39Z" />
      <path d="M18.2 15.2c7.4 2 12.8 5.4 16.5 10.5" />
      <circle cx="22" cy="24" r="1.6" />
      <circle cx="29" cy="21.5" r="1.6" />
      <circle cx="17.5" cy="31" r="1.6" />
    </svg>
  )
}

export default function HomePage() {
  const navigate = useNavigate()

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
          <span className="task-button__icon" aria-hidden="true"><img src={openCabinIcon} alt="" /></span>
          <span className="task-button__label">Åpne hytte</span>
          <span className="task-button__arrow" aria-hidden="true">→</span>
        </button>

        <button
          className="task-button"
          type="button"
          onClick={() => navigate('/guide/close-cabin/not-ready')}
        >
          <span className="task-button__icon" aria-hidden="true"><img src={lockedCabinIcon} alt="" /></span>
          <span className="task-button__label">Stenge hytte</span>
          <span className="task-button__arrow" aria-hidden="true">→</span>
        </button>

        <button
          className="task-button"
          type="button"
          onClick={() => navigate('/guide/cabin-operations/not-ready')}
        >
          <span className="task-button__icon" aria-hidden="true"><img src={cabinIcon} alt="" /></span>
          <span className="task-button__label">Drift av hytte</span>
          <span className="task-button__arrow" aria-hidden="true">→</span>
        </button>

        <button className="task-button" type="button" onClick={() => navigate('/booking')}>
          <span className="task-button__icon" aria-hidden="true"><ActionIcon type="calendar" /></span>
          <span className="task-button__label">Booke hyttetid</span>
          <span className="task-button__arrow" aria-hidden="true">→</span>
        </button>

        <button className="task-button task-button--disabled" type="button" disabled>
          <span className="task-button__icon" aria-hidden="true"><ActionIcon type="pizza" /></span>
          <span className="task-button__label">Planlegge mat</span>
          <span className="task-button__status">Kommer senere</span>
        </button>
      </div>
    </AppFrame>
  )
}
