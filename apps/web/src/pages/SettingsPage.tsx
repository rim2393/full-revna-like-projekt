import { useState, type FormEvent } from 'react'
import { useSettingsPageData, useUpdateSetting } from '../shared/api/resourceHooks'
import {
  FormError,
  ResourceScreen,
  ScreenForm,
  SubmitButton,
} from '../shared/components/ResourceScreen'
import { StatusBadge } from '../shared/components/StatusBadge'
import { placeholderSpecs } from '../shared/data/lumenData'
import { formatDateTime, formatRecord, parseKeyValueInput } from '../shared/utils/resourceFormat'

const settingsSpec = {
  ...placeholderSpecs.subscription,
  description:
    'Manage subscription information, auth provider toggles, response headers, and panel-wide metadata.',
  eyebrow: 'Control plane settings',
  primaryAction: 'Save setting',
  status: 'Live settings',
  title: 'Settings',
}

export function SettingsPage() {
  const query = useSettingsPageData()
  const updateSetting = useUpdateSetting()
  const settings = query.data?.items ?? []
  const [key, setKey] = useState('subscription.info')
  const [value, setValue] = useState('title=LUMEN, auto_update_hours=2')
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    try {
      await updateSetting.mutateAsync({
        key: key.trim(),
        request: { value_json: parseKeyValueInput(value) },
      })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Setting could not be saved.')
    }
  }

  return (
    <ResourceScreen
      caption="Panel setting inventory"
      columns={['Key', 'Value', 'Updated by', 'Updated']}
      createForm={
        <ScreenForm onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">Upsert setting</p>
            <h2>Safe JSON value</h2>
            <p>Settings are written as key=value fields; secret-like keys are rejected.</p>
          </div>
          <label htmlFor="setting-key">
            Key
            <input id="setting-key" required value={key} onChange={(event) => setKey(event.target.value)} />
          </label>
          <label htmlFor="setting-value">
            Value
            <textarea id="setting-value" required value={value} onChange={(event) => setValue(event.target.value)} />
          </label>
          <FormError message={formError} />
          {updateSetting.isSuccess ? (
            <p className="auth-card__note" aria-live="polite">
              Setting saved.
            </p>
          ) : null}
          <SubmitButton pending={updateSetting.isPending}>Save setting</SubmitButton>
        </ScreenForm>
      }
      emptyDescription="Panel settings appear after an administrator saves the first setting."
      emptyTitle="No settings saved"
      error={query.error}
      errorTitle="Settings unavailable"
      isError={query.isError}
      isLoading={query.isLoading}
      isSuccess={query.isSuccess}
      items={settings}
      loadingLabel="Loading settings..."
      onRefresh={() => void query.refetch()}
      renderRow={(setting) => ({
        cells: [
          setting.key,
          formatRecord(setting.value_json),
          setting.updated_by ?? 'system',
          formatDateTime(setting.updated_at),
        ],
        id: setting.id ?? setting.key,
      })}
      rightPanel={
        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Authentication</p>
              <h2>Provider toggles</h2>
            </div>
            <StatusBadge>google-ready</StatusBadge>
          </div>
          <ul className="feature-list">
            <li>
              <span>Telegram</span>
              <span>API-key controlled bot integration can be enabled here later.</span>
            </li>
            <li>
              <span>Passkey</span>
              <span>WebAuthn-ready surface is tracked without enabling insecure fallback flows.</span>
            </li>
            <li>
              <span>Generic OAuth2</span>
              <span>Provider metadata stays in backend settings, not hard-coded in UI.</span>
            </li>
          </ul>
        </article>
      }
      spec={settingsSpec}
      tableEyebrow="Instance settings"
      tableTitle="Settings registry"
    />
  )
}
