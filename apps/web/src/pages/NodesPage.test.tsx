import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createDevelopmentLumenApiClient } from '../shared/api/developmentClient'
import { developmentSession } from '../shared/data/developmentFixtures'
import { renderWithRouter } from '../test/renderWithRouter'

describe('NodesPage operator guidance', () => {
  it('shows provisioning status, install token flow, heartbeat, and agent healthcheck guidance', async () => {
    renderWithRouter('/nodes', {
      apiClient: createDevelopmentLumenApiClient(),
      initialSession: developmentSession,
    })

    expect(await screen.findByRole('heading', { name: /^Nodes$/ })).toBeInTheDocument()
    expect(await screen.findByText(/install token status will appear after a job is queued/i)).toBeInTheDocument()
    expect(screen.getByText(/heartbeat state appears after the agent exchanges/i)).toBeInTheDocument()
    expect(screen.getByText(/lumen-node-agent healthcheck passes/i)).toBeInTheDocument()
  })
})
