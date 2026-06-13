import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './providers/AppProviders'
import { appRouter } from './routes'

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={appRouter} />
    </AppProviders>
  )
}

export default App
