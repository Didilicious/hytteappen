import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import {
  formatBookingDate,
  formatBookingDateRange,
  getBookingOwnerDisplayName,
  hasBookingComment,
  isBookingOwner,
} from '../bookingDetails'
import { normalizeBooking, type Booking } from '../bookings'
import { getCalendarPath } from '../calendarNavigation'
import AppFrame from '../components/AppFrame'

type LoadingState = 'loading' | 'ready' | 'error' | 'not-found'

type BookingLocationState = {
  calendarPath?: unknown
}

export default function BookingDetailsPage() {
  const { bookingId = '' } = useParams()
  const { currentUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>('loading')
  const locationState = location.state as BookingLocationState | null
  const cameFromCalendar = typeof locationState?.calendarPath === 'string'
  const calendarPath = cameFromCalendar ? locationState.calendarPath as string : getCalendarPath(new Date())

  const loadBooking = useCallback(async () => {
    setLoadingState('loading')

    try {
      const response = await fetch(`/.netlify/functions/read-booking?id=${encodeURIComponent(bookingId)}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })

      if (response.status === 401) {
        window.location.replace('/login')
        return
      }

      if (response.status === 404) {
        setBooking(null)
        setLoadingState('not-found')
        return
      }

      if (!response.ok) throw new Error('Failed to load booking')

      const body = await response.json() as { booking?: unknown }
      const normalizedBooking = normalizeBooking(body.booking)
      if (!normalizedBooking) throw new Error('Invalid booking response')

      setBooking(normalizedBooking)
      setLoadingState('ready')
    } catch {
      setBooking(null)
      setLoadingState('error')
    }
  }, [bookingId])

  useEffect(() => {
    void loadBooking()
  }, [loadBooking])

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [bookingId])

  return (
    <AppFrame showAccount>
      <button
        className="back-button"
        type="button"
        onClick={() => cameFromCalendar ? navigate(-1) : navigate(calendarPath)}
      >
        <span aria-hidden="true">←</span>
        Tilbake til kalenderen
      </button>

      <div className="booking-details-heading page-enter">
        <p className="eyebrow">Hyttekalender</p>
        <h1>Registrert hyttetid</h1>
      </div>

      {loadingState === 'loading' && (
        <div className="booking-details-state" role="status" aria-live="polite">
          <p>Henter registreringen …</p>
        </div>
      )}

      {loadingState === 'error' && (
        <div className="booking-details-state booking-details-state--error" role="alert">
          <p>Kunne ikke hente registreringen. Sjekk forbindelsen og prøv igjen.</p>
          <button className="secondary-button" type="button" onClick={() => void loadBooking()}>
            Prøv igjen
          </button>
        </div>
      )}

      {loadingState === 'not-found' && (
        <section className="booking-details-state" aria-labelledby="booking-not-found-title">
          <h2 id="booking-not-found-title">Denne registreringen finnes ikke lenger.</h2>
          <p>Den kan ha blitt fjernet siden kalenderen sist ble åpnet.</p>
        </section>
      )}

      {loadingState === 'ready' && booking && (
        <article className="booking-details-card page-enter page-enter--delay">
          <p className="booking-details-range">{formatBookingDateRange(booking)}</p>

          <dl className="booking-details-list">
            <div>
              <dt>Registrert av</dt>
              <dd>{getBookingOwnerDisplayName(booking.ownerId)}</dd>
            </div>
            <div>
              <dt>Fra</dt>
              <dd><time dateTime={booking.fromDate}>{formatBookingDate(booking.fromDate)}</time></dd>
            </div>
            <div>
              <dt>Til</dt>
              <dd><time dateTime={booking.toDate}>{formatBookingDate(booking.toDate)}</time></dd>
            </div>
            <div className="booking-details-choice">
              <dt id="booking-welcomes-others-label">Vi ønsker gjerne flere med oss</dt>
              <dd>
                <input
                  className="booking-details-readonly-checkbox"
                  type="checkbox"
                  checked={booking.welcomesOthers}
                  disabled
                  aria-labelledby="booking-welcomes-others-label"
                />
              </dd>
            </div>
            <div className="booking-details-choice">
              <dt id="booking-partial-family-label">Ikke hele familien drar</dt>
              <dd>
                <input
                  className="booking-details-readonly-checkbox"
                  type="checkbox"
                  checked={booking.partialFamily}
                  disabled
                  aria-labelledby="booking-partial-family-label"
                />
              </dd>
            </div>
            {hasBookingComment(booking.comment) && (
              <div className="booking-details-comment">
                <dt>Kommentar</dt>
                <dd>{booking.comment}</dd>
              </div>
            )}
          </dl>

          {isBookingOwner(booking, currentUser?.id) && (
            <div className="booking-details-actions">
              <button className="secondary-button" type="button" onClick={() => navigate('/booking/edit')}>
                Rediger registrering
              </button>
            </div>
          )}
        </article>
      )}
    </AppFrame>
  )
}
