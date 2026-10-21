import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppFrame from '../components/AppFrame'
import { useAuth } from '../auth'
import { guides } from '../guideData'
import { deleteOfflineGuides, downloadOfflineGuides, readOfflineGuides, useOnline, type OfflineBundle } from '../offlineGuides'

export default function OfflineContentPage() {
  const { status } = useAuth()
  const online = useOnline()
  const [bundle, setBundle] = useState<OfflineBundle>()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState({ label: '', completed: 0, total: 1 })

  useEffect(() => {
    readOfflineGuides().then(setBundle).catch(() => setError('Kunne ikke lese lagringen på enheten. Sjekk at nettleseren tillater lokal lagring.')).finally(() => setLoading(false))
  }, [])

  async function download() {
    setBusy(true)
    setError('')
    try {
      setBundle(await downloadOfflineGuides((label, completed, total) => setProgress({ label, completed, total })))
    } catch {
      setError('Nedlastingen mislyktes. Sjekk internettilkoblingen og ledig lagringsplass, og prøv igjen. En eventuell tidligere nedlasting er beholdt.')
    } finally { setBusy(false) }
  }

  async function remove() {
    if (!window.confirm('Slette alle nedlastede hytteguider og bilder fra denne enheten?')) return
    setBusy(true)
    setError('')
    try {
      await deleteOfflineGuides()
      setBundle(undefined)
      setProgress({ label: 'Nedlastede guider er slettet.', completed: 0, total: 1 })
    } catch { setError('Kunne ikke slette guidene. Prøv igjen.') }
    finally { setBusy(false) }
  }

  return (
    <AppFrame showAccount>
      <Link className="back-button" to="/">← Til forsiden</Link>
      <div className="overview-heading page-enter">
        <p className="eyebrow">På denne enheten</p>
        <h1>Offline-innhold</h1>
        <p className="lead" role="status" aria-live="polite">
          {online
            ? 'Ta med hytteguidene dit dekningen ikke når.'
            : loading
              ? 'Du er offline. Sjekker hvilke guider som er lagret på enheten …'
              : bundle
                ? 'Du er offline. De nedlastede guidene er klare til bruk, også uten internett.'
                : 'Du er offline og har ingen nedlastede guider på denne enheten. Koble til internett for å laste ned hytteguidene.'}
        </p>
      </div>
      <section className="guide-compact-card offline-card" aria-label="Nedlastede hytteguider" aria-busy={busy || loading}>
        <p>Last ned alle fire guider med spørsmål, veivalg og bilder. Søk i Drift og Feilsøking fungerer også uten nett.</p>
        <ul className="offline-guide-list">
          {Object.values(guides).map((guide) => <li key={guide.id}>
            {bundle ? <Link to={`/guide/${guide.id}`}>{guide.title} <span aria-hidden="true">→</span></Link> : guide.title}
          </li>)}
        </ul>
        {loading ? <p role="status">Leser offline-innhold …</p> : <div className="offline-details">
          <p>{bundle ? 'Alle fire guider er lastet ned.' : 'Ingen guider er lastet ned på denne enheten.'}</p>
          <p><strong>Sist oppdatert:</strong> {bundle ? new Date(bundle.updatedAt).toLocaleString('nb-NO') : 'Aldri'}</p>
          {bundle && <p><strong>Lagringsstørrelse:</strong> {(bundle.bytes / 1024 / 1024).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} MB</p>}
        </div>}
        {busy && <progress aria-label="Nedlastingsfremdrift" value={progress.completed} max={progress.total} />}
        {progress.label && <p role="status" aria-live="polite">{progress.label}</p>}
        {error && <p role="alert">{error}</p>}
        {online && status !== 'authenticated' && <p><Link to="/login">Logg inn</Link> for å laste ned eller oppdatere guidene.</p>}
        <div className="instruction-actions">
          <button className="primary-button" type="button" disabled={busy || loading || !online || status !== 'authenticated'} onClick={download}>
            {bundle ? 'Oppdater hytteguider' : 'Last ned hytteguider'}
          </button>
          {bundle && <button className="secondary-button" type="button" disabled={busy || loading} onClick={remove}>Slett nedlastede guider</button>}
        </div>
        <p className="offline-note">Innholdet lagres bare på denne enheten. Nettleseren kan frigjøre lagring ved plassmangel. Familieopplysninger og private API-svar lastes ikke ned.</p>
      </section>
    </AppFrame>
  )
}
