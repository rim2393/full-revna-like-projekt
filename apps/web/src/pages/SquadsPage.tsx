import { useState, type FormEvent } from 'react'
import { useCreateSquad, useSquadsPageData } from '../shared/api/resourceHooks'
import {
  FormError,
  ResourceScreen,
  ScreenForm,
  SubmitButton,
} from '../shared/components/ResourceScreen'
import { StatusBadge } from '../shared/components/StatusBadge'
import { placeholderSpecs } from '../shared/data/lumenData'
import { formatRecord, parseKeyValueInput, toneForStatus } from '../shared/utils/resourceFormat'

export function SquadsPage() {
  const query = useSquadsPageData()
  const createSquad = useCreateSquad()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'internal' | 'external'>('internal')
  const [metadata, setMetadata] = useState('channel=stable, hwid_limit=5')
  const [formError, setFormError] = useState<string | null>(null)
  const squads = query.data?.items ?? []

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    try {
      await createSquad.mutateAsync({
        kind,
        metadata_json: parseKeyValueInput(metadata),
        name: name.trim(),
        status: 'active',
      })
      setName('')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Squad could not be created.')
    }
  }

  return (
    <ResourceScreen
      caption="Squad inventory"
      columns={['Name', 'Kind', 'Metadata', 'Status']}
      createForm={
        <ScreenForm onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">Create squad</p>
            <h2>Access lane</h2>
            <p>Group users, profiles, and hosts without storing inline credentials.</p>
          </div>
          <label htmlFor="squad-name">
            Name
            <input
              id="squad-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label htmlFor="squad-kind">
            Kind
            <select
              id="squad-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as 'internal' | 'external')}
            >
              <option value="internal">internal</option>
              <option value="external">external</option>
            </select>
          </label>
          <label htmlFor="squad-metadata">
            Metadata
            <textarea
              id="squad-metadata"
              value={metadata}
              onChange={(event) => setMetadata(event.target.value)}
            />
          </label>
          <FormError message={formError} />
          <SubmitButton pending={createSquad.isPending}>Create squad</SubmitButton>
        </ScreenForm>
      }
      emptyDescription="Create internal or external access lanes before assigning profiles and hosts."
      emptyTitle="No squads created"
      error={query.error}
      errorTitle="Squads unavailable"
      isError={query.isError}
      isLoading={query.isLoading}
      isSuccess={query.isSuccess}
      items={squads}
      loadingLabel="Loading squads..."
      onRefresh={() => void query.refetch()}
      renderRow={(squad) => ({
        cells: [
          squad.name,
          squad.kind,
          formatRecord(squad.metadata_json),
          <StatusBadge tone={toneForStatus(squad.status)}>{squad.status}</StatusBadge>,
        ],
        id: squad.id,
      })}
      spec={placeholderSpecs.squads}
      tableEyebrow="Access groups"
      tableTitle="Squad registry"
    />
  )
}
