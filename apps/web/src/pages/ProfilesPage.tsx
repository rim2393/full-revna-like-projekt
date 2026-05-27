import { useState, type FormEvent } from 'react'
import { useCreateProfile, useNodesPageData, useProfilesPageData, useProtocolAdaptersData, useSquadsPageData } from '../shared/api/resourceHooks'
import {
  FormError,
  ResourceScreen,
  ScreenForm,
  SubmitButton,
} from '../shared/components/ResourceScreen'
import { StatusBadge } from '../shared/components/StatusBadge'
import { placeholderSpecs } from '../shared/data/lumenData'
import { formatRecord, parseKeyValueInput, toneForStatus } from '../shared/utils/resourceFormat'

export function ProfilesPage() {
  const query = useProfilesPageData()
  const adaptersQuery = useProtocolAdaptersData()
  const nodesQuery = useNodesPageData()
  const squadsQuery = useSquadsPageData()
  const createProfile = useCreateProfile()
  const profiles = query.data?.items ?? []
  const nodes = nodesQuery.data?.items ?? []
  const squads = squadsQuery.data?.items ?? []
  const adapters = adaptersQuery.data?.items ?? []
  const [name, setName] = useState('')
  const [adapter, setAdapter] = useState('vless')
  const [nodeId, setNodeId] = useState('')
  const [squadId, setSquadId] = useState('')
  const [port, setPort] = useState('443')
  const [credentialsRef, setCredentialsRef] = useState('vault://lumen/profiles/new-profile')
  const [config, setConfig] = useState('transport=tcp, security=reality')
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const parsedPort = Number(port)
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      setFormError('Port must be an integer between 1 and 65535.')
      return
    }
    try {
      await createProfile.mutateAsync({
        adapter,
        config_json: parseKeyValueInput(config),
        credentials_ref: credentialsRef.trim() || null,
        name: name.trim(),
        node_id: nodeId || nodes[0]?.id || '',
        port_reservations: [{ address: '0.0.0.0', exclusive: true, port: parsedPort, protocol: 'tcp' }],
        squad_id: squadId || null,
        status: 'active',
      })
      setName('')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Profile could not be created.')
    }
  }

  const selectedAdapter = adapters.find((item) => item.protocol === adapter)

  return (
    <ResourceScreen
      caption="Protocol profile inventory"
      columns={['Name', 'Adapter', 'Node', 'Squad', 'Ports', 'Config', 'Status']}
      createForm={
        <ScreenForm onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">Create profile</p>
            <h2>Xray config wrapper</h2>
            <p>Reserve ports and reference credentials by vault path only.</p>
          </div>
          <label htmlFor="profile-name">
            Name
            <input id="profile-name" required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label htmlFor="profile-adapter">
            Adapter
            <select id="profile-adapter" value={adapter} onChange={(event) => setAdapter(event.target.value)}>
              {adapters.map((item) => (
                <option key={item.protocol} value={item.protocol}>
                  {item.display_name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="profile-node">
            Node
            <select id="profile-node" required value={nodeId} onChange={(event) => setNodeId(event.target.value)}>
              <option value="">Select node</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="profile-squad">
            Squad
            <select id="profile-squad" value={squadId} onChange={(event) => setSquadId(event.target.value)}>
              <option value="">None</option>
              {squads.map((squad) => (
                <option key={squad.id} value={squad.id}>
                  {squad.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="profile-port">
            Port
            <input id="profile-port" inputMode="numeric" required value={port} onChange={(event) => setPort(event.target.value)} />
          </label>
          <label htmlFor="profile-credentials-ref">
            credentials_ref
            <input id="profile-credentials-ref" value={credentialsRef} onChange={(event) => setCredentialsRef(event.target.value)} />
          </label>
          <label htmlFor="profile-config">
            Config
            <textarea id="profile-config" value={config} onChange={(event) => setConfig(event.target.value)} />
          </label>
          <FormError message={formError} />
          <SubmitButton pending={createProfile.isPending}>Create profile</SubmitButton>
        </ScreenForm>
      }
      emptyDescription="Create protocol profiles after registering at least one node."
      emptyTitle="No profiles created"
      error={query.error}
      errorTitle="Profiles unavailable"
      isError={query.isError}
      isLoading={query.isLoading}
      isSuccess={query.isSuccess}
      items={profiles}
      loadingLabel="Loading profiles..."
      onRefresh={() => void query.refetch()}
      renderRow={(profile) => ({
        cells: [
          profile.name,
          profile.adapter,
          nodes.find((node) => node.id === profile.node_id)?.name ?? profile.node_id,
          squads.find((squad) => squad.id === profile.squad_id)?.name ?? 'None',
          profile.port_reservations.map((reservation) => `${String(reservation.port)}/${String(reservation.protocol ?? 'tcp')}`).join(', ') || 'None',
          formatRecord(profile.config_json),
          <StatusBadge tone={toneForStatus(profile.status)}>{profile.status}</StatusBadge>,
        ],
        id: profile.id,
      })}
      rightPanel={
        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Adapter catalog</p>
              <h2>{selectedAdapter?.display_name ?? 'Protocol adapters'}</h2>
            </div>
            <StatusBadge>{`${adapters.length} adapters`}</StatusBadge>
          </div>
          <ul className="feature-list">
            {(selectedAdapter ? [selectedAdapter] : adapters).map((item) => (
              <li key={item.protocol}>
                <span>{item.protocol}</span>
                <span>{item.capabilities.join(', ')}</span>
              </li>
            ))}
          </ul>
        </article>
      }
      spec={placeholderSpecs.profiles}
      tableEyebrow="Client delivery"
      tableTitle="Profile builder"
    />
  )
}
