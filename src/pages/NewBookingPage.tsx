import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import BookingForm, { type BookingFormValues } from '../components/BookingForm'

async function readErrorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { message?: unknown } | null
  return typeof body?.message === 'string' ? body.message : fallback
}

export default function NewBookingPage() {
  const navigate = useNavigate()
  const { currentUser, expireSession } = useAuth()

  async function createBooking(values: BookingFormValues) {
    try {
      const response = await fetch('/.netlify/functions/create-booking', {
        method: 'POST',
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
        return readErrorMessage(response, 'Kunne ikke lagre tiden. Prøv igjen.')
      }

      navigate('/booking', { replace: true, state: { bookingCreated: true } })
    } catch {
      return 'Kunne ikke lagre tiden. Sjekk forbindelsen og prøv igjen.'
    }
  }

  return (
    <BookingForm
      title="Registrer ny tid"
      ownerName={currentUser?.displayName ?? ''}
      submitLabel="Lagre"
      submittingLabel="Lagrer …"
      onSubmit={createBooking}
      onCancel={() => navigate('/booking')}
    />
  )
}
