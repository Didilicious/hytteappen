import { useNavigate } from 'react-router-dom'
import { useSection } from '../sections'

export default function SectionSelect() {
  const navigate = useNavigate()
  const section = useSection()

  return (
    <select
      className="section-select"
      aria-label="Velg seksjon"
      value=""
      onChange={(event) => navigate(event.target.value)}
    >
      {/* Keep destinations unselected so choosing the active section still triggers navigation. */}
      <option value="" disabled hidden>{section === 'hytta' ? 'Hytta' : section === 'familien' ? 'Familien' : 'Forsiden'}</option>
      <option value="/">Forsiden</option>
      <option value="/hytta">Hytta</option>
      <option value="/familien">Familien</option>
    </select>
  )
}
