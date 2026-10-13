import './components.css'
import { Icon, type IconName } from './Icon'

interface ActionCardProps {
  icon: IconName
  title: string
  description: string
  actionLabel: string
  tone: 'browse' | 'search' | 'ask'
  onAction: () => void
}

// One of the three equal-weight entry points (Browse, Search, Ask) on the researcher home page.
export function ActionCard({ icon, title, description, actionLabel, tone, onAction }: ActionCardProps) {
  return (
    <section className={`action-card action-card--${tone}`}>
      <span className="action-card__icon">
        <Icon name={icon} size={40} />
      </span>
      <h2 className="action-card__title">{title}</h2>
      <p className="action-card__description">{description}</p>
      <button type="button" className="button button--secondary" onClick={onAction}>
        {actionLabel} <Icon name="arrowRight" size={16} />
      </button>
    </section>
  )
}
