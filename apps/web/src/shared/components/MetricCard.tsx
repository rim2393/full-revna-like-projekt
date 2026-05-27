import type { DashboardMetric } from '../data/lumenData'
import { StatusBadge } from './StatusBadge'

type MetricCardProps = {
  metric: DashboardMetric
}

export function MetricCard({ metric }: MetricCardProps) {
  const Icon = metric.icon

  return (
    <article className="metric-card">
      <div className="metric-card__icon" aria-hidden="true">
        <Icon size={20} />
      </div>
      <div>
        <p>{metric.label}</p>
        <strong>{metric.value}</strong>
      </div>
      <StatusBadge tone={metric.tone}>{metric.detail}</StatusBadge>
    </article>
  )
}
