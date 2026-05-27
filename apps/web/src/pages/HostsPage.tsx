import { useState, type FormEvent } from 'react'
import { useCreateHost, useHostsPageData, useNodesPageData, useProfilesPageData, useSquadsPageData } from '../shared/api/resourceHooks'
import {
  FormError,
  ResourceScreen,
  ScreenForm,
  SubmitButton,
} from '../shared/components/ResourceScreen'
import { StatusBadge } from '../shared/components/StatusBadge'
import { placeholderSpecs } from '../shared/data/lumenData'
import { toneForStatus } from '../shared/utils/resourceFormat'

export function HostsPage() {
  const query = useHostsPageData()
  const nodesQuery = useNodesPageData()
  const profilesQuery = useProfilesPageData()
  const squadsQuery = useSquadsPageData()
  const createHost = useCreateHost()
  const hosts = query.data?.items ?? []
  const nodes = nodesQuery.data?.items ?? []
  const profiles = profilesQuery.data?.items ?? []
  const squads = squadsQuery.data?.items ?? []
  const [name, setName] = useState('')
  const [hostname, setHostname] = useState('')
  const [nodeId, setNodeId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [squadId, setSquadId] = useState('')
  const [tags, setTags] = useState('auto-wifi')
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    try {
      await createHost.mutateAsync({
        hostname: hostname.trim(),
        name: name.trim(),
        node_id: nodeId || nodes[0]?.id || '',
        protocol_profile_id: profileId || null,
        squad_id: squadId || null,
        status: 'active',
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      })
      setName('')
      setHostname('')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Host could not be created.')
    }
  }

  return (
    <ResourceScreen
      caption="Host inventory"
      columns={['Name', 'Hostname', 'Node', 'Profile', 'Squad', 'Tags', 'Status']}
      createForm={
        <ScreenForm onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">Add host</p>
            <h2>Ingress mapping</h2>
            <p>Bind a public hostname to node/profile/squad routing metadata.</p>
          </div>
          <label htmlFor="host-name">
            Name
            <input id="host-name" required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label htmlFor="host-hostname">
            Hostname
            <input id="host-hostname" required value={hostname} onChange={(event) => setHostname(event.target.value)} />
          </label>
          <label htmlFor="host-node">
            Node
            <select id="host-node" required value={nodeId} onChange={(event) => setNodeId(event.target.value)}>
              <option value="">Select node</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="host-profile">
            Profile
            <select id="host-profile" value={profileId} onChange={(event) => setProfileId(event.target.value)}>
              <option value="">None</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="host-squad">
            Squad
            <select id="host-squad" value={squadId} onChange={(event) => setSquadId(event.target.value)}>
              <option value="">None</option>
              {squads.map((squad) => (
                <option key={squad.id} value={squad.id}>
                  {squad.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="host-tags">
            Tags
            <input id="host-tags" value={tags} onChange={(event) => setTags(event.target.value)} />
          </label>
          <FormError message={formError} />
          <SubmitButton pending={createHost.isPending}>Add host</SubmitButton>
        </ScreenForm>
      }
      emptyDescription="Hosts appear here after domain mappings are created."
      emptyTitle="No hosts configured"
      error={query.error}
      errorTitle="Hosts unavailable"
      isError={query.isError}
      isLoading={query.isLoading}
      isSuccess={query.isSuccess}
      items={hosts}
      loadingLabel="Loading hosts..."
      onRefresh={() => void query.refetch()}
      renderRow={(host) => ({
        cells: [
          host.name,
          host.hostname,
          nodes.find((node) => node.id === host.node_id)?.name ?? host.node_id,
          profiles.find((profile) => profile.id === host.protocol_profile_id)?.name ?? 'None',
          squads.find((squad) => squad.id === host.squad_id)?.name ?? 'None',
          host.tags.join(', ') || 'None',
          <StatusBadge tone={toneForStatus(host.status)}>{host.status}</StatusBadge>,
        ],
        id: host.id,
      })}
      spec={placeholderSpecs.hosts}
      tableEyebrow="Ingress hosts"
      tableTitle="Host routing"
    />
  )
}
