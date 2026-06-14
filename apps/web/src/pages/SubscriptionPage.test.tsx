import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createDevelopmentLumenApiClient } from '../shared/api/developmentClient'
import type { LumenApiClient } from '../shared/api/types'
import { developmentSession } from '../shared/data/developmentFixtures'
import { renderWithRouter } from '../test/renderWithRouter'

describe('SubscriptionPage renderability', () => {
  it('shows renderable targets, raw/deep-link guidance, and device binding state', async () => {
    const developmentClient = createDevelopmentLumenApiClient()
    const listSubscriptionDevices = vi.fn(developmentClient.listSubscriptionDevices)
    const apiClient: LumenApiClient = {
      ...developmentClient,
      listSubscriptionDevices,
    }

    renderWithRouter('/subscription', {
      apiClient,
      initialSession: developmentSession,
    })

    expect(await screen.findByRole('heading', { name: /^Subscription$/ })).toBeInTheDocument()
    expect(await screen.findByText(/raw client links use the public subscription renderer/i)).toBeInTheDocument()
    expect(screen.getByText(/device\/hwid binding is visible/i)).toBeInTheDocument()
    expect(screen.getAllByText(/^Happ$/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^Hiddify$/i).length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole('button', { name: /devices/i })[0])

    await waitFor(() => expect(listSubscriptionDevices).toHaveBeenCalledWith('sub_default'))
    expect(await screen.findByText(/Connection keys/i)).toBeInTheDocument()
  })
})
