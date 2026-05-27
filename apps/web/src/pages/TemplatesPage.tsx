import { useSettingsPageData } from '../shared/api/resourceHooks'
import { ResourceScreen } from '../shared/components/ResourceScreen'
import { StatusBadge } from '../shared/components/StatusBadge'
import { placeholderSpecs } from '../shared/data/lumenData'
import { formatRecord } from '../shared/utils/resourceFormat'

const templatesSpec = {
  ...placeholderSpecs.subscription,
  description: 'Manage subscription renderer templates for Xray JSON, Mihomo, Sing-box, Clash, Stash, and response variants.',
  eyebrow: 'Subscription templates',
  primaryAction: 'New template',
  status: 'settings-backed',
  title: 'Templates',
}

export function TemplatesPage() {
  const query = useSettingsPageData()
  const templates = (query.data?.items ?? []).filter((setting) =>
    setting.key.includes('template') || setting.key.includes('subscription'),
  )

  return (
    <ResourceScreen
      caption="Subscription templates"
      columns={['Key', 'Value', 'State']}
      emptyDescription="Template settings will appear after renderer configuration is saved."
      emptyTitle="No template settings"
      error={query.error}
      errorTitle="Templates unavailable"
      isError={query.isError}
      isLoading={query.isLoading}
      isSuccess={query.isSuccess}
      items={templates}
      loadingLabel="Loading templates..."
      onRefresh={() => void query.refetch()}
      renderRow={(template) => ({
        cells: [
          template.key,
          formatRecord(template.value_json),
          <StatusBadge tone="info">settings-backed</StatusBadge>,
        ],
        id: template.id ?? template.key,
      })}
      rightPanel={
        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Renderer set</p>
              <h2>Client formats</h2>
            </div>
            <StatusBadge>6 formats</StatusBadge>
          </div>
          <ul className="feature-list">
            {['Xray JSON', 'Mihomo', 'Stash', 'Sing-box', 'Clash', 'Raw URI'].map((item) => (
              <li key={item}>
                <span>{item}</span>
                <span>Renderer contract scaffolded for compatibility fixtures.</span>
              </li>
            ))}
          </ul>
        </article>
      }
      spec={templatesSpec}
      tableEyebrow="Renderer templates"
      tableTitle="Template registry"
    />
  )
}
