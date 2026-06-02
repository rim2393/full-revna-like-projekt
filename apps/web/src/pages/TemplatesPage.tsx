import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Copy, Edit3, Trash2 } from 'lucide-react'
import {
  useCreateSubscriptionTemplate,
  useDeleteSubscriptionTemplate,
  useReorderSubscriptionTemplates,
  useSubscriptionTemplatesData,
  useUpdateSubscriptionTemplate,
} from '../shared/api/resourceHooks'
import type { SubscriptionTemplateFormat, SubscriptionTemplateRecord } from '../shared/api/types'
import {
  FormError,
  ResourceScreen,
  ScreenForm,
  SubmitButton,
} from '../shared/components/ResourceScreen'
import { StatusBadge } from '../shared/components/StatusBadge'
import { sectionSpecs } from '../shared/data/resourceMeta'
import { formatRecord, toneForStatus } from '../shared/utils/resourceFormat'

const formats: SubscriptionTemplateFormat[] = [
  'xray_json',
  'mihomo',
  'stash',
  'sing_box',
  'clash',
  'raw_uri',
]

const defaultContentByFormat: Record<SubscriptionTemplateFormat, string> = {
  clash: '{"prepend":"# Lumen Clash profile\\n","append":"","headers":{"X-Lumen-Template":"clash"},"filename":"lumen-clash.yaml"}',
  mihomo: '{"prepend":"# Lumen Mihomo profile\\n","append":"","headers":{"X-Lumen-Template":"mihomo"},"filename":"lumen-mihomo.yaml"}',
  raw_uri: '{"prepend":"# Lumen raw URI subscription\\n","append":"","headers":{"X-Lumen-Template":"raw-uri"},"filename":"lumen-subscription.txt"}',
  sing_box: '{"merge":{"experimental":{"cache_file":{"enabled":true}}},"headers":{"X-Lumen-Template":"sing-box"},"filename":"lumen-sing-box.json"}',
  stash: '{"prepend":"# Lumen Stash profile\\n","append":"","headers":{"X-Lumen-Template":"stash"},"filename":"lumen-stash.yaml"}',
  xray_json: '{"merge":{"routing":{"domainStrategy":"IPIfNonMatch"}},"headers":{"X-Lumen-Template":"xray-json"},"filename":"lumen-xray.json"}',
}

const templatesSpec = {
  ...sectionSpecs.subscription,
  description:
    'Manage real renderer templates that alter public subscription output for Xray JSON, Mihomo, Stash, sing-box, Clash and raw URI clients.',
  eyebrow: 'Subscription templates',
  primaryAction: 'New template',
  status: 'api-backed',
  title: 'Templates',
}

type EditorState = {
  content: string
  format: SubscriptionTemplateFormat
  name: string
  status: string
}

