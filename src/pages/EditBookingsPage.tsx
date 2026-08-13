import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { formatBookingDateRange, hasBookingComment } from '../bookingDetails'
import { normalizeBooking, type Booking } from '../bookings'
import { formatDateKey } from '../calendar'
import AppFrame from '../components/AppFrame'

export function sortOwnedBookings(bookings: Booking[], today = formatDateKey(new Date())) {
  const active = bookings
    .filter(({ toDate }) => toDate >= today)
    .sort((first, second) => first.fromDate.localeCompare(second.fromDate))
  const past = bookings
    .filter(({ toDate }) => toDate < today)
    .sort((first, second) => second.fromDate.localeCompare(first.fromDate))
  return [...active, ...past]
}

async function readErrorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { message?: unknown } | null
  return typeof body?.message === 'string' ? body.message : fallback
}

export default function EditBookingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { expireSession } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loadingState, setLoadingState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const flashState = location.state as { bookingUpdated?: boolean; bookingDeleted?: boolean } | null
  const initialSuccessMessage = flashState?.bookingUpdated
    ? 'Endringene er lagret.'
    : flashState?.bookingDeleted
      ? 'Registreringen er slettet.'
      : ''
  const [successMessage, setSuccessMessage] = useState(initialSuccessMessage)

  const loadBookings = useCallback(async () => {
    setLoadingState('loading')
    try {
      const response = await fetch('/.netlify/functions/read-own-bookings', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
      if (response.status === 401) {
        expireSession()
        return
      }
      if (!response.ok) throw new Error('Failed to load bookings')

      const body = await response.json() as { bookings?: unknown }
      if (!Array.isArray(body.bookings)) throw new Error('Invalid booking response')
      setBookings(body.bookings.map(normalizeBooking).filter((booking): booking is Booking => booking !== null))
      setLoadingState('ready')
    } catch {
      setLoadingState('error')
    }
  }, [expireSession])

  useEffect(() => {
    void loadBookings()
  }, [loadBookings])

  useEffect(() => {
    if (!successMessage) return
    navigate(location.pathname, { replace: true, state: null })
    const timer = window.setTimeout(() => setSuccessMessage(''), 5000)
    return () => window.clearTimeout(timer)
  }, [location.pathname, navigate, successMessage])

  const sortedBookings = useMemo(() => sortOwnedBookings(bookings), [bookings])

  function requestDelete(booking: Booking) {
    setDeleteError('')
    setDeleteTarget(booking)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError('')

    try {
      const response = await fetch(`/.netlify/functions/delete-booking?id=${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (response.status === 401) {
        expireSession()
        return
      }
      if (!response.ok) {
        setDeleteError(await readErrorMessage(response, 'Kunne ikke slette registreringen. Prøv igjen.'))
        return
      }

      setDeleteTarget(null)
      setBookings((current) => current.filter(({ id }) => id !== deleteTarget.id))
      setSuccessMessage('Registreringen er slettet.')
    } catch {
      setDeleteError('Kunne ikke slette registreringen. Sjekk forbindelsen og prøv igjen.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AppFrame showAccount>
      <button className="back-button" type="button" onClick={() => navigate('/booking')}>
        <span aria-hidden="true">←</span>
        Tilbake
      </button>

      <div className="booking-edit-heading page-enter">
        <p className="eyebrow">Hyttekalender</p>
        <h1>Rediger dine tider</h1>
      </div>

      {successMessage && <p className="success-message booking-edit-success" role="status">{successMessage}</p>}

      {loadingState === 'loading' && <p className="booking-edit-status" role="status">Henter registrerte tider …</p>}
      {loadingState === 'error' && (
        <div className="booking-details-state booking-details-state--error" role="alert">
          <p>Kunne ikke hente registrerte tider. Sjekk forbindelsen og prøv igjen.</p>
          <button className="secondary-button" type="button" onClick={() => void loadBookings()}>Prøv igjen</button>
        </div>
      )}
      {loadingState === 'ready' && sortedBookings.length === 0 && (
        <p className="booking-edit-empty">Du har ingen registrerte tider.</p>
      )}
      {loadingState === 'ready' && sortedBookings.length > 0 && (
        <div className="booking-edit-list page-enter page-enter--delay">
          {sortedBookings.map((booking) => (
            <article className="booking-edit-card" key={booking.id}>
              <div className="booking-edit-card__content">
                <h2>{formatBookingDateRange(booking)}</h2>
                {hasBookingComment(booking.comment) && <p>{booking.comment}</p>}
              </div>
              <div className="booking-edit-card__actions">
                <button className="secondary-button" type="button" onClick={() => navigate(`/booking/edit/${booking.id}`)}>
                  Rediger
                </button>
                <button className="danger-button" type="button" onClick={() => requestDelete(booking)}>
                  Slett
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="booking-delete-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isDeleting) setDeleteTarget(null)
        }}>
          <section className="booking-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-range">
            <h2 id="delete-title">Slett registreringen?</h2>
            <p id="delete-range">{formatBookingDateRange(deleteTarget)}</p>
            {deleteError && <p className="error-message" role="alert">{deleteError}</p>}
            <div className="booking-delete-dialog__actions">
              <button className="secondary-button" type="button" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Avbryt</button>
              <button className="danger-button" type="button" onClick={() => void confirmDelete()} disabled={isDeleting}>
                {isDeleting ? 'Sletter …' : 'Slett'}
              </button>
            </div>
          </section>
        </div>
      )}
    </AppFrame>
  )
}
