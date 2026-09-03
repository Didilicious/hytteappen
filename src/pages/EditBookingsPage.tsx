import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { formatBookingDateRange, hasBookingComment } from '../bookingDetails'
import { normalizeBooking, type Booking } from '../bookings'
import { formatDateKey } from '../calendar'
import AppFrame from '../components/AppFrame'
import {
  familyEventTypeLabels,
  formatFamilyEventDateRange,
  formatFamilyEventTime,
  normalizeFamilyEvent,
  type FamilyEvent,
} from '../familyEvents'

export function sortOwnedBookings(bookings: Booking[], today = formatDateKey(new Date())) {
  const active = bookings
    .filter(({ toDate }) => toDate >= today)
    .sort((first, second) => first.fromDate.localeCompare(second.fromDate))
  const past = bookings
    .filter(({ toDate }) => toDate < today)
    .sort((first, second) => second.fromDate.localeCompare(first.fromDate))
  return [...active, ...past]
}

export function sortOwnedFamilyEvents(events: FamilyEvent[], today = formatDateKey(new Date())) {
  const eventEnd = (event: FamilyEvent) => event.endDate ?? event.startDate
  const active = events
    .filter((event) => eventEnd(event) >= today)
    .sort((first, second) => first.startDate.localeCompare(second.startDate) || first.startTime.localeCompare(second.startTime))
  const past = events
    .filter((event) => eventEnd(event) < today)
    .sort((first, second) => second.startDate.localeCompare(first.startDate))
  return [...active, ...past]
}

async function readErrorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { message?: unknown } | null
  return typeof body?.message === 'string' ? body.message : fallback
}

type DeleteTarget =
  | { kind: 'booking'; entry: Booking }
  | { kind: 'event'; entry: FamilyEvent }

