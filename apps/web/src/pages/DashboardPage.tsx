import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MetricCard } from '../shared/components/MetricCard'
import { PageHeader } from '../shared/components/PageHeader'
import { StatusBadge } from '../shared/components/StatusBadge'
import { getDashboardOverview } from '../shared/data/lumenData'

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryFn: getDashboardOverview,
    queryKey: ['dashboard-overview'],
  })

  return (
    <section className="page">
      <PageHeader
        eyebrow="Lumen control plane"
        title="Command dashboard"
        description="A first pass over identity, delivery health, and Guard posture for the VPN admin surface."
        actions={
          <Link to="/guard/portal" className="button button--secondary">
            Guard portal
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        }
      />

      {isLoading || !data ? (
        <p className="loading-state" aria-live="polite">
          Loading dashboard overview...
        </p>
      ) : (
        <>
          <section className="metrics-grid" aria-label="Dashboard metrics">
            {data.metrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </section>

          <section className="dashboard-grid">
            <article className="panel">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Recent operations</p>
                  <h2>Activity lane</h2>
                </div>
                <StatusBadge tone="good">Live mock</StatusBadge>
              </div>
              <ul className="activity-list">
                {data.activityFeed.map((event) => (
                  <li key={event.label}>
                    <CheckCircle2 size={18} aria-hidden="true" />
                    <span>{event.label}</span>
                    <small>{event.meta}</small>
                  </li>
                ))}
              </ul>
            </article>

            <article className="panel">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Attention</p>
                  <h2>Risk watch</h2>
                </div>
                <Clock3 size={20} aria-hidden="true" />
              </div>
              <div className="risk-list">
                {data.riskItems.map((item) => {
                  const Icon = item.icon

                  return (
                    <div key={item.label} className="risk-row">
                      <Icon size={18} aria-hidden="true" />
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  )
                })}
              </div>
            </article>
          </section>
        </>
      )}
    </section>
  )
}
