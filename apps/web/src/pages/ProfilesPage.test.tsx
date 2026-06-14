import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthSessionProvider } from '../features/auth/AuthSessionProvider'
import { ApiClientProvider } from '../shared/api/ApiClientProvider'
import { createDevelopmentLumenApiClient } from '../shared/api/developmentClient'
import type { LumenApiClient } from '../shared/api/types'
import { developmentSession } from '../shared/data/developmentFixtures'
import { I18nProvider } from '../shared/i18n/I18nProvider'
import { ProfilesPage } from './ProfilesPage'

describe('ProfilesPage production interactions', () => {
  it('saves profile config and metadata JSON through the real profile update contract', async () => {
    const developmentClient = createDevelopmentLumenApiClient()
    const checkPortConflicts = vi.fn(async () => ({ allowed: true, conflicts: [] }))
    const updateProfile = vi.fn(developmentClient.updateProfile)
    const apiClient: LumenApiClient = {
      ...developmentClient,
      checkPortConflicts,
      updateProfile,
    }

    renderProfilesPage(apiClient)

    await waitFor(() =>
      expect(document.querySelector<HTMLButtonElement>('button[aria-label="Edit StealConfig"]')).not.toBeNull(),
    )
    fireEvent.click(document.querySelector<HTMLButtonElement>('button[aria-label="Edit StealConfig"]') as HTMLButtonElement)

    const saveButton = await screen.findByRole('button', { name: /save profile/i })
    const form = saveButton.closest('form')
    expect(form).not.toBeNull()

    fireEvent.change(screen.getByLabelText(/profile config json/i), { target: { value: '{' } })
    fireEvent.submit(form as HTMLFormElement)
    expect(await screen.findByText(/profile config json must be valid json/i)).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/profile config json/i), {
      target: { value: JSON.stringify({ security: 'reality', transport: 'tcp' }, null, 2) },
    })
    fireEvent.change(screen.getByLabelText(/profile metadata json/i), { target: { value: '[]' } })
    fireEvent.submit(form as HTMLFormElement)
    expect(await screen.findByText(/profile metadata json must be an object/i)).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/profile metadata json/i), { target: { value: '{}' } })
    fireEvent.change(screen.getByLabelText(/profile config json/i), {
      target: { value: JSON.stringify({ security: { privateKey: 'must-not-inline' } }, null, 2) },
    })
    fireEvent.submit(form as HTMLFormElement)
    expect(await screen.findByText(/inline secret-like fields/i)).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/profile config json/i), {
      target: {
        value: JSON.stringify(
          {
            routing: { domainStrategy: 'AsIs' },
            security: 'reality',
            transport: 'tcp',
          },
          null,
          2,
        ),
      },
    })
    fireEvent.change(screen.getByLabelText(/server name/i), {
      target: { value: 'front.example.test' },
    })
    fireEvent.change(screen.getByLabelText(/profile metadata json/i), {
      target: {
        value: JSON.stringify({ order: 7, owner: 'ops' }, null, 2),
      },
    })
    fireEvent.submit(form as HTMLFormElement)

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile.mock.calls[0][1].config_json).toMatchObject({
      routing: { domainStrategy: 'AsIs' },
      security: {
        serverName: 'front.example.test',
        type: 'reality',
      },
    })
    expect(updateProfile.mock.calls[0][1].metadata_json).toMatchObject({
      order: 7,
      owner: 'ops',
    })
  }, 15_000)

  it('wires manual reorder controls to the real reorder API contract', async () => {
    const developmentClient = createDevelopmentLumenApiClient()
    const reorderProfiles = vi.fn(developmentClient.reorderProfiles)
    const apiClient: LumenApiClient = {
      ...developmentClient,
      reorderProfiles,
    }

    renderProfilesPage(apiClient)

    expect(await screen.findByText(/^Profiles$/)).toBeInTheDocument()
    await waitFor(() =>
      expect(document.querySelector<HTMLButtonElement>('button[aria-label="Move StealConfig down"]')).not.toBeNull(),
    )
    const moveDown = document.querySelector<HTMLButtonElement>('button[aria-label="Move StealConfig down"]')
    expect(moveDown?.disabled).toBe(false)

    fireEvent.click(moveDown as HTMLButtonElement)

    await waitFor(() => expect(reorderProfiles).toHaveBeenCalled())
    expect(reorderProfiles.mock.calls[0][0]).toEqual(['profile_trojan_xhttp', 'profile_stealconfig'])
  })

  it('keeps live adapters selectable and confirms deletes inline before the API call', async () => {
    const developmentClient = createDevelopmentLumenApiClient()
    const deleteProfile = vi.fn(developmentClient.deleteProfile)
    const apiClient: LumenApiClient = {
      ...developmentClient,
      deleteProfile,
      listProtocolAdapters: async () => ({
        items: [
          {
            capabilities: ['xray', 'vless', 'reality', 'tcp', 'subscription'],
            display_name: 'VLESS Reality TCP',
            protocol: 'vless-reality',
            required_credential_refs: ['client_uuid', 'reality_private_key'],
            status: 'experimental',
          },
          {
            capabilities: ['xray', 'vless', 'tls', 'websocket', 'subscription'],
            display_name: 'VLESS WebSocket TLS',
            protocol: 'vless-ws-tls',
            required_credential_refs: ['client_uuid', 'tls_certificate'],
            status: 'catalog',
          },
          {
            capabilities: ['trojan', 'subscription'],
            display_name: 'Trojan Legacy',
            protocol: 'trojan',
            required_credential_refs: ['password'],
            status: 'legacy',
          },
        ],
      }),
    }

    renderProfilesPage(apiClient)

    expect(await screen.findByText(/^Profiles$/)).toBeInTheDocument()
    const createButton = document.querySelector<HTMLButtonElement>('button[aria-label="Refresh profiles"]')
      ?.parentElement?.querySelector<HTMLButtonElement>('button.button--primary')
    expect(createButton).not.toBeNull()
    fireEvent.click(createButton as HTMLButtonElement)

    const adapterSelect = screen.getByLabelText(/^adapter$/i) as HTMLSelectElement
    const optionsByValue = new Map(Array.from(adapterSelect.options).map((option) => [option.value, option]))
    expect(optionsByValue.get('vless-reality')?.disabled).toBe(false)
    expect(optionsByValue.get('vless-ws-tls')?.disabled).toBe(false)
    expect(optionsByValue.get('trojan')?.disabled).toBe(true)

    const deleteButton = document.querySelector<HTMLButtonElement>('button[aria-label="Delete StealConfig"]')
    expect(deleteButton).not.toBeNull()
    fireEvent.click(deleteButton as HTMLButtonElement)
    expect(deleteProfile).not.toHaveBeenCalled()

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(/production api/i)
    const confirmButton = dialog.querySelector<HTMLButtonElement>('.button--danger')
    expect(confirmButton).not.toBeNull()
    fireEvent.click(confirmButton as HTMLButtonElement)

    await waitFor(() => expect(deleteProfile).toHaveBeenCalledWith('profile_stealconfig'))
  })

  it('shows actionable runtime apply command state and supports retry', async () => {
    const developmentClient = createDevelopmentLumenApiClient()
    const applyProfileToNode = vi.fn(developmentClient.applyProfileToNode)
    const apiClient: LumenApiClient = {
      ...developmentClient,
      applyProfileToNode,
      listProfileRuntimeReadiness: async () => {
        const response = await developmentClient.listProfileRuntimeReadiness()
        return {
          items: response.items.map((item) =>
            item.profile_id === 'profile_stealconfig'
              ? { ...item, apply_ready: true, blockers: [], runtime_clients: 1 }
              : item,
          ),
        }
      },
    }

    renderProfilesPage(apiClient)

    await waitFor(() =>
      expect(document.querySelector<HTMLButtonElement>('button[aria-label="Apply StealConfig to node"]')).not.toBeNull(),
    )
    fireEvent.click(document.querySelector<HTMLButtonElement>('button[aria-label="Apply StealConfig to node"]') as HTMLButtonElement)

    await waitFor(() => expect(applyProfileToNode).toHaveBeenCalledWith('profile_stealconfig'))
    expect(await screen.findByText(/profile apply command queued/i)).toBeInTheDocument()
    expect(await screen.findByText(/^Runtime apply result$/i)).toBeInTheDocument()
    expect(await screen.findAllByText(/cmd_1/i)).not.toHaveLength(0)
    expect(await screen.findAllByText(/apply queued/i)).not.toHaveLength(0)

    const retryButton = await screen.findByRole('button', { name: /retry apply/i })
    fireEvent.click(retryButton)

    await waitFor(() => expect(applyProfileToNode).toHaveBeenCalledTimes(2))
  })

  it('issues a real subscription from a profile with explicit render targets', async () => {
    const developmentClient = createDevelopmentLumenApiClient()
    const issueSubscriptionFromProfile = vi.fn(developmentClient.issueSubscriptionFromProfile)
    const apiClient: LumenApiClient = {
      ...developmentClient,
      issueSubscriptionFromProfile,
    }

    renderProfilesPage(apiClient)

    const issueButton = await screen.findByRole('button', { name: /issue subscription/i })
    fireEvent.click(issueButton)

    await waitFor(() => expect(issueSubscriptionFromProfile).toHaveBeenCalled())
    expect(issueSubscriptionFromProfile.mock.calls[0][0]).toMatchObject({
      host_id: expect.any(String),
      profile_id: expect.any(String),
      render_targets: expect.arrayContaining(['happ', 'sing-box', 'mihomo']),
      user_id: expect.any(String),
    })
    expect(await screen.findByText(/subscription issued from profile/i)).toBeInTheDocument()
    expect(await screen.findByText(/^Issued$/i)).toBeInTheDocument()
  })
})

function renderProfilesPage(apiClient: LumenApiClient) {
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
            <MemoryRouter initialEntries={['/profiles']}>
              <ProfilesPage />
            </MemoryRouter>
          </I18nProvider>
        </ApiClientProvider>
      </AuthSessionProvider>
    </QueryClientProvider>,
  )
}
