import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { appRoutes } from '../app/routes'

export function renderWithRouter(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  const router = createMemoryRouter(appRoutes, { initialEntries: [initialPath] })

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient()

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}
