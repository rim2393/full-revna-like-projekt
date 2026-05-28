import { useI18n } from '../i18n/I18nProvider'

type LoadingStateProps = {
  label: string
}

type EmptyStateProps = {
  description: string
  title: string
}

type ErrorStateProps = {
  error: unknown
  title: string
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'The request could not be completed. Try again after the API is reachable.'
}

export function LoadingState({ label }: LoadingStateProps) {
  const { t } = useI18n()

  return (
    <p className="loading-state" aria-live="polite">
      {t(label)}
    </p>
  )
}

export function EmptyState({ description, title }: EmptyStateProps) {
  const { t } = useI18n()

  return (
    <article className="state-card">
      <h2>{t(title)}</h2>
      <p>{t(description)}</p>
    </article>
  )
}

export function ErrorState({ error, title }: ErrorStateProps) {
  const { t } = useI18n()

  return (
    <article className="state-card state-card--error" role="alert">
      <h2>{t(title)}</h2>
      <p>{t(getErrorMessage(error))}</p>
    </article>
  )
}
