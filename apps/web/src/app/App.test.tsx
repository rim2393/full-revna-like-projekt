import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithRouter } from '../test/renderWithRouter'

describe('Lumen admin routing scaffold', () => {
  it('renders the dashboard shell with primary navigation', async () => {
    renderWithRouter('/dashboard')

    expect(await screen.findByRole('heading', { name: /command dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /users/i })).toHaveAttribute('href', '/users')
  })

  it('renders the Lumen Guard MFA step', () => {
    renderWithRouter('/guard/mfa')

    expect(screen.getByRole('heading', { name: /verify mfa/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/one-time code/i)).toBeInTheDocument()
  })

  it('renders placeholder resource screens', () => {
    renderWithRouter('/api-keys')

    expect(screen.getByRole('heading', { level: 1, name: /api keys/i })).toBeInTheDocument()
    expect(screen.getByText(/scoped token management/i)).toBeInTheDocument()
  })
})
