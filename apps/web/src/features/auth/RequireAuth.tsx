import type { PropsWithChildren } from 'react'
import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useApiClient } from '../../shared/api/apiClientContext'
import { LoadingState } from '../../shared/components/DataState'
import { useAuthSession } from './authSession'

export function RequireAuth({ children }: PropsWithChildren) {
  const location = useLocation()
  const apiClient = useApiClient()
  const { setSession, status } = useAuthSession()
  const [hasCheckedServerSession, setHasCheckedServerSession] = useState(false)

  useEffect(() => {
    let isCurrent = true

    if (status === 'authenticated') {
      setHasCheckedServerSession(true)
      return () => {
        isCurrent = false
      }
    }

    setHasCheckedServerSession(false)
    void apiClient
      .getSession()
      .then((session) => {
        if (isCurrent) {
          setSession(session)
          setHasCheckedServerSession(true)
        }
      })
      .catch(() => {
        if (isCurrent) {
          setHasCheckedServerSession(true)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [apiClient, setSession, status])

  if (status !== 'authenticated') {
    if (!hasCheckedServerSession) {
      return <LoadingState label="Restoring operator session..." />
    }

    return <Navigate to="/guard/login" replace state={{ from: location.pathname }} />
  }

  return children
}
