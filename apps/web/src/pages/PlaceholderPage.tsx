import { ArrowRight, Plus, Search } from 'lucide-react'
import { PageHeader } from '../shared/components/PageHeader'
import { StatusBadge } from '../shared/components/StatusBadge'
import type { PlaceholderSpec } from '../shared/data/lumenData'

type PlaceholderPageProps = {
  spec: PlaceholderSpec
}

export function PlaceholderPage({ spec }: PlaceholderPageProps) {
  const Icon = spec.icon

  return (
    <section className="page">
      <PageHeader
        eyebrow={spec.eyebrow}
        title={spec.title}
        description={spec.description}
        actions={
          <>
            <button type="button" className="button button--secondary">
              <Search size={18} aria-hidden="true" />
              Filter
            </button>
            <button type="button" className="button button--primary">
              <Plus size={18} aria-hidden="true" />
              {spec.primaryAction}
            </button>
          </>
        }
      />
      <div className="placeholder-layout">
        <article className="placeholder-card placeholder-card--primary">
          <div className="placeholder-card__icon" aria-hidden="true">
            <Icon size={28} />
          </div>
          <div>
            <StatusBadge>{spec.status}</StatusBadge>
            <h2>{spec.title} workspace</h2>
            <p>
              This surface is ready for API integration, table state, permissions, optimistic
              mutations, and audit-safe events.
            </p>
          </div>
        </article>
        <article className="placeholder-card">
          <h2>Expected controls</h2>
          <ul className="feature-list">
            {spec.items.map((item) => (
              <li key={item}>
                <ArrowRight size={16} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  )
}
