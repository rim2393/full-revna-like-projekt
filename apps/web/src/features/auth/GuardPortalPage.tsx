import { ArrowRight, Fingerprint, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useApiClient } from '../../shared/api/apiClientContext'
import { StatusBadge } from '../../shared/components/StatusBadge'
import { useI18n } from '../../shared/i18n/I18nProvider'
import { useAuthSession } from './authSession'

export function GuardPortalPage() {
  const apiClient = useApiClient()
  const navigate = useNavigate()
  const { clearSession } = useAuthSession()
  const { t } = useI18n()

  async function handleStartOver() {
    try {
      await apiClient.logout()
    } finally {
      clearSession()
      navigate('/guard/login', { replace: true })
    }
  }

  return (
    <article className="auth-card auth-card--portal">
      <div className="auth-card__icon" aria-hidden="true">
        <Fingerprint size={24} />
      </div>
      <div>
        <p className="eyebrow">{t('Guard portal')}</p>
        <h2>{t('Session ready')}</h2>
        <p>{t('Guard portal handoff copy')}</p>
      </div>
      <div className="portal-checks" aria-label={t('Portal readiness')}>
        <span>
          <ShieldCheck size={18} aria-hidden="true" />
          {t('MFA verified')}
        </span>
        <StatusBadge tone="good">{t('Policy baseline loaded')}</StatusBadge>
      </div>
      <Link to="/dashboard" className="button button--primary">
        {t('Enter dashboard')}
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
      <button type="button" className="text-link text-link--button" onClick={handleStartOver}>
        {t('Start over')}
      </button>
    </article>
  )
}
