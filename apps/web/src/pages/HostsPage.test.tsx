import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthSessionProvider } from '../features/auth/AuthSessionProvider'
import { ApiClientProvider } from '../shared/api/ApiClientProvider'
import { createDevelopmentLumenApiClient } from '../shared/api/developmentClient'
import type { LumenApiClient } from '../shared/api/types'
import { developmentSession } from '../shared/data/developmentFixtures'
import { I18nProvider } from '../shared/i18n/I18nProvider'
import { HostsPage } from './HostsPage'

describe('HostsPage production interactions', () => {
  it('saves host routing and advanced JSON through the real host update contract', async () => {
    const developmentClient = createDevelopmentLumenApiClient()
    const updateHost = vi.fn(developmentClient.updateHost)
    const apiClient: LumenApiClient = {
      ...developmentClient,
      updateHost,
    }

    renderHostsPage(apiClient)

    await waitFor(() =>
      expect(document.querySelector<HTMLButtonElement>('button[aria-label="Edit Germany WiFi"]')).not.toBeNull(),
    )
    fireEvent.click(document.querySelector<HTMLButtonElement>('button[aria-label="Edit Germany WiFi"]') as HTMLButtonElement)

    fireEvent.change(document.querySelector<HTMLInputElement>('#editor-host-inbound') as HTMLInputElement, {
      target: { value: 'REALITY_EDGE' },
    })
    fireEvent.change(document.querySelector<HTMLInputElement>('#editor-host-port') as HTMLInputElement, {
      target: { value: '9443' },
    })
    fireEvent.click(screen.getByText(/^Advanced JSON$/i))
    fireEvent.change(screen.getByLabelText(/^metadata_json$/i), { target: { value: '[]' } })

    const saveButton = screen.getByRole('button', { name: /save host/i })
    fireEvent.submit(saveButton.closest('form') as HTMLFormElement)
    expect(await screen.findByText(/metadata_json must be a JSON object/i)).toBeInTheDocument()
    expect(updateHost).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/^metadata_json$/i), {
      target: { value: JSON.stringify({ owner: 'ops', route: 'prod' }, null, 2) },
    })
    fireEvent.change(screen.getByLabelText(/^mux_json$/i), {
      target: { value: JSON.stringify({ enabled: false }, null, 2) },
    })
    fireEvent.submit(saveButton.closest('form') as HTMLFormElement)

    await waitFor(() => expect(updateHost).toHaveBeenCalled())
    expect(updateHost.mock.calls[0][0]).toBe('host_germany_wifi')
    expect(updateHost.mock.calls[0][1]).toMatchObject({
      inbound_tag: 'REALITY_EDGE',
      metadata_json: { owner: 'ops', route: 'prod' },
      mux_json: { enabled: false },
      port: 9443,
    })
  })

  it('requires inline confirmation before deleting a single real host', async () => {
    const developmentClient = createDevelopmentLumenApiClient()
    const deleteHost = vi.fn(developmentClient.deleteHost)
    const apiClient: LumenApiClient = {
      ...developmentClient,
      deleteHost,
    }

    renderHostsPage(apiClient)

    await waitFor(() =>
      expect(document.querySelector<HTMLButtonElement>('button[aria-label="Delete Auto WiFi"]')).not.toBeNull(),
    )
    fireEvent.click(document.querySelector<HTMLButtonElement>('button[aria-label="Delete Auto WiFi"]') as HTMLButtonElement)
    expect(deleteHost).not.toHaveBeenCalled()

    const dialog = await screen.findByRole('alertdialog', { name: /delete host auto wifi/i })
    expect(dialog).toHaveTextContent(/production api/i)
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(deleteHost).toHaveBeenCalledWith('host_auto_wifi'))
  })

  it('requires inline confirmation before bulk deleting selected hosts', async () => {
    const developmentClient = createDevelopmentLumenApiClient()
    const bulkHosts = vi.fn(developmentClient.bulkHosts)
    const apiClient: LumenApiClient = {
      ...developmentClient,
      bulkHosts,
    }

    renderHostsPage(apiClient)

    fireEvent.click(await screen.findByLabelText('Select Auto WiFi'))
    fireEvent.click(screen.getByLabelText('Select Germany WiFi'))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(bulkHosts).not.toHaveBeenCalled()

    const dialog = await screen.findByRole('alertdialog', { name: /delete selected hosts/i })
    expect(dialog).toHaveTextContent(/2 real hosts/i)
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(bulkHosts).toHaveBeenCalledWith('delete', {
      ids: ['host_auto_wifi', 'host_germany_wifi'],
    }))
  })
})

function renderHostsPage(apiClient: LumenApiClient) {
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
            <MemoryRouter initialEntries={['/hosts']}>
              <HostsPage />
            </MemoryRouter>
          </I18nProvider>
        </ApiClientProvider>
      </AuthSessionProvider>
    </QueryClientProvider>,
  )
}
