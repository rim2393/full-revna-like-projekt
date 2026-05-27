import { ArrowRight, LockKeyhole } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export function LoginPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('Credentials accepted. MFA challenge prepared.')
    navigate('/guard/mfa')
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <div className="auth-card__icon" aria-hidden="true">
        <LockKeyhole size={24} />
      </div>
      <div>
        <p className="eyebrow">Lumen Guard</p>
        <h2>Sign in</h2>
        <p>Use an operator account. This scaffold does not store credentials.</p>
      </div>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" placeholder="admin@lumen.local" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <button type="submit" className="button button--primary">
        Continue
        <ArrowRight size={18} aria-hidden="true" />
      </button>
      <p className="auth-card__note" aria-live="polite">
        {status || 'Demo flow: submit to continue to MFA.'}
      </p>
      <Link to="/guard/portal" className="text-link">
        View guarded portal preview
      </Link>
    </form>
  )
}
