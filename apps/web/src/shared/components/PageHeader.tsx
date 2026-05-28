import type { ReactNode } from 'react'
import { useI18n } from '../i18n/I18nProvider'

type PageHeaderProps = {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}

export function PageHeader({ actions, description, eyebrow, title }: PageHeaderProps) {
  const { t } = useI18n()

  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{t(eyebrow)}</p>
        <h1>{t(title)}</h1>
        <p className="page-header__description">{t(description)}</p>
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  )
}
