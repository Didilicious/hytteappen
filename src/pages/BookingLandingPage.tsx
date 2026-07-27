import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AppFrame from '../components/AppFrame'

type BookingAction = {
  icon: 'calendar' | 'add' | 'edit'
  label: string
  path: string
}

const bookingActions: BookingAction[] = [
  { icon: 'calendar', label: 'Se hyttekalender', path: '/booking/calendar' },
  { icon: 'add', label: 'Registrer ny tid', path: '/booking/new' },
  { icon: 'edit', label: 'Rediger dine tider', path: '/booking/edit' },
]

function BookingIcon({ icon }: { icon: BookingAction['icon'] }) {
  if (icon === 'add') {
    return (
      <svg viewBox="0 0 48 48" focusable="false">
        <path d="M10 16.5h28M16 8v7M32 8v7M11 11.5h26a2 2 0 0 1 2 2v25H9v-25a2 2 0 0 1 2-2Z" />
        <path d="M24 21v12M18 27h12" />
      </svg>
    )
  }

  if (icon === 'edit') {
    return (
      <svg viewBox="0 0 48 48" focusable="false">
        <path d="M10 16.5h28M16 8v7M32 8v7M11 11.5h26a2 2 0 0 1 2 2v25H9v-25a2 2 0 0 1 2-2Z" />
        <path d="m19 32 2.2-6.5L31 15.7l4.3 4.3-9.8 9.8L19 32Z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 48 48" focusable="false">
      <path d="M10 16.5h28M16 8v7M32 8v7M11 11.5h26a2 2 0 0 1 2 2v25H9v-25a2 2 0 0 1 2-2Z" />
      <path d="M16 23h5M27 23h5M16 30h5M27 30h5" />
    </svg>
  )
}

export default function BookingLandingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const bookingCreated = (location.state as { bookingCreated?: boolean } | null)?.bookingCreated === true
  const [showSuccess, setShowSuccess] = useState(bookingCreated)

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
              <BookingIcon icon={action.icon} />
            </span>
            <span className="task-button__label">{action.label}</span>
            <span className="task-button__arrow" aria-hidden="true">→</span>
          </button>
        ))}
      </div>
    </AppFrame>
  )
}