export default function EditBookingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { expireSession } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [familyEvents, setFamilyEvents] = useState<FamilyEvent[]>([])
  const [loadingState, setLoadingState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const flashState = location.state as { bookingUpdated?: boolean; eventUpdated?: boolean } | null
  const [successMessage, setSuccessMessage] = useState(
    flashState?.bookingUpdated || flashState?.eventUpdated ? 'Endringene er lagret.' : '',
  )

  const loadEntries = useCallback(async () => {
    setLoadingState('loading')
    try {
      const [bookingsResponse, eventsResponse] = await Promise.all([
        fetch('/.netlify/functions/read-own-bookings', {
          credentials: 'include', headers: { Accept: 'application/json' }, cache: 'no-store',
        }),
        fetch('/.netlify/functions/read-own-family-events', {
          credentials: 'include', headers: { Accept: 'application/json' }, cache: 'no-store',
        }),
      ])
      if (bookingsResponse.status === 401 || eventsResponse.status === 401) return expireSession()
      if (!bookingsResponse.ok || !eventsResponse.ok) throw new Error('Failed to load entries')

      const bookingsBody = await bookingsResponse.json() as { bookings?: unknown }
      const eventsBody = await eventsResponse.json() as { events?: unknown }
      if (!Array.isArray(bookingsBody.bookings) || !Array.isArray(eventsBody.events)) throw new Error('Invalid response')

      setBookings(bookingsBody.bookings.map(normalizeBooking).filter((booking): booking is Booking => booking !== null))
      setFamilyEvents(eventsBody.events.map(normalizeFamilyEvent).filter((event): event is FamilyEvent => event !== null))
      setLoadingState('ready')
    } catch {
      setLoadingState('error')
    }
  }, [expireSession])

  useEffect(() => { void loadEntries() }, [loadEntries])

  useEffect(() => {
    if (!successMessage) return
    navigate(location.pathname, { replace: true, state: null })
    const timer = window.setTimeout(() => setSuccessMessage(''), 5000)
    return () => window.clearTimeout(timer)
  }, [location.pathname, navigate, successMessage])

  const sortedBookings = useMemo(() => sortOwnedBookings(bookings), [bookings])
  const sortedEvents = useMemo(() => sortOwnedFamilyEvents(familyEvents), [familyEvents])

  async function confirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError('')
    const isBooking = deleteTarget.kind === 'booking'
    const endpoint = isBooking ? 'delete-booking' : 'delete-family-event'

    try {
      const response = await fetch(`/.netlify/functions/${endpoint}?id=${encodeURIComponent(deleteTarget.entry.id)}`, {
        method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json' },
      })
      if (response.status === 401) return expireSession()
      if (!response.ok) {
        setDeleteError(await readErrorMessage(response, 'Kunne ikke slette registreringen. Prøv igjen.'))
        return
      }

      if (isBooking) setBookings((current) => current.filter(({ id }) => id !== deleteTarget.entry.id))
      else setFamilyEvents((current) => current.filter(({ id }) => id !== deleteTarget.entry.id))
      setDeleteTarget(null)
      setSuccessMessage('Registreringen er slettet.')
    } catch {
      setDeleteError('Kunne ikke slette registreringen. Sjekk forbindelsen og prøv igjen.')
    } finally {
      setIsDeleting(false)
    }
  }

  const hasEntries = sortedBookings.length > 0 || sortedEvents.length > 0

  return (
    <AppFrame showAccount>
      <button className="back-button" type="button" onClick={() => navigate('/booking')}><span aria-hidden="true">←</span>Tilbake</button>
      <div className="booking-edit-heading page-enter">
        <p className="eyebrow">Familiekalender</p>
        <h1>Rediger dine registreringer</h1>
      </div>

      {successMessage && <p className="success-message booking-edit-success" role="status">{successMessage}</p>}
      {loadingState === 'loading' && <p className="booking-edit-status" role="status">Henter registreringene …</p>}
      {loadingState === 'error' && (
        <div className="booking-details-state booking-details-state--error" role="alert">
          <p>Kunne ikke hente registreringene. Sjekk forbindelsen og prøv igjen.</p>
          <button className="secondary-button" type="button" onClick={() => void loadEntries()}>Prøv igjen</button>
        </div>
      )}
      {loadingState === 'ready' && !hasEntries && <p className="booking-edit-empty">Du har ingen registreringer.</p>}

      {loadingState === 'ready' && hasEntries && (
        <div className="registration-groups page-enter page-enter--delay">
          {sortedBookings.length > 0 && (
            <section aria-labelledby="owned-bookings-title">
              <h2 id="owned-bookings-title" className="registration-group-title">Hyttebookinger</h2>
              <div className="booking-edit-list">
                {sortedBookings.map((booking) => (
                  <article className="booking-edit-card" key={booking.id}>
                    <div className="booking-edit-card__content">
                      <p className="eyebrow">Hyttebooking</p>
                      <h3>{formatBookingDateRange(booking)}</h3>
                      {hasBookingComment(booking.comment) && <p>{booking.comment}</p>}
                    </div>
                    <div className="booking-edit-card__actions">
                      <button className="secondary-button" type="button" onClick={() => navigate(`/booking/edit/${booking.id}`)}>Rediger</button>
                      <button className="danger-button" type="button" onClick={() => { setDeleteError(''); setDeleteTarget({ kind: 'booking', entry: booking }) }}>Slett</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {sortedEvents.length > 0 && (
            <section aria-labelledby="owned-events-title">
              <h2 id="owned-events-title" className="registration-group-title">Familiearrangementer</h2>
              <div className="booking-edit-list">
                {sortedEvents.map((familyEvent) => {
                  const time = formatFamilyEventTime(familyEvent)
                  return (
                    <article className="booking-edit-card" key={familyEvent.id}>
                      <div className="booking-edit-card__content">
                        <p className="eyebrow">{familyEventTypeLabels[familyEvent.eventType]}</p>
                        <h3>{familyEvent.title}</h3>
                        <p>{formatFamilyEventDateRange(familyEvent)}{time ? ` · ${time}` : ''}</p>
                      </div>
                      <div className="booking-edit-card__actions">
                        <button className="secondary-button" type="button" onClick={() => navigate(`/booking/edit/event/${familyEvent.id}`)}>Rediger</button>
                        <button className="danger-button" type="button" onClick={() => { setDeleteError(''); setDeleteTarget({ kind: 'event', entry: familyEvent }) }}>Slett</button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {deleteTarget && (
        <div className="booking-delete-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isDeleting) setDeleteTarget(null)
        }}>
          <section className="booking-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
            <h2 id="delete-title">Slett registreringen?</h2>
            <p id="delete-description">
              {deleteTarget.kind === 'booking' ? formatBookingDateRange(deleteTarget.entry) : deleteTarget.entry.title}
            </p>
            {deleteError && <p className="error-message" role="alert">{deleteError}</p>}
            <div className="booking-delete-dialog__actions">
              <button className="secondary-button" type="button" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Avbryt</button>
              <button className="danger-button" type="button" onClick={() => void confirmDelete()} disabled={isDeleting}>{isDeleting ? 'Sletter …' : 'Slett'}</button>
            </div>
          </section>
        </div>
      )}
    </AppFrame>
  )
}
