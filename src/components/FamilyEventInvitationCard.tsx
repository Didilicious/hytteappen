import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { formatFamilyEventDateRange, formatFamilyEventTime, normalizeFamilyEvent, type FamilyEvent } from '../familyEvents'

export default function FamilyEventInvitationCard({ eventId }: { eventId: string }) {
  const { currentUser, expireSession } = useAuth()
  const [event, setEvent] = useState<FamilyEvent | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [rsvpStatus, setRsvpStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [hasRsvp, setHasRsvp] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    async function loadInvitation() {
      setStatus('loading')
      setRsvpStatus('loading')
      try {
        const options = { credentials: 'include' as const, headers: { Accept: 'application/json' }, cache: 'no-store' as const, signal: controller.signal }
        const response = await fetch(`/.netlify/functions/read-family-event?id=${encodeURIComponent(eventId)}`, options)
        if (controller.signal.aborted) return
        if (response.status === 401) return expireSession()
        if (response.status === 404) return setStatus('missing')
        if (!response.ok) throw new Error('Failed to load event')
        const body = await response.json() as { event?: unknown }
        const nextEvent = normalizeFamilyEvent(body.event)
        if (!nextEvent || nextEvent.id !== eventId) throw new Error('Invalid event')
        if (controller.signal.aborted) return
        setEvent(nextEvent)
        setStatus('ready')
        if (!currentUser || nextEvent.ownerId === currentUser.id) return
        try {
          const rsvpResponse = await fetch(`/.netlify/functions/family-event-rsvp?id=${encodeURIComponent(eventId)}`, options)
          if (controller.signal.aborted) return
          if (rsvpResponse.status === 401) return expireSession()
          if (rsvpResponse.status === 404) return setStatus('missing')
          if (!rsvpResponse.ok) throw new Error('Failed to load RSVP')
          const rsvpBody = await rsvpResponse.json() as { rsvp?: unknown }
          if (controller.signal.aborted) return
          setHasRsvp(Boolean(rsvpBody.rsvp))
          setRsvpStatus('ready')
        } catch {
          if (!controller.signal.aborted) setRsvpStatus('error')
        }
      } catch {
        if (!controller.signal.aborted) setStatus('error')
      }
    }
    void loadInvitation()
    return () => controller.abort()
  }, [eventId, currentUser?.id, expireSession, reloadKey])

  useEffect(() => {
    const refreshVisible = () => { if (document.visibilityState === 'visible') reload() }
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [reload])

  return <section className="family-event-invitation" aria-label="Invitasjon til familiearrangement" aria-live="polite">
    {status === 'loading' && <div className="noticeboard-skeleton" aria-label="Laster arrangement"><span /></div>}
    {status === 'missing' && <p>Arrangementet finnes ikke lenger.</p>}
    {status === 'error' && <><p role="alert">Kunne ikke hente arrangementet.</p><button className="secondary-button" type="button" onClick={reload}>Prøv igjen</button></>}
    {status === 'ready' && event && <>
      <p className="family-event-invitation__label">Familiearrangement</p>
      <h3>{event.title}</h3>
      <p>{formatFamilyEventDateRange(event, true)}{formatFamilyEventTime(event) && ` · kl. ${formatFamilyEventTime(event)}`}</p>
      {event.location && <p className="family-event-invitation__location">{event.location}</p>}
      {event.ownerId === currentUser?.id
        ? <Link className="secondary-button" to={`/booking/event/${eventId}`}>Se arrangement</Link>
        : <>
          {rsvpStatus === 'ready'
            ? <Link className="primary-button" to={`/booking/event/${eventId}/svar`}>{hasRsvp ? 'Endre svar' : 'Svar på invitasjon'}</Link>
            : <button className="primary-button" type="button" disabled>{rsvpStatus === 'error' ? 'Svar utilgjengelig' : 'Laster svar …'}</button>}
          {rsvpStatus === 'error' && <><p role="alert">Kunne ikke hente svaret ditt.</p><button className="secondary-button" type="button" onClick={reload}>Prøv igjen</button></>}
        </>}
    </>}
  </section>
}
