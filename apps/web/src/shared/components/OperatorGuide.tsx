import { Link } from 'react-router-dom'
import { StatusBadge } from './StatusBadge'
import { useI18n } from '../i18n/I18nProvider'

type OperatorGuideStep = {
  detail: string
  label: string
  to?: string
}

type OperatorGuideProps = {
  eyebrow?: string
  status?: string
  steps: OperatorGuideStep[]
  title: string
}

export function OperatorGuide({
  eyebrow = 'Operator path',
  status = 'live',
  steps,
  title,
}: OperatorGuideProps) {
  const { t } = useI18n()

  return (
    <article className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">{t(eyebrow)}</p>
          <h2>{t(title)}</h2>
        </div>
        <StatusBadge>{status}</StatusBadge>
      </div>
      <ol className="workflow-list">
        {steps.map((step, index) => (
          <li key={`${step.label}-${index}`}>
            <span className="workflow-list__index">{index + 1}</span>
            <div>
              <strong>{t(step.label)}</strong>
              <small>{t(step.detail)}</small>
            </div>
            {step.to ? (
              <Link className="text-link" to={step.to}>
                {t('Open')}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </article>
  )
}
