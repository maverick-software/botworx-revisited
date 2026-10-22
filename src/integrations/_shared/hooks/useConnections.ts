import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { UnifiedConnection, FetchConnectionsOptions } from '../services/connections'
import { fetchUserConnections, revokeConnection, deleteConnectionHard } from '../services/connections'

export function useConnections(options: FetchConnectionsOptions = {}) {
  const { user } = useAuth()
  const [connections, setConnections] = useState<UnifiedConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const list = await fetchUserConnections(supabase, user.id, options)
      setConnections(list)
    } catch (e: any) {
      setError(e?.message || 'Failed to load connections')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const revoke = async (connectionId: string) => {
    await revokeConnection(supabase, connectionId)
    // Optimistic update: remove it from local list immediately
    setConnections((prev) => prev.filter((c) => c.connection_id !== connectionId))
  }

  const remove = async (connectionId: string) => {
    const deleted = await deleteConnectionHard(supabase, connectionId)
    if (!deleted) {
      // Fall back to revoke if hard delete is not possible due to FKs
      await revoke(connectionId)
    } else {
      setConnections((prev) => prev.filter((c) => c.connection_id !== connectionId))
    }
  }

  return { connections, loading, error, refetch, revoke, remove }
}


