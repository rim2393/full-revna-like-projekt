import { Activity, Fingerprint, Flame, Radar, Route } from 'lucide-react'
import { useNodesPageData, useSubscriptionsPageData, useUsersPageData } from '../shared/api/resourceHooks'
import { DataTable } from '../shared/components/DataTable'
import { EmptyState, ErrorState, LoadingState } from '../shared/components/DataState'
import { PageHeader } from '../shared/components/PageHeader'
import { StatusBadge } from '../shared/components/StatusBadge'

const toolRows = [
  {
    detail: 'Inspect device binding pressure and per-user HWID limits.',
    icon: Fingerprint,
    id: 'hwid',
    name: 'Inspector HWID',
    status: 'ready',
  },
  {
    detail: 'Review subscription response headers and parser hints.',
    icon: Radar,
    id: 'srh',
    name: 'Inspector SRH',
    status: 'ready',
  },
  {
    detail: 'Review active session telemetry from control-plane records.',
    icon: Activity,
    id: 'sessions',
    name: 'Session browser',
    status: 'scaffold',
  },
  {
    detail: 'Report torrent blocker events and policy hits.',
    icon: Flame,
    id: 'torrent',
    name: 'Torrent blocker reports',
    status: 'scaffold',
  },
  {
    detail: 'Preview HApp routing and node affinity decisions.',
    icon: Route,
    id: 'happ',
    name: 'HApp routing',
    status: 'ready',
  },
]

export function ToolsPage() {
  const nodesQuery = useNodesPageData()
  const usersQuery = useUsersPageData()
  const subscriptionsQuery = useSubscriptionsPageData()
  const isLoading = nodesQuery.isLoading || usersQuery.isLoading || subscriptionsQuery.isLoading
  const isError = nodesQuery.isError || usersQuery.isError || subscriptionsQuery.isError

  return (
    <section className="page">
      <PageHeader
        eyebrow="Operational tools"
        title="Tools"
        description="Diagnostics and utility surfaces for device binding, subscription parsing, sessions, torrent policy, and HApp routing."
      />

      {isLoading ? <LoadingState label="Loading tools context..." /> : null}
      {isError ? (
        <ErrorState
          title="Tools unavailable"
          error={nodesQuery.error ?? usersQuery.error ?? subscriptionsQuery.error}
        />
      ) : null}
      {!isLoading && !isError ? (
        <section className="resource-grid">
          <article className="panel panel--wide">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Utility registry</p>
                <h2>Diagnostics</h2>
              </div>
              <StatusBadge>{`${toolRows.length} tools`}</StatusBadge>
            </div>
            <DataTable
              caption="Operational tools"
              columns={['Tool', 'Purpose', 'Status']}
              rows={toolRows.map((tool) => ({
                cells: [
                  tool.name,
                  tool.detail,
                  <StatusBadge tone={tool.status === 'ready' ? 'good' : 'info'}>
                    {tool.status}
                  </StatusBadge>,
                ],
                id: tool.id,
              }))}
            />
          </article>
          <article className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Context loaded</p>
                <h2>Data scope</h2>
              </div>
              <StatusBadge tone="good">online</StatusBadge>
            </div>
            <ul className="feature-list">
              <li>
                <span>Nodes</span>
                <span>{nodesQuery.data?.items.length ?? 0} records available</span>
              </li>
              <li>
                <span>Users</span>
                <span>{usersQuery.data?.items.length ?? 0} records available</span>
              </li>
              <li>
                <span>Subscriptions</span>
                <span>{subscriptionsQuery.data?.items.length ?? 0} records available</span>
              </li>
            </ul>
          </article>
        </section>
      ) : null}
      {!isLoading && !isError && toolRows.length === 0 ? (
        <EmptyState title="No tools registered" description="Tool surfaces will appear here." />
      ) : null}
    </section>
  )
}
