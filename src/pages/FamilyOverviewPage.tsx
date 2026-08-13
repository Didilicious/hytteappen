import { Link, useNavigate } from 'react-router-dom'
import AppFrame from '../components/AppFrame'
import ProfileImage from '../components/ProfileImage'
import { families } from '../families'

export default function FamilyOverviewPage() {
  const navigate = useNavigate()

  return (
    <AppFrame showAccount>
      <button className="back-button" type="button" onClick={() => navigate('/')}>
        <span aria-hidden="true">←</span>
        Tilbake
      </button>

      <div className="family-overview-heading page-enter">
        <p className="eyebrow">Familien</p>
        <h1>Familieoversikt</h1>
        <p>Velg en familie for å se familiemedlemmene.</p>
      </div>

      <div className="family-grid page-enter page-enter--delay">
        {families.map((family) => (
          <Link
            className="family-card"
            key={family.accountId}
            to={`/familieoversikt/${family.accountId}`}
          >
            <ProfileImage
              familyId={family.accountId}
              variant="family"
              alt={`Familiebilde for ${family.displayName}`}
            />
            <span className="family-card__content">
              <span className="family-card__name">{family.displayName}</span>
              <span className="family-card__members">
                {family.members.map((member) => member.displayName).join(', ')}
              </span>
            </span>
            <span className="family-card__arrow" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </AppFrame>
  )
}
