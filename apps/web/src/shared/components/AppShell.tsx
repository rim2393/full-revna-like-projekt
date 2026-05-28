import { Bell, CircleHelp, Languages, LogOut, Menu, Search, Settings, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthSession } from '../../features/auth/authSession'
import { useApiClient } from '../api/apiClientContext'
import { navigationGroups } from '../data/navigation'
import { BrandMark } from './BrandMark'

type AppLanguage = 'en' | 'ru'

const languageOptions: Array<{ label: string; value: AppLanguage }> = [
  { label: 'EN', value: 'en' },
  { label: 'RU', value: 'ru' },
]

const searchableRoutes = navigationGroups.flatMap((group) =>
  group.items.map((item) => ({
    keywords: `${group.label} ${item.label}`.toLowerCase(),
    label: item.label,
    to: item.to,
  })),
)

const readInitialLanguage = (): AppLanguage => {
  if (typeof window === 'undefined') {
    return 'en'
  }

  const storedLanguage = window.localStorage.getItem('lumen-ui-language')
  return storedLanguage === 'ru' ? 'ru' : 'en'
}

export function AppShell() {
  const apiClient = useApiClient()
  const navigate = useNavigate()
  const { clearSession } = useAuthSession()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [language, setLanguage] = useState<AppLanguage>(readInitialLanguage)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchStatus, setSearchStatus] = useState('')
  const closeSidebar = () => setIsSidebarOpen(false)
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return []
    }

    return searchableRoutes.filter((route) => route.keywords.includes(query)).slice(0, 5)
  }, [searchQuery])

  async function handleSignOut() {
    try {
      await apiClient.logout()
    } finally {
      clearSession()
      navigate('/guard/login', { replace: true })
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const firstResult = searchResults[0]
    if (!firstResult) {
      setSearchStatus('No matching section found.')
      return
    }

    setSearchStatus(`Opening ${firstResult.label}.`)
    setSearchQuery('')
    navigate(firstResult.to)
  }

  useEffect(() => {
    document.documentElement.lang = language
    window.localStorage.setItem('lumen-ui-language', language)
  }, [language])

  return (
    <div className="app-shell" data-density="compact">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className={`sidebar ${isSidebarOpen ? 'sidebar--open' : ''}`} aria-label="Primary navigation">
        <div className="sidebar__header">
          <Link to="/dashboard" className="sidebar__brand" aria-label="Lumen Guard dashboard">
            <BrandMark />
          </Link>
          <button
            type="button"
            className="icon-button sidebar__close"
            aria-label="Close navigation"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav className="sidebar__nav" aria-label="Primary">
          {navigationGroups.map((group) => (
            <section key={group.label} className="sidebar__group">
              <h2>{group.label}</h2>
              {group.items.map((item) => {
                const Icon = item.icon

                return (
                  <NavLink key={item.to} to={item.to} className="sidebar__link" onClick={closeSidebar}>
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </section>
          ))}
        </nav>
        <div className="sidebar__footer">
          <span>Instance</span>
          <strong>lumen-prod-01</strong>
        </div>
      </aside>

      {isSidebarOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="shell-main">
        <header className="topbar">
          <button
            type="button"
            className="icon-button topbar__menu"
            aria-label="Open navigation"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <form className="topbar__search" onSubmit={handleSearchSubmit}>
            <Search size={18} aria-hidden="true" />
            <label className="sr-only" htmlFor="topbar-search">
              Search control plane
            </label>
            <input
              id="topbar-search"
              type="search"
              placeholder="Search users, nodes, hosts"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {searchQuery ? (
              <div className="topbar__search-results" role="listbox" aria-label="Search results">
                {searchResults.length > 0 ? (
                  searchResults.map((result) => (
                    <button
                      key={result.to}
                      type="button"
                      role="option"
                      onClick={() => {
                        setSearchQuery('')
                        setSearchStatus(`Opening ${result.label}.`)
                        navigate(result.to)
                      }}
                    >
                      {result.label}
                    </button>
                  ))
                ) : (
                  <span>No matches</span>
                )}
              </div>
            ) : null}
            <span className="sr-only" aria-live="polite">
              {searchStatus}
            </span>
          </form>
          <nav className="topbar__actions" aria-label="Admin actions">
            <label className="language-switcher">
              <Languages size={18} aria-hidden="true" />
              <span className="sr-only">Interface language</span>
              <select
                aria-label="Interface language"
                value={language}
                onChange={(event) => setLanguage(event.target.value as AppLanguage)}
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="icon-button"
              aria-expanded={isNotificationsOpen}
              aria-label="Notifications"
              onClick={() => setIsNotificationsOpen((current) => !current)}
            >
              <Bell size={18} />
            </button>
            {isNotificationsOpen ? (
              <div className="notification-popover" role="status">
                <strong>No active notifications</strong>
                <span>Node heartbeat, license, and API health alerts are clear.</span>
              </div>
            ) : null}
            <Link to="/settings" className="icon-button" aria-label="Settings">
              <Settings size={18} />
            </Link>
            <Link to="/tools" className="icon-button" aria-label="Help">
              <CircleHelp size={18} />
            </Link>
            <button type="button" className="icon-button" aria-label="Sign out" onClick={handleSignOut}>
              <LogOut size={18} />
            </button>
          </nav>
        </header>
        <main id="main-content" className="content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
