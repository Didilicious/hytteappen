import { useNavigate } from 'react-router-dom'
import AppFrame from '../components/AppFrame'

export default function NewCalendarEntryPage() {
  const navigate = useNavigate()

  return (
    <AppFrame showAccount>
      <button className="back-button" type="button" onClick={() => navigate('/booking')}>
        <span aria-hidden="true">←</span>
        Tilbake til Familiekalender
      </button>
      <div className="booking-intro page-enter">
        <p className="eyebrow">Familiekalender</p>
        <h1>Legg til i kalenderen</h1>
        <p>Hva vil du registrere?</p>
      </div>
      <div className="entry-type-grid page-enter page-enter--delay">
        <button className="entry-type-card" type="button" onClick={() => navigate('/booking/new/booking')}>
          <strong>Hyttebooking</strong>
          <span aria-hidden="true">→</span>
        </button>
        <button className="entry-type-card" type="button" onClick={() => navigate('/booking/new/event')}>
          <strong>Familiearrangement</strong>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </AppFrame>
  )
}
