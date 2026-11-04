import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppFrame from '../components/AppFrame'
import { notificationLabels, type NotificationPreferences } from '../../shared/pushNotifications'

const apiPath = '/.netlify/functions/push-notifications'
async function pushRequest(action: string, subscription?: PushSubscription, preferences?: NotificationPreferences) {
  const response = await fetch(apiPath, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, subscription: subscription?.toJSON(), preferences }),
  })
  const body = await response.json()
  if (!response.ok) throw Object.assign(new Error(body.message || 'Kunne ikke lagre varsler.'), { expired: body.expired })
  return body
}

function applicationServerKey(value: string) {
  const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}

export default function NotificationSettingsPage() {
  const supported = typeof Notification !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && window.isSecureContext
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported')
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [publicKey, setPublicKey] = useState('')
  const [preferences, setPreferences] = useState<NotificationPreferences>()
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch(apiPath, { credentials: 'include' })
        if (!response.ok) throw new Error('Kunne ikke hente varselinnstillinger. Last siden på nytt for å prøve igjen.')
        const data = await response.json()
        // getRegistration avoids waiting forever when a development server has no worker.
        const registration = supported ? await navigator.serviceWorker.getRegistration() : undefined
        const current = await registration?.pushManager.getSubscription() ?? null
        const status = current ? await pushRequest('status', current) : { enabled: false }
        if (active) {
          setPublicKey(data.publicKey)
          setPreferences(data.preferences)
          setSubscription(current)
          setEnabled(status.enabled)
        }
      } catch (error) { if (active) setError((error as Error).message) }
      finally { if (active) setLoading(false) }
    }
    void load()
    const refreshPermission = () => { if (supported) setPermission(Notification.permission) }
    window.addEventListener('focus', refreshPermission)
    return () => { active = false; window.removeEventListener('focus', refreshPermission) }
  }, [supported])

  async function perform(action: 'enable' | 'disable' | 'test' | 'preferences') {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (action === 'enable') {
        // Keep permission request in the click gesture for iOS Home Screen PWAs.
        const result = await Notification.requestPermission()
        setPermission(result)
        if (result !== 'granted') throw new Error('Varsler er ikke tillatt. Du kan endre tillatelsen i enhets- eller nettleserinnstillingene.')
        const registration = await navigator.serviceWorker.getRegistration()
        if (!registration?.active) throw new Error('Appen er ikke klar for varsler. Oppdater appen og prøv igjen.')
        let current = await registration.pushManager.getSubscription()
        if (!current) current = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) })
        setSubscription(current)
        await pushRequest('enable', current)
        setEnabled(true)
        setMessage('Varsler er aktivert på denne enheten.')
      } else if (action === 'disable') {
        if (subscription) {
          await pushRequest('disable', subscription)
          setEnabled(false)
          const removed = await subscription.unsubscribe()
          if (!removed) throw new Error('Varsler er slått av på serveren. Prøv igjen for å fjerne abonnementet fra nettleseren.')
        }
        setSubscription(null)
        setEnabled(false)
        setMessage('Varsler er deaktivert på denne enheten. Andre enheter er ikke endret.')
      } else if (action === 'test') {
        if (!subscription) return
        await pushRequest('test', subscription)
        setMessage('Testvarselet er sendt. Levering avhenger av enhetens varselinnstillinger.')
      } else {
        await pushRequest('preferences', undefined, preferences)
        setMessage('Familiens varselinnstillinger er lagret.')
      }
    } catch (error) {
      if ((error as { expired?: boolean }).expired) {
        setEnabled(false)
        await subscription?.unsubscribe().catch(() => {})
        setSubscription(null)
      }
      setError(error instanceof Error ? error.message : 'Kunne ikke behandle varsler. Prøv igjen.')
    } finally { setBusy(false) }
  }

  const permissionLabel = permission === 'granted' ? 'Tillatt' : permission === 'denied' ? 'Blokkert' : permission === 'default' ? 'Ikke forespurt' : 'Ikke støttet'
  return <AppFrame showAccount>
    <Link className="back-button" to="/innstillinger">← Innstillinger</Link>
    <div className="overview-heading"><p className="eyebrow">Innstillinger</p><h1>Varsler</h1>
      <p className="lead">Velg varsler for familien og denne enheten.</p></div>
    <section className="guide-compact-card notification-settings" aria-busy={busy || loading}>
      <h2>Denne enheten</h2>
      <p>Tillatelse: <strong>{permissionLabel}</strong></p>
      <p>Varsler: <strong>{enabled && permission === 'granted' ? 'Aktivert' : 'Deaktivert'}</strong></p>
      {ios && !standalone && <p>På iPhone og iPad: Legg Hytteappen til på Hjem-skjermen fra Del-menyen i Safari, og åpne appen derfra for å aktivere varsler. Krever iOS/iPadOS 16.4 eller nyere.</p>}
      {!supported && <p>Denne nettleseren støtter ikke pushvarsler her. Bruk en oppdatert nettleser eller åpne appen fra Hjem-skjermen.</p>}
      {permission === 'denied' && <p>Tillat varsler i enhets- eller nettleserinnstillingene for å aktivere dem igjen.</p>}
      {loading && <p role="status">Henter innstillinger …</p>}
      <div className="notification-actions">
        <button className="primary-button" disabled={busy || loading || !supported || !publicKey || (ios && !standalone) || permission === 'denied' || enabled} onClick={() => void perform('enable')}>Aktiver varsler</button>
        <button className="secondary-button" disabled={busy || loading || !subscription} onClick={() => void perform('disable')}>Deaktiver varsler</button>
        <button className="secondary-button" disabled={busy || loading || !enabled || permission !== 'granted'} onClick={() => void perform('test')}>Send testvarsel</button>
      </div>
    </section>
    <section className="guide-compact-card notification-settings">
      <h2>Familiens varsler</h2><p>Disse valgene gjelder alle familiens enheter. Automatiske varsler er ikke aktivert ennå.</p>
      {preferences && <form onSubmit={(event) => { event.preventDefault(); void perform('preferences') }}>
        <fieldset disabled={busy || loading}><legend>Varsle familien om</legend>
          {(Object.keys(notificationLabels) as Array<keyof NotificationPreferences>).map((key) => <label className="notification-option" key={key}>
            <input type="checkbox" checked={preferences[key]} onChange={(event) => setPreferences({ ...preferences, [key]: event.target.checked })} />
            <span>{notificationLabels[key]}</span>
          </label>)}
        </fieldset>
        <button className="primary-button" disabled={busy || loading} type="submit">Lagre varselinnstillinger</button>
      </form>}
    </section>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </AppFrame>
}
