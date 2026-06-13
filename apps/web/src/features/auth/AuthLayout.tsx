import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { usePanelIdentityData } from '../../shared/api/resourceHooks'
import { BrandMark } from '../../shared/components/BrandMark'
import { StatusBadge } from '../../shared/components/StatusBadge'
import { I18nProvider, useI18n, type AppLanguage } from '../../shared/i18n/I18nProvider'

const readInitialLanguage = (): AppLanguage => {
  if (typeof window === 'undefined') {
    return 'en'
  }

  const storedLanguage = window.localStorage.getItem('lumen-ui-language')
  return storedLanguage === 'ru' || storedLanguage === 'en' ? storedLanguage : 'en'
}

export function AuthLayout() {
  const [language, setLanguage] = useState<AppLanguage>(readInitialLanguage)

  useEffect(() => {
    document.documentElement.lang = language
    window.localStorage.setItem('lumen-ui-language', language)
  }, [language])

  return (
    <I18nProvider language={language} setLanguage={setLanguage}>
      <AuthLayoutContent />
    </I18nProvider>
  )
}

function AuthLayoutContent() {
  const identity = usePanelIdentityData()
  const { t } = useI18n()
  const productName = identity.data?.product_name ?? 'Lumen Guard'

  return (
    <main className="auth-shell">
      <section className="auth-intro" aria-label={t('{product} overview', { product: productName })}>
        <BrandMark productName={productName} />
        <div>
          <p className="eyebrow">{t('Zero-trust admin entry')}</p>
          <h1>{productName}</h1>
          <p>{t('Auth intro copy')}</p>
        </div>
        <div className="auth-intro__status">
          <StatusBadge tone="good">{t('MFA when configured')}</StatusBadge>
          <StatusBadge>{t('Session isolated')}</StatusBadge>
        </div>
      </section>
      <section className="auth-panel" aria-label={t('Authentication form')}>
        <Outlet />
      </section>
    </main>
  )
}
