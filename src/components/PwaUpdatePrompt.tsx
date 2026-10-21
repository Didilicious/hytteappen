import { useEffect, useRef, useState } from 'react'

export default function PwaUpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [updating, setUpdating] = useState(false)
  const reloadRequested = useRef(false)

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    let disposed = false
    let registration: ServiceWorkerRegistration | undefined
    let installing: ServiceWorker | null = null
    let timer: ReturnType<typeof setInterval> | undefined

    const showWaiting = () => {
      if (!disposed && registration?.waiting && navigator.serviceWorker.controller) {
        setWaiting(registration.waiting)
      }
    }
    const watchInstalling = () => {
      installing?.removeEventListener('statechange', showWaiting)
      installing = registration?.installing ?? null
      installing?.addEventListener('statechange', showWaiting)
    }
    const checkForUpdate = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void registration?.update().catch(() => { /* Retry on the next online/visibility event. */ })
      }
    }
    const reload = () => {
      if (reloadRequested.current) window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', reload)
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((result) => {
        if (disposed) return
        registration = result
        showWaiting()
        watchInstalling()
        registration.addEventListener('updatefound', watchInstalling)
        document.addEventListener('visibilitychange', checkForUpdate)
        window.addEventListener('online', checkForUpdate)
        timer = setInterval(checkForUpdate, 60 * 60 * 1000)
        checkForUpdate()
      })
      .catch(() => { /* The online app remains usable if registration is unavailable. */ })

    return () => {
      disposed = true
      clearInterval(timer)
      installing?.removeEventListener('statechange', showWaiting)
      registration?.removeEventListener('updatefound', watchInstalling)
      navigator.serviceWorker.removeEventListener('controllerchange', reload)
      document.removeEventListener('visibilitychange', checkForUpdate)
      window.removeEventListener('online', checkForUpdate)
    }
  }, [])

  if (!waiting) return null

  return (
    <aside className="pwa-update" aria-label="Appoppdatering">
      <p role="status">En ny versjon av Hytteappen er klar. Lagre det du jobber med før du oppdaterer.</p>
      <div className="pwa-update__actions">
        <button type="button" disabled={updating} onClick={() => {
          reloadRequested.current = true
          setUpdating(true)
          waiting.postMessage({ type: 'SKIP_WAITING' })
        }}>{updating ? 'Oppdaterer …' : 'Oppdater nå'}</button>
        <button type="button" disabled={updating} onClick={() => setWaiting(null)}>Senere</button>
      </div>
    </aside>
  )
}
