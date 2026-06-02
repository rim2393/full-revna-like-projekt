import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Copy, Edit3, Trash2 } from 'lucide-react'
import {
  useCreateResponseRule,
  useDeleteResponseRule,
  useReorderResponseRules,
  useResponseRulesData,
  useTestResponseRule,
  useUpdateResponseRule,
} from '../shared/api/resourceHooks'
import type { ResponseRuleCreateRequest, ResponseRuleRecord, ResponseRuleUpdateRequest } from '../shared/api/types'
import {
  FormError,
  ResourceScreen,
  ScreenForm,
  SubmitButton,
} from '../shared/components/ResourceScreen'
import { StatusBadge } from '../shared/components/StatusBadge'
import { sectionSpecs } from '../shared/data/resourceMeta'
import { formatRecord } from '../shared/utils/resourceFormat'

const rulesSpec = {
  ...sectionSpecs.subscription,
  description:
    'Control real public subscription responses for expired, limited, disabled, revoked and custom subscription states.',
  eyebrow: 'Response rules',
  primaryAction: 'Save rule',
  status: 'api-backed',
  title: 'Response Rules',
}

type RuleEditorState = {
  body: string
  enabled: boolean
  headers: string
  name: string
  statusCode: string
  triggerStatus: string
}

const defaultRuleBody = 'Subscription expired'
const defaultRuleHeaders = '{"X-Lumen-Reason":"expired"}'