export function TemplatesPage() {
  const query = useSubscriptionTemplatesData()
  const createTemplate = useCreateSubscriptionTemplate()
  const updateTemplate = useUpdateSubscriptionTemplate()
  const deleteTemplate = useDeleteSubscriptionTemplate()
  const reorderTemplates = useReorderSubscriptionTemplates()
  const templates = query.data?.items ?? []
  const [name, setName] = useState('')
  const [format, setFormat] = useState<SubscriptionTemplateFormat>('mihomo')
  const [content, setContent] = useState(defaultContentByFormat.mihomo)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? templates[0],
    [selectedId, templates],
  )
  const [editor, setEditor] = useState<EditorState>({
    content: defaultContentByFormat.mihomo,
    format: 'mihomo',
    name: '',
    status: 'active',
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [editorError, setEditorError] = useState<string | null>(null)

  useEffect(() => {
    setContent(defaultContentByFormat[format])
  }, [format])

  useEffect(() => {
    if (!selectedTemplate) {
      return
    }
    setSelectedId(selectedTemplate.id)
    setEditor(templateToEditor(selectedTemplate))
  }, [selectedTemplate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    try {
      await createTemplate.mutateAsync({
        content_json: parseJson(content),
        format,
        name: name.trim(),
        status: 'active',
      })
      setName('')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Template could not be saved.')
    }
  }

  async function saveSelectedTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTemplate) {
      return
    }
    setEditorError(null)
    try {
      await updateTemplate.mutateAsync({
        id: selectedTemplate.id,
        request: {
          content_json: parseJson(editor.content),
          format: editor.format,
          name: editor.name.trim(),
          status: editor.status.trim(),
        },
      })
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Template could not be updated.')
    }
  }

  async function cloneTemplate(template: SubscriptionTemplateRecord) {
    await createTemplate.mutateAsync({
      content_json: template.content_json,
      format: template.format,
      name: `${template.name} copy`,
      status: template.status,
    })
  }

  async function moveTemplate(template: SubscriptionTemplateRecord, direction: -1 | 1) {
    const index = templates.findIndex((item) => item.id === template.id)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= templates.length) {
      return
    }
    const ids = templates.map((item) => item.id)
    const [id] = ids.splice(index, 1)
    ids.splice(targetIndex, 0, id)
    await reorderTemplates.mutateAsync(ids)
  }

  return (
    <ResourceScreen
      caption="Subscription templates"
      columns={['Name', 'Format', 'Content', 'Order', 'Status', 'Actions']}
      createForm={
        <ScreenForm onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">Create template</p>
            <h2>Renderer profile</h2>
            <p>
              Text formats use prepend/append. JSON formats use merge to patch the generated
              sing-box or Xray JSON without breaking parser compatibility.
            </p>
          </div>
          <label htmlFor="template-name">
            Name
            <input id="template-name" required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label htmlFor="template-format">
            Format
            <select id="template-format" value={format} onChange={(event) => setFormat(event.target.value as SubscriptionTemplateFormat)}>
              {formats.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label htmlFor="template-content">
            Content JSON
            <textarea id="template-content" rows={8} value={content} onChange={(event) => setContent(event.target.value)} />
          </label>
          <FormError message={formError} />
          <SubmitButton pending={createTemplate.isPending}>Create template</SubmitButton>
        </ScreenForm>
      }
      emptyDescription="Create templates for Happ, Mihomo, Sing-box, Clash, Stash, Xray JSON, or raw URI delivery."
      emptyTitle="No templates"
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
          template.name,
          template.format,
          formatRecord(template.content_json),
          String(template.order),
          <StatusBadge tone={toneForStatus(template.status)}>{template.status}</StatusBadge>,
          <div className="inline-actions">
            <button
              type="button"
              className="icon-button"
              aria-label={`Edit ${template.name}`}
              onClick={() => setSelectedId(template.id)}
            >
              <Edit3 size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Move ${template.name} up`}
              onClick={() => void moveTemplate(template, -1)}
            >
              <ArrowUp size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Move ${template.name} down`}
              onClick={() => void moveTemplate(template, 1)}
            >
              <ArrowDown size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Clone ${template.name}`}
              onClick={() => void cloneTemplate(template)}
            >
              <Copy size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() =>
                void updateTemplate.mutateAsync({
                  id: template.id,
                  request: { status: template.status === 'active' ? 'disabled' : 'active' },
                })
              }
            >
              Toggle
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Delete ${template.name}`}
              onClick={() => void deleteTemplate.mutateAsync(template.id)}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>,
        ],
        id: template.id,
      })}
      rightPanel={
        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Renderer order</p>
              <h2>{templates.length} templates</h2>
            </div>
            <StatusBadge tone="good">api-backed</StatusBadge>
          </div>
          <button type="button" className="button button--secondary" onClick={() => void reorderTemplates.mutateAsync(templates.map((item) => item.id).reverse())}>
            Reverse order
          </button>
          <div className="resource-list">
            {templates.map((template) => (
              <button
                type="button"
                key={template.id}
                className="resource-list__item resource-list__item--button"
                onClick={() => setSelectedId(template.id)}
              >
                <span>{template.name}</span>
                <small>{template.format}</small>
              </button>
            ))}
          </div>
          {selectedTemplate ? (
            <form className="screen-form" onSubmit={saveSelectedTemplate}>
              <div>
                <p className="eyebrow">Template editor</p>
                <h2>{selectedTemplate.name}</h2>
              </div>
              <label htmlFor="edit-template-name">
                Name
                <input id="edit-template-name" required value={editor.name} onChange={(event) => setEditor((value) => ({ ...value, name: event.target.value }))} />
              </label>
              <label htmlFor="edit-template-format">
                Format
                <select id="edit-template-format" value={editor.format} onChange={(event) => setEditor((value) => ({ ...value, format: event.target.value as SubscriptionTemplateFormat }))}>
                  {formats.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label htmlFor="edit-template-status">
                Status
                <select id="edit-template-status" value={editor.status} onChange={(event) => setEditor((value) => ({ ...value, status: event.target.value }))}>
                  <option value="active">active</option>
                  <option value="disabled">disabled</option>
                </select>
              </label>
              <label htmlFor="edit-template-content">
                Content JSON
                <textarea id="edit-template-content" rows={10} value={editor.content} onChange={(event) => setEditor((value) => ({ ...value, content: event.target.value }))} />
              </label>
              <FormError message={editorError} />
              <SubmitButton pending={updateTemplate.isPending}>Save selected template</SubmitButton>
            </form>
          ) : null}
        </article>
      }
      spec={templatesSpec}
      tableEyebrow="Renderer templates"
      tableTitle="Template registry"
    />
  )
}

function parseJson(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value || '{}')
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Content JSON must be an object.')
  }
  return parsed as Record<string, unknown>
}

function templateToEditor(template: SubscriptionTemplateRecord): EditorState {
  return {
    content: JSON.stringify(template.content_json, null, 2),
    format: template.format,
    name: template.name,
    status: template.status,
  }
}
