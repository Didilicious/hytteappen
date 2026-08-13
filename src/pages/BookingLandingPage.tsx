import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { GuideImage } from '../../shared/guideImages'
import { bookingIconNames, currentBookingIconNames } from '../bookingIcons'
import AppFrame from '../components/AppFrame'
import DriveIcon, { warnAboutMissingDriveIcons } from '../components/DriveIcon'
import { loadHomeIcons } from '../guideImages'

type BookingAction = {
  iconName: typeof currentBookingIconNames[number]
  label: string
  path: string
}

const bookingActions: BookingAction[] = [
  { iconName: bookingIconNames.calendar, label: 'Se hyttekalender', path: '/booking/calendar' },
  { iconName: bookingIconNames.newBooking, label: 'Registrer ny tid', path: '/booking/new' },
  { iconName: bookingIconNames.editBookings, label: 'Rediger dine tider', path: '/booking/edit' },
]

export default function BookingLandingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const bookingCreated = (location.state as { bookingCreated?: boolean } | null)?.bookingCreated === true
  const [showSuccess, setShowSuccess] = useState(bookingCreated)
  const [iconsByName, setIconsByName] = useState<Record<string, GuideImage | null>>({})

  useEffect(() => {
    let isActive = true

    loadHomeIcons(currentBookingIconNames)
      .then((icons) => {
        if (isActive) setIconsByName(icons)
      })
      .catch(() => {
        warnAboutMissingDriveIcons('kalender-ikoner')
      })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!showSuccess) return

    navigate(location.pathname, { replace: true, state: null })
    const timer = window.setTimeout(() => setShowSuccess(false), 5000)
    return () => window.clearTimeout(timer)
  }, [location.pathname, navigate, showSuccess])

  return (
    <AppFrame showAccount>
      <button className="back-button" type="button" onClick={() => navigate('/')}>
        <span aria-hidden="true">←</span>
        Tilbake
      </button>

      <div className="booking-intro page-enter">
        <p className="eyebrow">Hyttekalender</p>
        <h1>Booke hyttetid</h1>
        <p>Hva ønsker du å gjøre?</p>
      </div>

      {showSuccess && (
        <p className="success-message booking-success" role="status">
          Tiden er registrert.
        </p>
      )}

      <div className="booking-actions page-enter page-enter--delay">
        {bookingActions.map((action) => (
          <button
            className="task-button"
            type="button"
            key={action.path}
            onClick={() => navigate(action.path)}
          >
            <span className="task-button__icon" aria-hidden="true">
              <DriveIcon
                driveIcon={iconsByName[action.iconName]}
                name={action.iconName}
                warningLabel="kalender-ikonet"
              />
            </span>
            <span className="task-button__label">{action.label}</span>
            <span className="task-button__arrow" aria-hidden="true">→</span>
          </button>
        ))}
      </div>
    </AppFrame>
  )
}
