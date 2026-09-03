import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import FamilyEventForm, { type FamilyEventFormValues } from '../components/FamilyEventForm'
import { getFamilyEventOwnerName, normalizeFamilyEvent, type FamilyEvent } from '../familyEvents'
import AppFrame from '../components/AppFrame'

type LoadingState = 'loading' | 'ready' | 'not-found' | 'forbidden' | 'error'

async function readErrorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { message?: unknown } | null
  return typeof body?.message === 'string' ? body.message : fallback
}

export default function EditFamilyEventPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { currentUser, expireSession } = useAuth()
  const [familyEvent, setFamilyEvent] = useState<FamilyEvent | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>('loading')

  const loadEvent = useCallback(async () => {
    if (!eventId) return setLoadingState('not-found')
    setLoadingState('loading')
    try {
      const response = await fetch(`/.netlify/functions/read-family-event?id=${encodeURIComponent(eventId)}&ownerOnly=true`, {
        credentials: 'include', headers: { Accept: 'application/json' }, cache: 'no-store',
      })
      if (response.status === 401) return expireSession()
      if (response.status === 404) return setLoadingState('not-found')
      if (response.status === 403) return setLoadingState('forbidden')
      if (!response.ok) throw new Error('Failed to load event')
      const body = await response.json() as { event?: unknown }
      const nextEvent = normalizeFamilyEvent(body.event)
      if (!nextEvent) throw new Error('Invalid event')
      if (nextEvent.ownerId !== currentUser?.id) return setLoadingState('forbidden')
      setFamilyEvent(nextEvent)
      setLoadingState('ready')
    } catch {
      setLoadingState('error')
    }
  }, [currentUser?.id, eventId, expireSession])

  useEffect(() => { void loadEvent() }, [loadEvent])

  async function saveEvent(values: FamilyEventFormValues) {
    try {
      const response = await fetch(`/.netlify/functions/update-family-event?id=${encodeURIComponent(eventId ?? '')}`, {
        method: 'PATCH', credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (response.status === 401) {
        expireSession()
        return 'Økten har utløpt. Logg inn på nytt.'
      }
      if (!response.ok) return readErrorMessage(response, 'Kunne ikke lagre endringene. Prøv igjen.')
      navigate('/booking/edit', { replace: true, state: { eventUpdated: true } })
    } catch {
      return 'Kunne ikke lagre endringene. Sjekk forbindelsen og prøv igjen.'
    }
  }

  if (loadingState === 'ready' && familyEvent) {
    return (
      <FamilyEventForm
        title="Rediger familiearrangement"
        ownerId={familyEvent.ownerId}
        ownerName={getFamilyEventOwnerName(familyEvent.ownerId)}
        initialValues={{
          eventType: familyEvent.eventType,
          title: familyEvent.title,
          startDate: familyEvent.startDate,
          endDate: familyEvent.endDate,
          startTime: familyEvent.startTime,
          endTime: familyEvent.endTime,
          location: familyEvent.location,
          wishlistUrl: familyEvent.wishlistUrl,
          moreInfo: familyEvent.moreInfo,
        }}
        submitLabel="Lagre endringer"
        submittingLabel="Lagrer endringer …"
        onSubmit={saveEvent}
        onCancel={() => navigate('/booking/edit')}
      />
    )
  }

  return (
    <AppFrame showAccount>
      <div className="booking-details-heading page-enter"><p className="eyebrow">Familiekalender</p><h1>Rediger familiearrangement</h1></div>
      <section className={`booking-details-state${loadingState === 'error' ? ' booking-details-state--error' : ''}`}>
        {loadingState === 'loading' && <p role="status">Henter arrangementet …</p>}
        {loadingState === 'not-found' && <p role="alert">Arrangementet finnes ikke lenger.</p>}
        {loadingState === 'forbidden' && <p role="alert">Du kan bare redigere dine egne arrangementer.</p>}
        {loadingState === 'error' && <><p role="alert">Kunne ikke hente arrangementet.</p><button className="secondary-button" type="button" onClick={() => void loadEvent()}>Prøv igjen</button></>}
        {loadingState !== 'loading' && <button className="text-button" type="button" onClick={() => navigate('/booking/edit')}>Tilbake til dine registreringer</button>}
      </section>
    </AppFrame>
  )
}
