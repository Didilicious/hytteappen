import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { getBookingOwnerDisplayName } from '../bookingDetails'
import { normalizeBooking, type Booking } from '../bookings'
import BookingForm, { type BookingFormValues } from '../components/BookingForm'
import AppFrame from '../components/AppFrame'

type LoadingState = 'loading' | 'ready' | 'not-found' | 'forbidden' | 'error'

async function readErrorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { message?: unknown } | null
  return typeof body?.message === 'string' ? body.message : fallback
}

export default function EditBookingPage() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const { currentUser, expireSession } = useAuth()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>('loading')

  const loadBooking = useCallback(async () => {
    if (!bookingId) {
      setLoadingState('not-found')
      return
    }

    setLoadingState('loading')
    try {
      const response = await fetch(`/.netlify/functions/read-booking?id=${encodeURIComponent(bookingId)}&ownerOnly=true`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })

      if (response.status === 401) {
        expireSession()
        return
      }
      if (response.status === 404) {
        setLoadingState('not-found')
        return
      }
      if (response.status === 403) {
        setLoadingState('forbidden')
        return
      }
      if (!response.ok) throw new Error('Failed to load booking')

      const body = await response.json() as { booking?: unknown }
      const nextBooking = normalizeBooking(body.booking)
      if (!nextBooking) throw new Error('Invalid booking response')
      if (nextBooking.ownerId !== currentUser?.id) {
        setLoadingState('forbidden')
        return
      }

      setBooking(nextBooking)
      setLoadingState('ready')
    } catch {
      setLoadingState('error')
    }
  }, [bookingId, currentUser?.id, expireSession])

  useEffect(() => {
    void loadBooking()
  }, [loadBooking])

  async function saveBooking(values: BookingFormValues) {
    try {
      const response = await fetch(`/.netlify/functions/update-booking?id=${encodeURIComponent(bookingId ?? '')}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      if (response.status === 401) {
        expireSession()
        return 'Økten har utløpt. Logg inn på nytt.'
      }
      if (!response.ok) {
        return readErrorMessage(response, 'Kunne ikke lagre endringene. Prøv igjen.')
      }

      navigate('/booking/edit', { replace: true, state: { bookingUpdated: true } })
    } catch {
      return 'Kunne ikke lagre endringene. Sjekk forbindelsen og prøv igjen.'
    }
  }

  if (loadingState === 'ready' && booking) {
    return (
      <BookingForm
        title="Rediger registrering"
        ownerName={getBookingOwnerDisplayName(booking.ownerId)}
        initialValues={{
          fromDate: booking.fromDate,
          toDate: booking.toDate,
          welcomesOthers: booking.welcomesOthers,
          partialFamily: booking.partialFamily,
          comment: booking.comment,
        }}
        submitLabel="Lagre endringer"
        submittingLabel="Lagrer endringer …"
        onSubmit={saveBooking}
        onCancel={() => navigate('/booking/edit')}
      />
    )
  }

  return (
    <AppFrame showAccount>
      <div className="booking-details-heading page-enter">
        <p className="eyebrow">Familiekalender</p>
        <h1>Rediger registrering</h1>
      </div>
      <section className={`booking-details-state${loadingState === 'error' ? ' booking-details-state--error' : ''}`}>
        {loadingState === 'loading' && <p role="status">Henter registreringen …</p>}
        {loadingState === 'not-found' && <p role="alert">Registreringen finnes ikke lenger.</p>}
        {loadingState === 'forbidden' && <p role="alert">Du kan bare redigere dine egne registreringer.</p>}
        {loadingState === 'error' && (
          <>
            <p role="alert">Kunne ikke hente registreringen. Sjekk forbindelsen og prøv igjen.</p>
            <button className="secondary-button" type="button" onClick={() => void loadBooking()}>Prøv igjen</button>
          </>
        )}
        {loadingState !== 'loading' && (
          <button className="text-button" type="button" onClick={() => navigate('/booking/edit')}>
            Tilbake til dine registreringer
          </button>
        )}
      </section>
    </AppFrame>
  )
}
