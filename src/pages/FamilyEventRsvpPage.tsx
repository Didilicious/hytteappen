import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getFamily } from '../../shared/families'
import { normalizeFamilyEventRsvpInput, type FamilyEventAttendance as Attendance, type FamilyEventRsvp } from '../../shared/familyEventRsvps'
import { useAuth } from '../auth'
import AppFrame from '../components/AppFrame'
import FamilyEventAttendance from '../components/FamilyEventAttendance'
import { formatFamilyEventDateRange, formatFamilyEventTime, normalizeFamilyEvent, type FamilyEvent } from '../familyEvents'

type GuestEntry = { id: string; name: string }
type LoadingState = 'loading' | 'ready' | 'not-found' | 'forbidden' | 'error'

export default function FamilyEventRsvpPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, expireSession } = useAuth()
  const family = getFamily(currentUser?.id)
  const [familyEvent, setFamilyEvent] = useState<FamilyEvent | null>(null)
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>('loading')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [guests, setGuests] = useState<GuestEntry[]>([])
  const [nobodyAttending, setNobodyAttending] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const calendarPath = (location.state as { calendarPath?: string } | null)?.calendarPath ?? '/booking/calendar'
  const eventPath = `/booking/event/${encodeURIComponent(eventId ?? '')}`

  const loadRsvp = useCallback(async (signal?: AbortSignal) => {
    if (!eventId) return setLoadingState('not-found')
    setLoadingState('loading')
    try {
      const response = await fetch(`/.netlify/functions/family-event-rsvp?id=${encodeURIComponent(eventId)}`, {
        credentials: 'include', headers: { Accept: 'application/json' }, cache: 'no-store', signal,
      })
      if (signal?.aborted) return
      if (response.status === 401) return expireSession()
      if (response.status === 404) return setLoadingState('not-found')
      if (response.status === 403) return setLoadingState('forbidden')
      if (!response.ok) throw new Error('Failed to load RSVP')
      const body = await response.json() as { event?: unknown; rsvp: FamilyEventRsvp | null; attendance?: Attendance }
      if (signal?.aborted) return
      const event = normalizeFamilyEvent(body.event)
      if (!event) throw new Error('Invalid event')
      setFamilyEvent(event)
      setAttendance(body.attendance ?? null)
      setMemberIds(body.rsvp?.memberIds ?? [])
      setGuests((body.rsvp?.guestNames ?? []).map((name) => ({ id: crypto.randomUUID(), name })))
      setNobodyAttending(body.rsvp?.nobodyAttending ?? false)
      setIsEditing(Boolean(body.rsvp))
      setSaveError('')
      setLoadingState('ready')
    } catch {
      if (!signal?.aborted) setLoadingState('error')
    }
  }, [eventId, expireSession])

  useEffect(() => {
    const controller = new AbortController()
    void loadRsvp(controller.signal)
    return () => controller.abort()
  }, [loadRsvp])

  function toggleMember(memberId: string, selected: boolean) {
    setSaveError('')
    if (selected) setNobodyAttending(false)
    setMemberIds((current) => selected ? [...current, memberId] : current.filter((id) => id !== memberId))
  }

  async function saveRsvp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving || !familyEvent || !family) return
    const input = normalizeFamilyEventRsvpInput({ memberIds, guestNames: guests.map((guest) => guest.name), nobodyAttending }, family.accountId)
    if (!input) return setSaveError('Velg hvem som kommer, eller velg «Ingen kommer». Gjestenavn kan ha høyst 200 tegn.')
    setIsSaving(true)
    setSaveError('')
    try {
      const response = await fetch(`/.netlify/functions/family-event-rsvp?id=${encodeURIComponent(familyEvent.id)}`, {
        method: 'PUT', credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (response.status === 401) return expireSession()
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: unknown } | null
        setSaveError(typeof body?.message === 'string' ? body.message : 'Kunne ikke lagre svaret. Prøv igjen.')
        return
      }
      navigate(eventPath, { replace: true, state: { calendarPath, rsvpSaved: true } })
    } catch {
      setSaveError('Kunne ikke lagre svaret. Sjekk forbindelsen og prøv igjen.')
    } finally {
      setIsSaving(false)
    }
  }

  if (loadingState !== 'ready' || !familyEvent || !family) {
    return <AppFrame showAccount>
      <div className="booking-details-heading page-enter"><p className="eyebrow">Familiekalender</p><h1>Svar på invitasjon</h1></div>
      <section className="booking-details-state">
        {loadingState === 'loading' && <p role="status">Henter invitasjonen …</p>}
        {loadingState === 'not-found' && <p role="alert">Arrangementet finnes ikke lenger.</p>}
        {loadingState === 'forbidden' && <p role="alert">Du kan ikke svare på ditt eget arrangement.</p>}
        {loadingState === 'error' && <><p role="alert">Kunne ikke hente invitasjonen.</p><button className="secondary-button" type="button" onClick={() => void loadRsvp()}>Prøv igjen</button></>}
        <button className="text-button" type="button" onClick={() => navigate(calendarPath)}>Tilbake til kalenderen</button>
      </section>
    </AppFrame>
  }

  const time = formatFamilyEventTime(familyEvent)
  return <AppFrame showAccount>
    <button className="back-button" type="button" disabled={isSaving} onClick={() => navigate(eventPath, { state: { calendarPath } })}><span aria-hidden="true">←</span>Tilbake til arrangementet</button>
    <article className="booking-details-card family-event-rsvp page-enter">
      <p className="eyebrow">{isEditing ? 'Endre svar' : 'Svar på invitasjon'}</p>
      <h1>{familyEvent.title}</h1>
      <dl className="booking-details-list">
        <div><dt>Dato</dt><dd>{formatFamilyEventDateRange(familyEvent)}</dd></div>
        <div><dt>Tidspunkt</dt><dd>{time || 'Ikke oppgitt'}</dd></div>
        <div><dt>Sted</dt><dd className="preserve-lines">{familyEvent.location || 'Ikke oppgitt'}</dd></div>
      </dl>
      <form className="booking-form" onSubmit={(event) => void saveRsvp(event)}>
        <fieldset className="family-event-rsvp__attendees" disabled={isSaving}>
          <legend>Hvem kommer?</legend>
          <p className="family-event-rsvp__hint">Velg alle som kommer fra {family.displayName}. Du kan også legge til gjester.</p>
          <div className="booking-checkboxes">
            {family.members.map((member) => <label className="checkbox-field" key={member.id}>
              <input type="checkbox" checked={memberIds.includes(member.id)} onChange={(event) => toggleMember(member.id, event.target.checked)} />
              <span>{member.displayName}</span>
            </label>)}
            <label className="checkbox-field">
              <input type="checkbox" checked={nobodyAttending} onChange={(event) => {
                setNobodyAttending(event.target.checked)
                setSaveError('')
                if (event.target.checked) { setMemberIds([]); setGuests([]) }
              }} />
              <span>Ingen kommer</span>
            </label>
            {guests.map((guest, guestIndex) => <div className="family-event-rsvp__guest" key={guest.id}>
              <label className="checkbox-field">
                <input type="checkbox" checked onChange={() => { setGuests((current) => current.filter((entry) => entry.id !== guest.id)); setSaveError('') }} />
                <span>Andre</span>
              </label>
              <div className="field-group">
                <label htmlFor={`guest-${guest.id}`}>Navn på gjest {guestIndex + 1}</label>
                <input id={`guest-${guest.id}`} type="text" value={guest.name} maxLength={200} autoComplete="off" onChange={(event) => {
                  const name = event.target.value
                  setGuests((current) => current.map((entry) => entry.id === guest.id ? { ...entry, name } : entry))
                  setSaveError('')
                }} />
              </div>
            </div>)}
            {guests.length < 100 && (!guests.length || guests[guests.length - 1].name.trim()) && <label className="checkbox-field">
              <input type="checkbox" checked={false} onChange={() => {
                setNobodyAttending(false)
                setGuests((current) => [...current, { id: crypto.randomUUID(), name: '' }])
                setSaveError('')
              }} />
              <span>Andre</span>
            </label>}
          </div>
        </fieldset>
        {saveError && <p className="error-message" role="alert">{saveError}</p>}
        <div className="booking-form__actions">
          <button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? 'Lagrer svar …' : 'Lagre svar'}</button>
          <button className="text-button" type="button" disabled={isSaving} onClick={() => navigate(eventPath, { state: { calendarPath } })}>Avbryt</button>
        </div>
      </form>
      <FamilyEventAttendance attendance={attendance} />
    </article>
  </AppFrame>
}
