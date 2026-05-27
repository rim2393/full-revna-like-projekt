import type { MetricTone } from '../data/lumenData'

type StatusBadgeProps = {
  children: string
  tone?: MetricTone
}

export function StatusBadge({ children, tone = 'neutral' }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>
}
