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
        {isOwner && <button className="secondary-button" type="button" onClick={() => navigate(`/booking/edit/event/${encodeURIComponent(familyEvent.id)}`)}>Rediger arrangementet</button>}
      </article>
    </AppFrame>
  )
}