export function ResponseRulesPage() {
  const query = useResponseRulesData()
  const createRule = useCreateResponseRule()
  const updateRule = useUpdateResponseRule()
  const deleteRule = useDeleteResponseRule()
  const reorderRules = useReorderResponseRules()
  const testRule = useTestResponseRule()
  const rules = query.data?.items ?? []
  const [name, setName] = useState('')
  const [triggerStatus, setTriggerStatus] = useState('expired')
  const [statusCode, setStatusCode] = useState('403')
  const [body, setBody] = useState(defaultRuleBody)
  const [headers, setHeaders] = useState(defaultRuleHeaders)
  const [testStatus, setTestStatus] = useState('expired')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedRule = useMemo(
    () => rules.find((rule) => rule.id === selectedId) ?? rules[0],
    [rules, selectedId],
  )
  const [editor, setEditor] = useState<RuleEditorState>({
    body: '',
    enabled: true,
    headers: '{}',
    name: '',
    statusCode: '200',
    triggerStatus: 'expired',
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [editorError, setEditorError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedRule) {
      return
    }
    setSelectedId(selectedRule.id)
    setEditor(ruleToEditor(selectedRule))
    setTestStatus(selectedRule.trigger_status)
  }, [selectedRule])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    try {
      await createRule.mutateAsync({
        body,
        enabled: true,
        headers: parseHeaders(headers),
        name: name.trim(),
        status_code: Number(statusCode),
        trigger_status: triggerStatus.trim(),
      })
      setName('')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Response rule could not be saved.')
    }
  }

  async function saveSelectedRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedRule) {
      return
    }
    setEditorError(null)
    try {
      await updateRule.mutateAsync({
        id: selectedRule.id,
        request: editorToRequest(editor),
      })
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Response rule could not be updated.')
    }
  }

  async function cloneRule(rule: ResponseRuleRecord) {
    const request: ResponseRuleCreateRequest = {
      body: rule.body,
      enabled: rule.enabled,
      headers: rule.headers,
      name: `${rule.name} copy`,
      status_code: rule.status_code,
      trigger_status: rule.trigger_status,
    }
    await createRule.mutateAsync(request)
  }

  async function moveRule(rule: ResponseRuleRecord, direction: -1 | 1) {
    const index = rules.findIndex((item) => item.id === rule.id)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= rules.length) {
      return
    }
    const ids = rules.map((item) => item.id)
    const [id] = ids.splice(index, 1)
    ids.splice(targetIndex, 0, id)
    await reorderRules.mutateAsync(ids)
  }

  return (
    <ResourceScreen
      caption="Response rules"
      columns={['Name', 'Trigger', 'Status', 'Headers', 'Enabled', 'Actions']}
      createForm={
        <ScreenForm onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">Create rule</p>
            <h2>Subscription outcome</h2>
            <p>
              Persist response mapping for subscription status branches. Public rendering
              applies the first enabled matching rule by order.
            </p>
          </div>
          <RuleFields
            body={body}
            headers={headers}
            name={name}
            prefix="create"
            statusCode={statusCode}
            triggerStatus={triggerStatus}
            onBodyChange={setBody}
            onHeadersChange={setHeaders}
            onNameChange={setName}
            onStatusCodeChange={setStatusCode}
            onTriggerStatusChange={setTriggerStatus}
          />
          <FormError message={formError} />
          <SubmitButton pending={createRule.isPending}>Create rule</SubmitButton>
        </ScreenForm>
      }
      emptyDescription="Create response rules for expired, limited, disabled, revoked, inactive, or custom subscription states."
      emptyTitle="No response rules"
      error={query.error}
      errorTitle="Response rules unavailable"
      isError={query.isError}
      isLoading={query.isLoading}
      isSuccess={query.isSuccess}
      items={rules}
      loadingLabel="Loading response rules..."
      onRefresh={() => void query.refetch()}
      renderRow={(rule) => ({
        cells: [
          rule.name,
          rule.trigger_status,
          String(rule.status_code),
          formatRecord(rule.headers),
          <StatusBadge tone={rule.enabled ? 'good' : 'neutral'}>{rule.enabled ? 'enabled' : 'disabled'}</StatusBadge>,
          <div className="inline-actions">
            <button type="button" className="icon-button" aria-label={`Edit ${rule.name}`} onClick={() => setSelectedId(rule.id)}>
              <Edit3 size={16} aria-hidden="true" />
            </button>
            <button type="button" className="icon-button" aria-label={`Move ${rule.name} up`} onClick={() => void moveRule(rule, -1)}>
              <ArrowUp size={16} aria-hidden="true" />
            </button>
            <button type="button" className="icon-button" aria-label={`Move ${rule.name} down`} onClick={() => void moveRule(rule, 1)}>
              <ArrowDown size={16} aria-hidden="true" />
            </button>
            <button type="button" className="icon-button" aria-label={`Clone ${rule.name}`} onClick={() => void cloneRule(rule)}>
              <Copy size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void updateRule.mutateAsync({ id: rule.id, request: { enabled: !rule.enabled } })}
            >
              Toggle
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Delete ${rule.name}`}
              onClick={() => void deleteRule.mutateAsync(rule.id)}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>,
        ],
        id: rule.id,
      })}
      rightPanel={
        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Rule tester</p>
              <h2>{rules.length} rules</h2>
            </div>
            <StatusBadge tone="good">api-backed</StatusBadge>
          </div>
          <label htmlFor="rule-test-status">
            Subscription status
            <input id="rule-test-status" value={testStatus} onChange={(event) => setTestStatus(event.target.value)} />
          </label>
          <div className="inline-actions">
            <button type="button" className="button button--secondary" onClick={() => void testRule.mutateAsync({ subscription_status: testStatus })}>
              Test rule
            </button>
            <button type="button" className="button button--secondary" onClick={() => void reorderRules.mutateAsync(rules.map((rule) => rule.id).reverse())}>
              Reverse order
            </button>
          </div>
          {testRule.data ? (
            <div className="resource-list">
              <div className="resource-list__item">
                <span>Matched rule: {testRule.data.matched ? testRule.data.rule?.name : 'No match'}</span>
                <small>Response status: {testRule.data.status_code}</small>
              </div>
              <div className="resource-list__item">
                <span>{testRule.data.body || 'Empty body'}</span>
                <small>{formatRecord(testRule.data.headers)}</small>
              </div>
            </div>
          ) : null}
          {selectedRule ? (
            <form className="screen-form" onSubmit={saveSelectedRule}>
              <div>
                <p className="eyebrow">Rule editor</p>
                <h2>{selectedRule.name}</h2>
              </div>
              <RuleFields
                body={editor.body}
                headers={editor.headers}
                name={editor.name}
                prefix="edit"
                statusCode={editor.statusCode}
                triggerStatus={editor.triggerStatus}
                onBodyChange={(value) => setEditor((current) => ({ ...current, body: value }))}
                onHeadersChange={(value) => setEditor((current) => ({ ...current, headers: value }))}
                onNameChange={(value) => setEditor((current) => ({ ...current, name: value }))}
                onStatusCodeChange={(value) => setEditor((current) => ({ ...current, statusCode: value }))}
                onTriggerStatusChange={(value) => setEditor((current) => ({ ...current, triggerStatus: value }))}
              />
              <label className="checkbox-row" htmlFor="edit-rule-enabled">
                <input
                  id="edit-rule-enabled"
                  type="checkbox"
                  checked={editor.enabled}
                  onChange={(event) => setEditor((current) => ({ ...current, enabled: event.target.checked }))}
                />
                Enabled
              </label>
              <FormError message={editorError} />
              <SubmitButton pending={updateRule.isPending}>Save selected rule</SubmitButton>
            </form>
          ) : null}
        </article>
      }
      spec={rulesSpec}
      tableEyebrow="Subscription policy"
      tableTitle="Response rule registry"
    />
  )
}

function RuleFields({
  body,
  headers,
  name,
  onBodyChange,
  onHeadersChange,
  onNameChange,
  onStatusCodeChange,
  onTriggerStatusChange,
  prefix,
  statusCode,
  triggerStatus,
}: {
  body: string
  headers: string
  name: string
  onBodyChange: (value: string) => void
  onHeadersChange: (value: string) => void
  onNameChange: (value: string) => void
  onStatusCodeChange: (value: string) => void
  onTriggerStatusChange: (value: string) => void
  prefix: string
  statusCode: string
  triggerStatus: string
}) {
  return (
    <>
      <label htmlFor={`${prefix}-rule-name`}>
        Name
        <input id={`${prefix}-rule-name`} required value={name} onChange={(event) => onNameChange(event.target.value)} />
      </label>
      <label htmlFor={`${prefix}-rule-trigger`}>
        Trigger status
        <input id={`${prefix}-rule-trigger`} required value={triggerStatus} onChange={(event) => onTriggerStatusChange(event.target.value)} />
      </label>
      <label htmlFor={`${prefix}-rule-status-code`}>
        HTTP status
        <input id={`${prefix}-rule-status-code`} inputMode="numeric" value={statusCode} onChange={(event) => onStatusCodeChange(event.target.value)} />
      </label>
      <label htmlFor={`${prefix}-rule-body`}>
        Body
        <textarea id={`${prefix}-rule-body`} rows={4} value={body} onChange={(event) => onBodyChange(event.target.value)} />
      </label>
      <label htmlFor={`${prefix}-rule-headers`}>
        Headers JSON
        <textarea id={`${prefix}-rule-headers`} rows={4} value={headers} onChange={(event) => onHeadersChange(event.target.value)} />
      </label>
    </>
  )
}

function editorToRequest(editor: RuleEditorState): ResponseRuleUpdateRequest {
  return {
    body: editor.body,
    enabled: editor.enabled,
    headers: parseHeaders(editor.headers),
    name: editor.name.trim(),
    status_code: Number(editor.statusCode),
    trigger_status: editor.triggerStatus.trim(),
  }
}

function parseHeaders(value: string): Record<string, string> {
  const parsed: unknown = JSON.parse(value || '{}')
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Headers JSON must be an object.')
  }
  return Object.fromEntries(Object.entries(parsed).map(([key, item]) => [key, String(item)]))
}

function ruleToEditor(rule: ResponseRuleRecord): RuleEditorState {
  return {
    body: rule.body,
    enabled: rule.enabled,
    headers: JSON.stringify(rule.headers, null, 2),
    name: rule.name,
    statusCode: String(rule.status_code),
    triggerStatus: rule.trigger_status,
  }
}
