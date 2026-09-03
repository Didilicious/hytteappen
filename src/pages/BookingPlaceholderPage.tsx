import { useNavigate } from 'react-router-dom'
import AppFrame from '../components/AppFrame'

type BookingPlaceholderPageProps = {
  title: string
}

export default function BookingPlaceholderPage({ title }: BookingPlaceholderPageProps) {
  const navigate = useNavigate()

  return (
    <AppFrame showAccount>
      <div className="booking-placeholder page-enter">
        <p className="eyebrow">Familiekalender</p>
        <h1>{title}</h1>
        <p className="lead">Denne siden er ikke ferdig ennå.</p>

        <button className="secondary-button" type="button" onClick={() => navigate('/booking')}>
          <span aria-hidden="true">←</span>
          Tilbake til booking
        </button>
      </div>
    </AppFrame>
  )
}
