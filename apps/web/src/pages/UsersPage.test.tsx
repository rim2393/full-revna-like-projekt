import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AuthSessionProvider } from '../features/auth/AuthSessionProvider'
import { ApiClientProvider } from '../shared/api/ApiClientProvider'
import { createDevelopmentLumenApiClient } from '../shared/api/developmentClient'
import type { LumenApiClient } from '../shared/api/types'
import { developmentSession } from '../shared/data/developmentFixtures'
import { I18nProvider } from '../shared/i18n/I18nProvider'
import { UsersPage } from './UsersPage'

describe('UsersPage production interactions', () => {
  it('requires inline confirmation before bulk destructive user actions call the API', async () => {
    const developmentClient = createDevelopmentLumenApiClient()
    const bulkUsers = vi.fn(developmentClient.bulkUsers)
    const apiClient: LumenApiClient = {
      ...developmentClient,
      bulkUsers,
    }

    renderUsersPage(apiClient)

    fireEvent.click(await screen.findByLabelText('Select Mira Volkova'))
    const bulkPanel = screen.getByLabelText('Bulk user actions')
    fireEvent.click(within(bulkPanel).getByRole('button', { name: /^Delete$/i }))
    expect(bulkUsers).not.toHaveBeenCalled()

    let dialog = await screen.findByRole('alertdialog', { name: /delete selected users/i })
    expect(dialog).toHaveTextContent(/production api/i)
    fireEvent.click(within(dialog).getByRole('button', { name: /^Cancel$/i }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    fireEvent.click(within(bulkPanel).getByRole('button', { name: /^Revoke$/i }))
    dialog = await screen.findByRole('alertdialog', { name: /revoke selected users/i })
    fireEvent.click(within(dialog).getByRole('button', { name: /^Revoke$/i }))
    await waitFor(() => expect(bulkUsers).toHaveBeenCalledWith('revoke', {
      user_ids: ['usr_mira'],
    }))
  })

  it('requires inline confirmation before focused user delete/reset calls the API', async () => {
    const developmentClient = createDevelopmentLumenApiClient()
    const deleteUser = vi.fn(developmentClient.deleteUser)
    const resetUserTraffic = vi.fn(developmentClient.resetUserTraffic)
    const apiClient: LumenApiClient = {
      ...developmentClient,
      deleteUser,
      resetUserTraffic,
    }

    renderUsersPage(apiClient)

    expect(await screen.findByText(/^Selected user$/i)).toBeInTheDocument()
    const focusedCard = screen.getByText(/^Selected user$/i).closest('article')
    expect(focusedCard).not.toBeNull()

    fireEvent.click(within(focusedCard as HTMLElement).getByRole('button', { name: /^Reset traffic$/i }))
    let dialog = await screen.findByRole('alertdialog', { name: /reset traffic for mira volkova/i })
    expect(resetUserTraffic).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: /^Reset traffic$/i }))
    await waitFor(() => expect(resetUserTraffic).toHaveBeenCalledWith('usr_mira'))

    fireEvent.click(within(focusedCard as HTMLElement).getByRole('button', { name: /^Delete$/i }))
    dialog = await screen.findByRole('alertdialog', { name: /delete user mira volkova/i })
    expect(deleteUser).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: /^Delete$/i }))
    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith('usr_mira'))
  })

  it('opens the real user detail route from a row click without stealing checkbox selection', async () => {
    const developmentClient = createDevelopmentLumenApiClient()

    renderUsersPage(developmentClient)

    const location = await screen.findByTestId('route-location')
    expect(location).toHaveTextContent('/users')

    fireEvent.click(await screen.findByLabelText('Select Mira Volkova'))
    expect(location).toHaveTextContent('/users')

    fireEvent.click(screen.getByRole('button', { name: 'Open Mira Volkova' }))
    expect(location).toHaveTextContent('/users/usr_mira')
  })
})

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="route-location">{location.pathname}</output>
}

function renderUsersPage(apiClient: LumenApiClient) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider initialSession={developmentSession}>
        <ApiClientProvider client={apiClient}>
          <I18nProvider language="en" setLanguage={() => undefined}>
            <MemoryRouter initialEntries={['/users']}>
              <LocationProbe />
              <UsersPage />
            </MemoryRouter>
          </I18nProvider>
        </ApiClientProvider>
      </AuthSessionProvider>
    </QueryClientProvider>,
  )
}
