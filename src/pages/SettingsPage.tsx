import { Link } from 'react-router-dom'
import AppFrame from '../components/AppFrame'

export default function SettingsPage() {
  return <AppFrame showAccount>
    <Link className="back-button" to="/">← Til forsiden</Link>
    <div className="overview-heading"><h1>Innstillinger</h1></div>
    <section className="guide-compact-card notification-settings">
      <h2><Link to="/innstillinger/varsler">Varsler →</Link></h2>
      <p>Administrer varsler på denne enheten og familiens varselinnstillinger.</p>
    </section>
  </AppFrame>
}
