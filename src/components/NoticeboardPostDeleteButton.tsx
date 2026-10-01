import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NoticeboardPost } from '../../shared/noticeboard'
import { useAuth } from '../auth'
import { normalizeFamilyEvent, type FamilyEvent } from '../familyEvents'

export default function NoticeboardPostDeleteButton({ post }: { post: NoticeboardPost }) {
  const { currentUser, expireSession } = useAuth()
  const navigate = useNavigate()
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const [linkedEvent, setLinkedEvent] = useState<FamilyEvent | null>(null)
  const [linkStatus, setLinkStatus] = useState<'loading' | 'ready' | 'error'>('ready')
  const [retryKey, setRetryKey] = useState(0)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (showConfirmation) dialog?.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [showConfirmation])

  useEffect(() => {
    if (!showConfirmation || !post.eventId) return
    const eventId = post.eventId
    const controller = new AbortController()
    async function checkLinkedEvent() {
      setLinkStatus('loading')
      setLinkedEvent(null)
      setError('')
      try {
        const response = await fetch(`/.netlify/functions/read-family-event?id=${encodeURIComponent(eventId)}`, {
          credentials: 'include', headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal,
        })
        if (controller.signal.aborted) return
        if (response.status === 401) return expireSession()
        if (response.status !== 404) {
          if (!response.ok) throw new Error('Failed to load linked event')
          const body = await response.json() as { event?: unknown }
          const event = normalizeFamilyEvent(body.event)
          if (!event || event.id !== post.eventId) throw new Error('Invalid linked event')
          if (controller.signal.aborted) return
          setLinkedEvent(event)
        }
        setLinkStatus('ready')
      } catch {
        if (!controller.signal.aborted) {
          setLinkStatus('error')
          setError('Kunne ikke sjekke det tilknyttede arrangementet. Prøv igjen.')
        }
      }
    }
    void checkLinkedEvent()
    return () => controller.abort()
  }, [showConfirmation, post.eventId, expireSession, retryKey])

  if (currentUser?.id !== post.ownerId) return null

  async function confirmDelete(deleteLinkedEvent = false) {
    if (isDeleting || linkStatus !== 'ready') return
    setIsDeleting(true)
    setError('')
    try {
      const response = await fetch(`/.netlify/functions/delete-noticeboard-post?id=${encodeURIComponent(post.id)}${deleteLinkedEvent ? '&deleteLinkedEvent=true' : ''}`, {
        method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json' },
      })
      if (response.status === 401) return expireSession()
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: unknown } | null
        throw new Error(typeof body?.message === 'string' ? body.message : 'Kunne ikke slette innlegget. Prøv igjen.')
      }
      setShowConfirmation(false)
      navigate('/noticeboard', { replace: true })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Kunne ikke slette innlegget. Sjekk forbindelsen og prøv igjen.')
    } finally {
      setIsDeleting(false)
    }
  }

  return <>
    <button className="danger-button" type="button" aria-haspopup="dialog" onClick={() => {
      setError('')
      setLinkedEvent(null)
      setLinkStatus(post.eventId ? 'loading' : 'ready')
      setShowConfirmation(true)
    }}>Slett</button>
    {showConfirmation && <dialog ref={dialogRef} className="booking-delete-dialog noticeboard-delete-dialog"
      aria-labelledby={titleId} aria-describedby={descriptionId}
      onClose={() => setShowConfirmation(false)}
      onCancel={(event) => { event.preventDefault(); if (!isDeleting) setShowConfirmation(false) }}
      onClick={(event) => { if (event.target === event.currentTarget && !isDeleting) setShowConfirmation(false) }}>
      <h2 id={titleId}>{linkedEvent ? 'Vil du også slette arrangementet fra kalenderen?' : 'Er du sikker på at du vil slette?'}</h2>
      <p id={descriptionId}>{post.title}</p>
      {linkStatus === 'loading' && <p role="status">Sjekker tilknyttet arrangement …</p>}
      {linkedEvent && linkedEvent.ownerId !== currentUser?.id && <p>Du kan bare slette dine egne arrangementer. Innlegget kan slettes uten å slette arrangementet.</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className={`booking-delete-dialog__actions${linkedEvent ? ' booking-delete-dialog__actions--linked' : ''}`}>
        <button className="secondary-button" type="button" autoFocus disabled={isDeleting} onClick={() => setShowConfirmation(false)}>Avbryt</button>
        {linkStatus === 'error' && <button className="secondary-button" type="button" onClick={() => setRetryKey((value) => value + 1)}>Prøv igjen</button>}
        <button className="danger-button" type="button" disabled={isDeleting || linkStatus !== 'ready'} onClick={() => void confirmDelete()}>{isDeleting ? 'Sletter …' : linkedEvent ? 'Slett bare innlegget' : 'Slett'}</button>
        {linkedEvent && <button className="danger-button" type="button" disabled={isDeleting || linkStatus !== 'ready' || linkedEvent.ownerId !== currentUser?.id} onClick={() => void confirmDelete(true)}>Slett begge</button>}
      </div>
    </dialog>}
  </>
}
