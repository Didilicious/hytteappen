import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { GuideImage } from '../../shared/guideImages'
import { useAuth } from '../auth'
import AppFrame from '../components/AppFrame'
import DriveIcon, { warnAboutMissingDriveIcons } from '../components/DriveIcon'
import {
  familyEventIconNames,
  familyEventTypeLabels,
  formatFamilyEventDateRange,
  formatFamilyEventTime,
  getFamilyEventOwnerName,
  normalizeFamilyEvent,
  type FamilyEvent,
} from '../familyEvents'
import { loadHomeIcons } from '../guideImages'

type LoadingState = 'loading' | 'ready' | 'not-found' | 'error'

export default function FamilyEventDetailsPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, expireSession } = useAuth()
  const [familyEvent, setFamilyEvent] = useState<FamilyEvent | null>(null)
  const [icon, setIcon] = useState<GuideImage | null | undefined>(undefined)
  const [loadingState, setLoadingState] = useState<LoadingState>('loading')
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [hasRsvp, setHasRsvp] = useState(false)
  const [rsvpState, setRsvpState] = useState<'loading' | 'ready' | 'error'>('loading')

  const loadRsvp = useCallback(async (signal?: AbortSignal) => {
    if (!familyEvent || !currentUser || familyEvent.ownerId === currentUser.id) return
    setRsvpState('loading')
    try {
      const response = await fetch(`/.netlify/functions/family-event-rsvp?id=${encodeURIComponent(familyEvent.id)}`, {
        credentials: 'include', headers: { Accept: 'application/json' }, cache: 'no-store', signal,
      })
      if (response.status === 401) return expireSession()
      if (!response.ok) throw new Error('Failed to load RSVP')
      const body = await response.json() as { rsvp?: unknown }
      if (signal?.aborted) return
      setHasRsvp(Boolean(body.rsvp))
      setRsvpState('ready')
    } catch {
      if (!signal?.aborted) setRsvpState('error')
    }
  }, [familyEvent, currentUser, expireSession])

  useEffect(() => {
    const controller = new AbortController()
    void loadRsvp(controller.signal)
    return () => controller.abort()
  }, [loadRsvp])

  const loadEvent = useCallback(async () => {
    if (!eventId) return setLoadingState('not-found')
    setLoadingState('loading')
    try {
      const response = await fetch(`/.netlify/functions/read-family-event?id=${encodeURIComponent(eventId)}`, {
        credentials: 'include', headers: { Accept: 'application/json' }, cache: 'no-store',
      })
      if (response.status === 401) return expireSession()
      if (response.status === 404) return setLoadingState('not-found')
      if (!response.ok) throw new Error('Failed to load event')
      const body = await response.json() as { event?: unknown }
      const nextEvent = normalizeFamilyEvent(body.event)
      if (!nextEvent) throw new Error('Invalid event')
      setFamilyEvent(nextEvent)
      setLoadingState('ready')
      const iconName = familyEventIconNames[nextEvent.eventType]
      loadHomeIcons([iconName]).then((icons) => setIcon(icons[iconName])).catch(() => {
        setIcon(null)
        warnAboutMissingDriveIcons('arrangementsikonene')
      })
    } catch {
      setLoadingState('error')
    }
  }, [eventId, expireSession])

  useEffect(() => { void loadEvent() }, [loadEvent])

  const returnPath = (location.state as { calendarPath?: string } | null)?.calendarPath ?? '/booking/calendar'

  async function confirmDelete() {
    if (!familyEvent || familyEvent.ownerId !== currentUser?.id || isDeleting) return
    setIsDeleting(true)
    setDeleteError('')
    try {
      const response = await fetch(`/.netlify/functions/delete-family-event?id=${encodeURIComponent(familyEvent.id)}`, {
        method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json' },
      })
      if (response.status === 401) return expireSession()
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: unknown } | null
        setDeleteError(typeof body?.message === 'string' ? body.message : 'Kunne ikke slette arrangementet. Prøv igjen.')
        return
      }
      navigate(returnPath, { replace: true })
    } catch {
      setDeleteError('Kunne ikke slette arrangementet. Sjekk forbindelsen og prøv igjen.')
    } finally {
      setIsDeleting(false)
    }
  }

  if (loadingState !== 'ready' || !familyEvent) {
    return (
      <AppFrame showAccount>
        <div className="booking-details-heading page-enter"><p className="eyebrow">Familiekalender</p><h1>Familiearrangement</h1></div>
        <section className={`booking-details-state${loadingState === 'error' ? ' booking-details-state--error' : ''}`}>
          {loadingState === 'loading' && <p role="status">Henter arrangementet …</p>}
          {loadingState === 'not-found' && <p role="alert">Arrangementet finnes ikke lenger.</p>}
          {loadingState === 'error' && <><p role="alert">Kunne ikke hente arrangementet.</p><button className="secondary-button" type="button" onClick={() => void loadEvent()}>Prøv igjen</button></>}
          {loadingState !== 'loading' && <button className="text-button" type="button" onClick={() => navigate(returnPath)}>Tilbake til kalenderen</button>}
        </section>
      </AppFrame>
    )
  }

  const iconName = familyEventIconNames[familyEvent.eventType]
  const time = formatFamilyEventTime(familyEvent)
  const isOwner = familyEvent.ownerId === currentUser?.id

  return (
    <AppFrame showAccount>
      <button className="back-button" type="button" onClick={() => navigate(returnPath)}><span aria-hidden="true">←</span>Tilbake til kalenderen</button>
      <article className="booking-details-card family-event-details page-enter">
        <div className="family-event-details__icon" aria-hidden="true"><DriveIcon driveIcon={icon} name={iconName} warningLabel="arrangementsikonet" /></div>
        <p className="eyebrow">{familyEventTypeLabels[familyEvent.eventType]}</p>
        <h1>{familyEvent.title}</h1>
        <dl className="booking-details-list">
          <div><dt>Dato</dt><dd>{formatFamilyEventDateRange(familyEvent)}</dd></div>
          {time && <div><dt>Tidspunkt</dt><dd>{time}</dd></div>}
          {familyEvent.location && <div><dt>Sted</dt><dd className="preserve-lines">{familyEvent.location}</dd></div>}
          <div><dt>Arrangør</dt><dd>{getFamilyEventOwnerName(familyEvent.ownerId)}</dd></div>
          {familyEvent.wishlistUrl && <div><dt>Ønskeliste</dt><dd><a className="inline-link" href={familyEvent.wishlistUrl} target="_blank" rel="noreferrer">Se ønskeliste</a></dd></div>}
          {familyEvent.moreInfo && <div><dt>Mer informasjon</dt><dd className="preserve-lines">{familyEvent.moreInfo}</dd></div>}
        </dl>
        {(location.state as { rsvpSaved?: boolean } | null)?.rsvpSaved && <p className="success-message" role="status">Svaret er lagret.</p>}
        {!isOwner && (
          <div className="family-event-rsvp-actions">
            {rsvpState === 'error' ? <>
              <p className="error-message" role="alert">Kunne ikke hente svaret på invitasjonen.</p>
              <button className="secondary-button" type="button" onClick={() => void loadRsvp()}>Prøv igjen</button>
            </> : <button className="primary-button" type="button" disabled={rsvpState === 'loading'} onClick={() => navigate(`/booking/event/${encodeURIComponent(familyEvent.id)}/svar`, { state: { calendarPath: returnPath } })}>
              {rsvpState === 'loading' ? 'Henter svar …' : hasRsvp ? 'Endre svar' : 'Svar på invitasjon'}
            </button>}
          </div>
        )}
        {isOwner && (
          <div className="booking-edit-card__actions">
            <button className="secondary-button" type="button" onClick={() => navigate(`/booking/edit/event/${encodeURIComponent(familyEvent.id)}`)}>Rediger arrangementet</button>
            <button className="danger-button" type="button" onClick={() => { setDeleteError(''); setShowDeleteConfirmation(true) }}>Slett</button>
          </div>
        )}
      </article>
      {isOwner && showDeleteConfirmation && (
        <div className="booking-delete-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isDeleting) setShowDeleteConfirmation(false)
        }}>
          <section className="booking-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
            <h2 id="delete-title">Er du sikker på at du vil slette dette arrangementet?</h2>
            <p id="delete-description">{familyEvent.title}</p>
            {deleteError && <p className="error-message" role="alert">{deleteError}</p>}
            <div className="booking-delete-dialog__actions">
              <button className="secondary-button" type="button" onClick={() => setShowDeleteConfirmation(false)} disabled={isDeleting}>Avbryt</button>
              <button className="danger-button" type="button" onClick={() => void confirmDelete()} disabled={isDeleting}>{isDeleting ? 'Sletter …' : 'Slett'}</button>
            </div>
          </section>
        </div>
      )}
    </AppFrame>
  )
}
