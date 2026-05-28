import { ArrowRight, Fingerprint, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useApiClient } from '../../shared/api/apiClientContext'
import { StatusBadge } from '../../shared/components/StatusBadge'
import { useAuthSession } from './authSession'

export function GuardPortalPage() {
  const apiClient = useApiClient()
  const navigate = useNavigate()
  const { clearSession } = useAuthSession()

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
        <p className="eyebrow">Guard portal</p>
        <h2>Session ready</h2>
        <p>
          The portal is the handoff between authentication and the admin control plane. Continue
          only after the current operator session has passed the required policy checks.
        </p>
      </div>
      <div className="portal-checks" aria-label="Portal readiness">
        <span>
          <ShieldCheck size={18} aria-hidden="true" />
          MFA verified
        </span>
        <StatusBadge tone="good">Policy baseline loaded</StatusBadge>
      </div>
      <Link to="/dashboard" className="button button--primary">
        Enter dashboard
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
      <button type="button" className="text-link text-link--button" onClick={handleStartOver}>
        Start over
      </button>
    </article>
  )
}
