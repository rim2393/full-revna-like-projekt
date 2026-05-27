import { ArrowRight, ShieldCheck } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export function MfaPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('Challenge accepted. Portal session can begin.')
    navigate('/guard/portal')
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <div className="auth-card__icon" aria-hidden="true">
        <ShieldCheck size={24} />
      </div>
      <div>
        <p className="eyebrow">Step 2 of 2</p>
        <h2>Verify MFA</h2>
        <p>Confirm the one-time code from an authenticator or hardware token.</p>
      </div>
      <label>
        One-time code
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          placeholder="000000"
          required
        />
      </label>
      <button type="submit" className="button button--primary">
        Open portal
        <ArrowRight size={18} aria-hidden="true" />
      </button>
      <p className="auth-card__note" aria-live="polite">
        {status || 'MFA is mandatory for privileged Lumen admin routes.'}
      </p>
      <Link to="/guard/login" className="text-link">
        Back to sign in
      </Link>
    </form>
  )
}
