import { Link, useParams } from 'react-router-dom'
import type React from 'react'
import { Ban, CheckCircle2, ExternalLink, RotateCcw, ShieldX } from 'lucide-react'
import { useBulkUsers, useUpdateUser, useUserDetailData } from '../shared/api/resourceHooks'
import type { SubscriptionRecord, UserRecord } from '../shared/api/types'
import { DataTable } from '../shared/components/DataTable'
import { EmptyState, ErrorState, LoadingState } from '../shared/components/DataState'
import { PageHeader } from '../shared/components/PageHeader'
import { StatusBadge } from '../shared/components/StatusBadge'
import { useI18n } from '../shared/i18n/I18nProvider'
import { formatDateTime, formatRecord, toneForStatus } from '../shared/utils/resourceFormat'

function displayName(user: UserRecord): string {
  return user.display_name || user.username || user.email
}

function trafficLabel(user: UserRecord, t: (value: string) => string): string {
  const used = `${user.traffic_used_gb.toFixed(2)} GB`
  return user.traffic_limit_gb === null ? `${used} / ${t('unlimited')}` : `${used} / ${user.traffic_limit_gb.toFixed(0)} GB`
}

export function UserDetailPage() {
  const { t } = useI18n()
  const { userId } = useParams()
  const query = useUserDetailData(userId)
  const updateUser = useUpdateUser()
  const bulkUsers = useBulkUsers()
  const detail = query.data
  const user = detail?.user

  async function setStatus(status: string) {
    if (!user) {
      return
    }
    await updateUser.mutateAsync({ id: user.id, request: { status } })
    await query.refetch()
  }

  async function resetTraffic() {
    if (!user) {
      return
    }
    await bulkUsers.mutateAsync({
      action: 'reset-traffic',
      request: { user_ids: [user.id] },
    })
    await query.refetch()
  }

  if (query.isLoading) {
    return <LoadingState label={t('Loading user detail...')} />
  }

  if (query.isError) {
    return <ErrorState title={t('User detail unavailable')} error={query.error} />
  }

  if (!user || !detail) {
    return (
      <EmptyState
        title={t('User not found')}
        description={t('The API did not return this user.')}
      />
    )
  }

  return (
    <section className="page">
      <PageHeader
        eyebrow={t('User detail')}
        title={displayName(user)}
        description={`${user.email} · ${t('Real API user record with subscriptions, devices, access and history.')}`}
        actions={
          <div className="action-cluster">
            <button type="button" className="button button--secondary" onClick={() => void setStatus('active')}>
              <CheckCircle2 size={18} aria-hidden="true" />
              {t('Enable')}
            </button>
            <button type="button" className="button button--secondary" onClick={() => void setStatus('disabled')}>
              <Ban size={18} aria-hidden="true" />
              {t('Disable')}
            </button>
            <button type="button" className="button button--secondary" onClick={() => void resetTraffic()}>
              <RotateCcw size={18} aria-hidden="true" />
              {t('Reset traffic')}
            </button>
            <button type="button" className="button button--secondary" onClick={() => void setStatus('revoked')}>
              <ShieldX size={18} aria-hidden="true" />
              {t('Revoke')}
            </button>
          </div>
        }
      />

      <section className="metrics-grid">
        <UserFact label={t('Status')} value={user.status} detail={<StatusBadge tone={toneForStatus(user.status)}>{user.status}</StatusBadge>} />
        <UserFact label={t('Traffic')} value={trafficLabel(user, t)} detail={t('recorded by API')} />
        <UserFact label={t('Devices')} value={user.device_limit === null ? t('unlimited') : String(user.device_limit)} detail={t('configured limit')} />
        <UserFact label={t('Expires')} value={user.expires_at ? formatDateTime(user.expires_at) : t('Not set')} detail={t('subscription policy')} />
      </section>

      <section className="resource-grid">
        <article className="panel panel--wide">
          <div className="panel__header">
            <div>
              <p className="eyebrow">{t('Subscription access')}</p>
              <h2>{t('Issued subscriptions')}</h2>
            </div>
            <StatusBadge>{t('items.count', { count: detail.subscriptions.length })}</StatusBadge>
          </div>
          {detail.subscriptions.length === 0 ? (
            <p className="empty-inline">{t('No subscriptions are issued for this user yet.')}</p>
          ) : (
            <DataTable
              caption={t('Issued subscriptions')}
              columns={['Public ID', 'Node', 'Delivery profile', 'Expires', 'Status', 'Actions']}
              rows={detail.subscriptions.map((subscription) => ({
                id: subscription.id,
                cells: [
                  subscription.public_id,
                  subscription.node_id ?? t('All nodes'),
                  formatRecord(subscription.delivery_profile),
                  subscription.expires_at ? formatDateTime(subscription.expires_at) : t('Not set'),
                  <StatusBadge tone={toneForStatus(subscription.status)}>{subscription.status}</StatusBadge>,
                  <SubscriptionLinks subscription={subscription} />,
                ],
              }))}
            />
          )}
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">{t('Access')}</p>
              <h2>{t('Accessible nodes')}</h2>
            </div>
            <StatusBadge>{String(detail.accessible_nodes.length)}</StatusBadge>
          </div>
          <ul className="feature-list">
            {detail.accessible_nodes.map((node) => (
              <li key={node.id}>
                <span aria-hidden="true">-</span>
                <div>
                  <strong>{node.name}</strong>
                  <small>{node.public_address} / {node.region}</small>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">{t('HWID')}</p>
              <h2>{t('Registered devices')}</h2>
            </div>
            <StatusBadge>{String(detail.devices.length)}</StatusBadge>
          </div>
          {detail.devices.length === 0 ? (
            <p className="empty-inline">{t('No devices are registered for this user yet.')}</p>
          ) : (
            <ul className="feature-list">
              {detail.devices.map((device) => (
                <li key={device.id}>
                  <span aria-hidden="true">-</span>
                  <div>
                    <strong>{device.label ?? device.hwid ?? device.id}</strong>
                    <small>{device.platform ?? t('unknown platform')} / {device.status}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel panel--wide">
          <div className="panel__header">
            <div>
              <p className="eyebrow">{t('History')}</p>
              <h2>{t('Subscription request history')}</h2>
            </div>
            <StatusBadge>{String(detail.request_history.length)}</StatusBadge>
          </div>
          {detail.request_history.length === 0 ? (
            <p className="empty-inline">{t('No request history is recorded for this user yet.')}</p>
          ) : (
            <DataTable
              caption={t('Subscription request history')}
              columns={['Action', 'Actor', 'Created at', 'Metadata']}
              rows={detail.request_history.map((event) => ({
                id: event.id,
                cells: [
                  event.action,
                  event.actor_email ?? event.actor_subject,
                  formatDateTime(event.created_at),
                  formatRecord(event.metadata_json),
                ],
              }))}
            />
          )}
        </article>
      </section>
    </section>
  )
}

function UserFact({
  detail,
  label,
  value,
}: {
  detail: React.ReactNode
  label: string
  value: string
}) {
  return (
    <article className="metric-card">
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
      {typeof detail === 'string' ? <StatusBadge>{detail}</StatusBadge> : detail}
    </article>
  )
}

function SubscriptionLinks({ subscription }: { subscription: SubscriptionRecord }) {
  const { t } = useI18n()
  const baseUrl = buildSubscriptionUrl(subscription.public_id)
  return (
    <div className="inline-actions">
      <a className="text-link" href={baseUrl} target="_blank" rel="noreferrer">
        {t('Page')} <ExternalLink size={14} aria-hidden="true" />
      </a>
      <a className="text-link" href={`${baseUrl}/happ`} target="_blank" rel="noreferrer">
        Happ
      </a>
      <Link className="text-link" to="/subscription">
        {t('Manage')}
      </Link>
    </div>
  )
}

function buildSubscriptionUrl(publicId: string) {
  if (typeof window === 'undefined') {
    return `/sub/${publicId}`
  }
  const host = window.location.host.replace(/^panel\./, 'sub.')
  return `${window.location.protocol}//${host}/sub/${publicId}`
}
