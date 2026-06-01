import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Ban, CalendarClock, RefreshCw, RotateCcw, Save, Search, Tags, Trash2, UserPlus, UserMinus } from 'lucide-react'
import {
  useBulkUsers,
  useCreateUser,
  useDeleteUser,
  useDisableUser,
  useEnableUser,
  useLookupUsers,
  useResetUserTraffic,
  useRevokeUser,
  useSquadsPageData,
  useUpdateUser,
  useUsersPageData,
} from '../shared/api/resourceHooks'
import type { UserRecord } from '../shared/api/types'
import { DataTable } from '../shared/components/DataTable'
import { EmptyState, ErrorState, LoadingState } from '../shared/components/DataState'
import {
  FormError,
  ScreenForm,
  SubmitButton,
} from '../shared/components/ResourceScreen'
import { PageHeader } from '../shared/components/PageHeader'
import { StatusBadge } from '../shared/components/StatusBadge'
import { sectionSpecs } from '../shared/data/resourceMeta'
import { useI18n } from '../shared/i18n/I18nProvider'
import { toneForStatus } from '../shared/utils/resourceFormat'

function formatUserName(user: UserRecord): string {
  return user.display_name || user.username || user.email
}

function formatLimit(user: UserRecord, t: (value: string) => string): string {
  const used = `${user.traffic_used_gb.toFixed(2)} GB`
  if (user.traffic_limit_gb === null) {
    return `${used} / ${t('unlimited')}`
  }
  return `${used} / ${user.traffic_limit_gb.toFixed(0)} GB`
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function UsersPage() {
  const { t } = useI18n()
  const spec = sectionSpecs.users
  const query = useUsersPageData()
  const squadsQuery = useSquadsPageData()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const enableUser = useEnableUser()
  const disableUser = useDisableUser()
  const revokeUser = useRevokeUser()
  const resetUserTraffic = useResetUserTraffic()
  const bulkUsers = useBulkUsers()
  const lookupUsers = useLookupUsers()
  const users = query.data?.items ?? []
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lookupQuery, setLookupQuery] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [trafficLimit, setTrafficLimit] = useState('300')
  const [deviceLimit, setDeviceLimit] = useState('5')
  const [bulkTags, setBulkTags] = useState('')
  const [bulkExpiresAt, setBulkExpiresAt] = useState('')
  const [bulkTrafficDelta, setBulkTrafficDelta] = useState('')
  const [bulkSquadId, setBulkSquadId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const parsedTrafficLimit = trafficLimit.trim() ? Number(trafficLimit) : null
    const parsedDeviceLimit = deviceLimit.trim() ? Number(deviceLimit) : null
    if (
      (parsedTrafficLimit !== null && !Number.isFinite(parsedTrafficLimit)) ||
      (parsedDeviceLimit !== null && !Number.isInteger(parsedDeviceLimit))
    ) {
      setFormError(t('Traffic and device limits must be valid numbers.'))
      return
    }
    try {
      await createUser.mutateAsync({
        device_limit: parsedDeviceLimit,
        display_name: displayName.trim() || null,
        email: email.trim(),
        role: 'user',
        status: 'active',
        traffic_limit_gb: parsedTrafficLimit,
        username: username.trim() || null,
      })
      setEmail('')
      setUsername('')
      setDisplayName('')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('User could not be created.'))
    }
  }

  async function runBulk(action: string, status?: string) {
    await runBulkWithRequest(action, { status })
  }

  async function runBulkWithRequest(
    action: string,
    request: {
      expires_at?: string | null
      squad_id?: string | null
      status?: string | null
      tags?: string[] | null
      traffic_delta_gb?: number | null
    } = {},
  ) {
    if (selectedIds.size === 0) {
      setFormError(t('Select at least one user first.'))
      return
    }
    setFormError(null)
    await bulkUsers.mutateAsync({
      action,
      request: { ...request, user_ids: Array.from(selectedIds) },
    })
    if (action === 'delete') {
      setSelectedIds(new Set())
    }
  }

  async function runBulkTags() {
    const tags = bulkTags.split(',').map((tag) => tag.trim()).filter(Boolean)
    if (tags.length === 0) {
      setFormError(t('Enter at least one tag.'))
      return
    }
    await runBulkWithRequest('tag', { tags })
  }

  async function runBulkExtend() {
    if (!bulkExpiresAt) {
      setFormError(t('Set an expiration date first.'))
      return
    }
    await runBulkWithRequest('extend', { expires_at: new Date(bulkExpiresAt).toISOString() })
  }

  async function runBulkTrafficDelta() {
    const value = Number(bulkTrafficDelta)
    if (!Number.isFinite(value)) {
      setFormError(t('Traffic delta must be a valid number.'))
      return
    }
    await runBulkWithRequest('traffic', { traffic_delta_gb: value })
  }

  async function runBulkSquad(action: 'squad-add' | 'squad-remove') {
    if (!bulkSquadId) {
      setFormError(t('Select a squad first.'))
      return
    }
    await runBulkWithRequest(action, { squad_id: bulkSquadId })
  }

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const queryText = lookupQuery.trim()
    if (!queryText) {
      setFormError(t('Enter a user lookup query.'))
      return
    }
    setFormError(null)
    await lookupUsers.mutateAsync(queryText)
  }

  return (
    <section className="page">
      <PageHeader
        eyebrow={spec.eyebrow}
        title={spec.title}
        description={t('Real VPN customer accounts with traffic, device limits, expiry, status and bulk controls.')}
        actions={
          <button
            type="button"
            className="button button--secondary"
            aria-label={t('Refresh users')}
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw size={18} aria-hidden="true" />
            {t('Refresh')}
          </button>
        }
      />

      {query.isLoading ? <LoadingState label={t('Loading users...')} /> : null}
      {query.isError ? <ErrorState title={t('Users unavailable')} error={query.error} /> : null}
      {query.isSuccess && users.length === 0 ? (
        <EmptyState
          title={t('No users found')}
          description={t('Create the first VPN customer account to issue subscriptions and assign squads.')}
        />
      ) : null}

      <section className="resource-grid">
        <article className="panel panel--wide">
          <div className="panel__header">
            <div>
              <p className="eyebrow">{t('Identity registry')}</p>
              <h2>{t('User directory')}</h2>
            </div>
            <StatusBadge>{t('users.count', { count: users.length })}</StatusBadge>
          </div>
          <div className="inline-actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void runBulk('status', 'active')}
            >
              <Save size={16} aria-hidden="true" />
              {t('Enable selected')}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void runBulk('status', 'disabled')}
            >
              <Ban size={16} aria-hidden="true" />
              {t('Disable selected')}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void runBulk('reset-traffic')}
            >
              <RotateCcw size={16} aria-hidden="true" />
              {t('Reset traffic')}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void runBulkWithRequest('revoke')}
            >
              <Ban size={16} aria-hidden="true" />
              {t('Revoke selected')}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void runBulkWithRequest('delete')}
            >
              <Trash2 size={16} aria-hidden="true" />
              {t('Delete selected')}
            </button>
          </div>
          <div className="resource-list">
            <div className="resource-list__item">
              <span>{t('Selected users')}</span>
              <small>{selectedIds.size}</small>
            </div>
            <label htmlFor="bulk-user-tags">
              {t('Tags')}
              <input
                id="bulk-user-tags"
                value={bulkTags}
                onChange={(event) => setBulkTags(event.target.value)}
                placeholder="vip, trial"
              />
            </label>
            <button type="button" className="button button--secondary" onClick={() => void runBulkTags()}>
              <Tags size={16} aria-hidden="true" />
              {t('Apply tags')}
            </button>
            <label htmlFor="bulk-user-expires-at">
              {t('Expiration')}
              <input
                id="bulk-user-expires-at"
                type="datetime-local"
                value={bulkExpiresAt}
                onChange={(event) => setBulkExpiresAt(event.target.value)}
              />
            </label>
            <button type="button" className="button button--secondary" onClick={() => void runBulkExtend()}>
              <CalendarClock size={16} aria-hidden="true" />
              {t('Extend selected')}
            </button>
            <label htmlFor="bulk-user-traffic-delta">
              {t('Traffic delta GB')}
              <input
                id="bulk-user-traffic-delta"
                inputMode="decimal"
                value={bulkTrafficDelta}
                onChange={(event) => setBulkTrafficDelta(event.target.value)}
                placeholder="10 or -5"
              />
            </label>
            <button type="button" className="button button--secondary" onClick={() => void runBulkTrafficDelta()}>
              <RotateCcw size={16} aria-hidden="true" />
              {t('Apply traffic delta')}
            </button>
            <label htmlFor="bulk-user-squad">
              {t('Squad')}
              <select
                id="bulk-user-squad"
                value={bulkSquadId}
                onChange={(event) => setBulkSquadId(event.target.value)}
              >
                <option value="">{t('Select squad')}</option>
                {(squadsQuery.data?.items ?? []).map((squad) => (
                  <option key={squad.id} value={squad.id}>
                    {squad.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="inline-actions">
              <button type="button" className="button button--secondary" onClick={() => void runBulkSquad('squad-add')}>
                <UserPlus size={16} aria-hidden="true" />
                {t('Add to squad')}
              </button>
              <button type="button" className="button button--secondary" onClick={() => void runBulkSquad('squad-remove')}>
                <UserMinus size={16} aria-hidden="true" />
                {t('Remove from squad')}
              </button>
            </div>
          </div>
          <DataTable
            caption={t('User directory')}
            columns={['Select', 'User', 'Role', 'Devices', 'Traffic', 'Tags', 'Status', 'Actions']}
            rows={users.map((user) => ({
              cells: [
                <input
                  aria-label={t('Select {name}', { name: formatUserName(user) })}
                  checked={selectedIds.has(user.id)}
                  type="checkbox"
                  onChange={() => toggleSelected(user.id)}
                />,
                <div>
                  <Link className="text-link" to={`/users/${user.id}`}>
                    {formatUserName(user)}
                  </Link>
                  <p className="table-subtext">{user.email}</p>
                </div>,
                user.role,
                user.device_limit === null ? t('unlimited') : user.device_limit,
                formatLimit(user, t),
                user.tags.length > 0 ? user.tags.join(', ') : t('none'),
                <StatusBadge tone={toneForStatus(user.status)}>{user.status}</StatusBadge>,
                <div className="inline-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t('Toggle status {name}', { name: formatUserName(user) })}
                    disabled={enableUser.isPending || disableUser.isPending}
                    onClick={() =>
                      void (user.status === 'active'
                        ? disableUser.mutateAsync(user.id)
                        : enableUser.mutateAsync(user.id))
                    }
                  >
                    <Ban size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t('Reset traffic {name}', { name: formatUserName(user) })}
                    disabled={resetUserTraffic.isPending}
                    onClick={() => void resetUserTraffic.mutateAsync(user.id)}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t('Revoke {name}', { name: formatUserName(user) })}
                    disabled={revokeUser.isPending}
                    onClick={() => void revokeUser.mutateAsync(user.id)}
                  >
                    <Ban size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t('Delete {name}', { name: formatUserName(user) })}
                    disabled={deleteUser.isPending}
                    onClick={() => void deleteUser.mutateAsync(user.id)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>,
              ],
              id: user.id,
            }))}
          />
        </article>
        <ScreenForm onSubmit={handleLookup}>
          <div>
            <p className="eyebrow">{t('Lookup')}</p>
            <h2>{t('Find user')}</h2>
            <p>{t('Lookup by UUID, short UUID, username, email, numeric ID, Telegram ID, or tag.')}</p>
          </div>
          <label htmlFor="user-lookup-query">
            {t('Lookup query')}
            <input
              id="user-lookup-query"
              value={lookupQuery}
              onChange={(event) => setLookupQuery(event.target.value)}
              placeholder="email@example.com, tag:trial, 12345"
            />
          </label>
          <SubmitButton pending={lookupUsers.isPending}>
            <Search size={16} aria-hidden="true" />
            {t('Find user')}
          </SubmitButton>
          <FormError
            message={
              lookupUsers.isError
                ? getErrorMessage(lookupUsers.error, t('User lookup failed.'))
                : null
            }
          />
          {lookupUsers.data ? (
            <div className="resource-list">
              <div className="resource-list__item">
                <span>{t('Lookup strategy')}</span>
                <small>{lookupUsers.data.strategy}</small>
              </div>
              {lookupUsers.data.items.length === 0 ? (
                <div className="resource-list__item">
                  <span>{t('No users found')}</span>
                  <small>{lookupUsers.data.query}</small>
                </div>
              ) : (
                lookupUsers.data.items.map((user) => (
                  <div className="resource-list__item" key={user.id}>
                    <span>
                      <Link className="text-link" to={`/users/${user.id}`}>
                        {formatUserName(user)}
                      </Link>
                    </span>
                    <small>{user.email}</small>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </ScreenForm>
        <ScreenForm onSubmit={handleCreate}>
          <div>
            <p className="eyebrow">{t('Create user')}</p>
            <h2>{t('VPN account')}</h2>
            <p>{t('Limits are stored in the backend and used by subscription delivery.')}</p>
          </div>
          <label htmlFor="user-email">
            {t('Email')}
            <input
              id="user-email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label htmlFor="user-username">
            {t('Username')}
            <input
              id="user-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label htmlFor="user-display-name">
            {t('Display name')}
            <input
              id="user-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <label htmlFor="user-traffic-limit">
            {t('Traffic limit GB')}
            <input
              id="user-traffic-limit"
              inputMode="decimal"
              value={trafficLimit}
              onChange={(event) => setTrafficLimit(event.target.value)}
            />
          </label>
          <label htmlFor="user-device-limit">
            {t('Device limit')}
            <input
              id="user-device-limit"
              inputMode="numeric"
              value={deviceLimit}
              onChange={(event) => setDeviceLimit(event.target.value)}
            />
          </label>
          <FormError message={formError} />
          <FormError
            message={
              createUser.isError
                ? getErrorMessage(createUser.error, t('User could not be created.'))
                : null
            }
          />
          <FormError
            message={
              updateUser.isError
                ? getErrorMessage(updateUser.error, t('User could not be updated.'))
                : null
            }
          />
          <FormError
            message={
              enableUser.isError
                ? getErrorMessage(enableUser.error, t('User could not be updated.'))
                : null
            }
          />
          <FormError
            message={
              disableUser.isError
                ? getErrorMessage(disableUser.error, t('User could not be updated.'))
                : null
            }
          />
          <FormError
            message={
              revokeUser.isError
                ? getErrorMessage(revokeUser.error, t('User could not be updated.'))
                : null
            }
          />
          <FormError
            message={
              resetUserTraffic.isError
                ? getErrorMessage(resetUserTraffic.error, t('User could not be updated.'))
                : null
            }
          />
          <FormError
            message={
              deleteUser.isError
                ? getErrorMessage(deleteUser.error, t('User could not be deleted.'))
                : null
            }
          />
          <FormError
            message={
              bulkUsers.isError
                ? getErrorMessage(bulkUsers.error, t('Bulk user action failed.'))
                : null
            }
          />
          <SubmitButton pending={createUser.isPending}>{t('Create user')}</SubmitButton>
        </ScreenForm>
      </section>
    </section>
  )
}
