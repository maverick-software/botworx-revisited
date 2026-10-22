import type { SupabaseClient } from '@supabase/supabase-js'

export interface UnifiedConnection {
  connection_id: string
  user_id: string
  provider_name: string
  provider_display_name: string
  external_username: string | null
  connection_name: string | null
  credential_type: 'oauth' | 'api_key'
  connection_status: 'active' | 'expired' | 'revoked' | 'error' | 'disconnected'
  token_expires_at: string | null
  scopes_granted: string[]
  created_at: string
  updated_at: string
}

export interface FetchConnectionsOptions {
  includeRevoked?: boolean
  includeExpired?: boolean
}

export async function fetchUserConnections(
  supabase: SupabaseClient,
  userId: string,
  options: FetchConnectionsOptions = {}
): Promise<UnifiedConnection[]> {
  const { includeRevoked = false, includeExpired = true } = options

  // Prefer RPC if available for consistency across UI surfaces
  const { data, error } = await supabase.rpc('get_user_integration_credentials', {
    p_user_id: userId,
  })

  if (error) throw new Error(error.message)

  const results: UnifiedConnection[] = (data || []).map((row: any) => ({
    connection_id: row.connection_id || row.credential_id,
    user_id: row.user_id,
    provider_name: row.provider_name || row.service_providers?.name,
    provider_display_name: row.provider_display_name || row.service_providers?.display_name,
    external_username: row.external_username ?? null,
    connection_name: row.connection_name ?? null,
    credential_type: row.credential_type,
    connection_status: row.connection_status,
    token_expires_at: row.token_expires_at ?? null,
    scopes_granted: row.scopes_granted || [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))

  return results.filter((c) => {
    if (!includeRevoked && c.connection_status === 'revoked') return false
    if (!includeExpired && c.connection_status === 'expired') return false
    return true
  })
}

export async function revokeConnection(
  supabase: SupabaseClient,
  connectionId: string
): Promise<void> {
  // First try to delete the connection completely
  const deleted = await deleteConnectionHard(supabase, connectionId)
  
  if (!deleted) {
    // If we can't delete due to foreign key constraints, mark as revoked temporarily
    const { error } = await supabase
      .from('user_integration_credentials')
      .update({ connection_status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', connectionId)

    if (error) throw new Error(error.message)
    
    // Log that this should be cleaned up later
    console.warn(`Connection ${connectionId} marked as revoked instead of deleted due to foreign key constraints`)
  }
}

export async function deleteConnectionHard(
  supabase: SupabaseClient,
  connectionId: string
): Promise<boolean> {
  // Attempt a hard delete; return false on FK violations so caller can fall back to revoke
  const { error } = await supabase.from('user_integration_credentials').delete().eq('id', connectionId)
  if (error) {
    // Best effort: do not throw on foreign key errors, signal caller we could not delete
    return false
  }
  return true
}


