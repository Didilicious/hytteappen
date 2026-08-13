import { Link, useParams } from 'react-router-dom'
import AppFrame from '../components/AppFrame'
import ProfilePlaceholder from '../components/ProfilePlaceholder'
import { getFamily } from '../families'

export default function FamilyProfilePage() {
  const { familyId } = useParams()
  const family = getFamily(familyId)

  if (!family) {
    return (
      <AppFrame showAccount>
        <Link className="back-button" to="/familieoversikt">
          <span aria-hidden="true">←</span>
          Tilbake til familieoversikten
        </Link>

        <section className="family-not-found page-enter" aria-labelledby="family-not-found-title">
          <p className="eyebrow">Familieoversikt</p>
          <h1 id="family-not-found-title">Familien ble ikke funnet</h1>
          <p>Familien finnes ikke i oversikten. Du kan gå tilbake og velge en annen familie.</p>
          <Link className="secondary-button" to="/familieoversikt">Se alle familier</Link>
        </section>
      </AppFrame>
    )
  }

  return (
    <AppFrame showAccount>
      <Link className="back-button" to="/familieoversikt">
        <span aria-hidden="true">←</span>
        Tilbake til familieoversikten
      </Link>

      <header className="family-profile-heading page-enter">
        <ProfilePlaceholder variant="family" />
        <div>
          <p className="eyebrow">Familieprofil</p>
          <h1>{family.displayName}</h1>
        </div>
      </header>

      <section className="family-member-section page-enter page-enter--delay" aria-labelledby="family-members-title">
        <h2 id="family-members-title">Familiemedlemmer</h2>
        <div className="family-member-grid">
          {family.members.map((member) => (
            <article className="family-member-card" key={member.id}>
              <ProfilePlaceholder variant="member" />
              <h3>{member.displayName}</h3>
            </article>
          ))}
        </div>
      </section>
    </AppFrame>
  )
}
