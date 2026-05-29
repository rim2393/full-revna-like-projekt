import type { MetricTone } from '../data/resourceMeta'
import { useI18n } from '../i18n/I18nProvider'

type StatusBadgeProps = {
  children: string
  tone?: MetricTone
}

export function StatusBadge({ children, tone = 'neutral' }: StatusBadgeProps) {
  const { t } = useI18n()

  return <span className={`status-badge status-badge--${tone}`}>{t(children)}</span>
}
