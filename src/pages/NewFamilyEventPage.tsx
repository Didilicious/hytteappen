import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import FamilyEventForm, { type FamilyEventFormValues } from '../components/FamilyEventForm'

async function readErrorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { message?: unknown } | null
  return typeof body?.message === 'string' ? body.message : fallback
}

export default function NewFamilyEventPage() {
  const navigate = useNavigate()
  const { currentUser, expireSession } = useAuth()

  async function createEvent(values: FamilyEventFormValues) {
    try {
      const response = await fetch('/.netlify/functions/create-family-event', {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (response.status === 401) {
        expireSession()
        return 'Økten har utløpt. Logg inn på nytt.'
      }
      if (!response.ok) return readErrorMessage(response, 'Kunne ikke lagre arrangementet. Prøv igjen.')
      navigate('/booking/calendar', { replace: true, state: { eventCreated: true } })
    } catch {
      return 'Kunne ikke lagre arrangementet. Sjekk forbindelsen og prøv igjen.'
    }
  }

  return (
    <FamilyEventForm
      title="Nytt familiearrangement"
      ownerId={currentUser?.id ?? ''}
      ownerName={currentUser?.displayName ?? 'Din familie'}
      submitLabel="Legg til i kalenderen"
      submittingLabel="Legger til …"
      onSubmit={createEvent}
      onCancel={() => navigate('/booking/new')}
    />
  )
}
