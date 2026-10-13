import type { Office } from '../api/types'
import './components.css'
import { Icon } from './Icon'

// Contact details for the office that owns a topic or handles a referral.
export function OfficeContact({ office }: { office: Office }) {
  return (
    <div className="office-contact">
      <span className="office-contact__icon">
        <Icon name="office" size={22} />
      </span>
      <div>
        <p className="office-contact__name">{office.name}</p>
        <ul className="office-contact__details">
          {office.email && (
            <li>
              <a href={`mailto:${office.email}`}>{office.email}</a>
            </li>
          )}
          {office.phone && (
            <li>
              <a href={`tel:${office.phone}`}>{office.phone}</a>
            </li>
          )}
          {office.url && (
            <li>
              <a href={office.url} target="_blank" rel="noreferrer">
                Office website <Icon name="external" size={14} />
              </a>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
