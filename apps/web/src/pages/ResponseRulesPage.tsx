import { useSettingsPageData } from '../shared/api/resourceHooks'
import { ResourceScreen } from '../shared/components/ResourceScreen'
import { StatusBadge } from '../shared/components/StatusBadge'
import { placeholderSpecs } from '../shared/data/lumenData'
import { formatRecord } from '../shared/utils/resourceFormat'

const rulesSpec = {
  ...placeholderSpecs.subscription,
  description: 'Control response rules for expired, limited, disabled, and unknown subscription states.',
  eyebrow: 'Response rules',
  primaryAction: 'Save rule',
  status: 'settings-backed',
  title: 'Response Rules',
}

export function ResponseRulesPage() {
  const query = useSettingsPageData()
  const rules = (query.data?.items ?? []).filter((setting) =>
    setting.key.includes('rule') || setting.key.includes('response'),
  )
  const items = rules.length > 0 ? rules : query.data?.items ?? []

  return (
    <ResourceScreen
      caption="Response rules"
      columns={['Key', 'Value', 'Effect']}
      emptyDescription="Response rule settings will appear after policy configuration is saved."
      emptyTitle="No response rules"
      error={query.error}
      errorTitle="Response rules unavailable"
      isError={query.isError}
      isLoading={query.isLoading}
      isSuccess={query.isSuccess}
      items={items}
      loadingLabel="Loading response rules..."
      onRefresh={() => void query.refetch()}
      renderRow={(rule) => ({
        cells: [
          rule.key,
          formatRecord(rule.value_json),
          <StatusBadge tone="watch">policy</StatusBadge>,
        ],
        id: rule.id ?? rule.key,
      })}
      rightPanel={
        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">State mapping</p>
              <h2>Subscription outcomes</h2>
            </div>
            <StatusBadge>guarded</StatusBadge>
          </div>
          <ul className="feature-list">
            {['ACTIVE', 'EXPIRED', 'LIMITED', 'DISABLED'].map((item) => (
              <li key={item}>
                <span>{item}</span>
                <span>Dedicated response branch ready for backend renderer policy.</span>
              </li>
            ))}
          </ul>
        </article>
      }
      spec={rulesSpec}
      tableEyebrow="Subscription policy"
      tableTitle="Response rule registry"
    />
  )
}
