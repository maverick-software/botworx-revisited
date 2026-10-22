import React, { useEffect, useMemo } from 'react'
import { useConnections } from '../hooks/useConnections'

interface Props {
  providerName: 'pinecone' | 'getzep'
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}

export function CredentialSelector({ providerName, value, onChange, disabled }: Props) {
  const { connections, loading } = useConnections({ includeRevoked: false, includeExpired: false })

  const options = useMemo(() => {
    return connections
      .filter((c) => c.provider_name === providerName && c.credential_type === 'api_key' && c.connection_status === 'active')
      .map((c) => ({ id: c.connection_id, label: c.connection_name || c.external_username || `${c.provider_display_name} Key` }))
  }, [connections, providerName])

  useEffect(() => {
    if (!value && options.length > 0) {
      onChange(options[0].id)
    }
  }, [value, options, onChange])

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || loading}
      className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 text-sm"
    >
      {loading && <option value="">Loading...</option>}
      {!loading && options.length === 0 && <option value="">No saved keys found. Add one in Integrations.</option>}
      {!loading && options.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  )
}


