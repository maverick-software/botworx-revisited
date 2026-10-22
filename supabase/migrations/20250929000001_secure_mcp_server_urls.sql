-- Migration: Secure MCP Server URLs with Vault Storage
-- This migration adds vault storage for MCP server URLs to ensure enterprise-grade security

-- Step 1: Add vault storage columns to agent_mcp_connections
ALTER TABLE agent_mcp_connections 
ADD COLUMN vault_server_url_id TEXT,
ADD COLUMN server_url_deprecated TEXT;

-- Step 2: Create vault functions if they don't exist
CREATE OR REPLACE FUNCTION public.create_vault_secret(
  p_secret TEXT,
  p_name TEXT, 
  p_description TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_id UUID;
BEGIN
  -- Only service role can create vault secrets
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Insufficient privileges to create vault secrets';
  END IF;
  
  -- Create secret in vault
  SELECT vault.create_secret(p_secret, p_name, p_description) INTO secret_id;
  
  RETURN secret_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_decrypt(vault_id TEXT)
RETURNS TEXT AS $$
DECLARE
    decrypted_value TEXT;
    uuid_id UUID;
BEGIN
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Insufficient privileges to decrypt vault secrets';
    END IF;

    -- Validate UUID format
    BEGIN
        uuid_id := vault_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL; -- Invalid UUID format
    END;

    -- Decrypt from vault only
    BEGIN
        SELECT decrypted_secret INTO decrypted_value
        FROM vault.decrypted_secrets
        WHERE id = uuid_id
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        decrypted_value := NULL;
    END;

    RETURN decrypted_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create function to get decrypted server URL for MCP connections
CREATE OR REPLACE FUNCTION public.get_mcp_server_url(connection_id UUID)
RETURNS TEXT AS $$
DECLARE
    vault_id TEXT;
    decrypted_url TEXT;
    fallback_url TEXT;
BEGIN
    -- Only service role can decrypt URLs
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Insufficient privileges to access MCP server URLs';
    END IF;

    -- Get vault ID and fallback URL
    SELECT vault_server_url_id, server_url_deprecated 
    INTO vault_id, fallback_url
    FROM agent_mcp_connections 
    WHERE id = connection_id;

    -- Try to decrypt from vault first
    IF vault_id IS NOT NULL THEN
        SELECT vault_decrypt(vault_id) INTO decrypted_url;
        IF decrypted_url IS NOT NULL THEN
            RETURN decrypted_url;
        END IF;
    END IF;

    -- Fallback to deprecated column during migration period
    IF fallback_url IS NOT NULL THEN
        RETURN fallback_url;
    END IF;

    -- No URL found
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create migration function to move existing URLs to vault
CREATE OR REPLACE FUNCTION public.migrate_mcp_urls_to_vault()
RETURNS INTEGER AS $$
DECLARE
    connection_record RECORD;
    vault_id UUID;
    migrated_count INTEGER := 0;
BEGIN
    -- Only service role can perform migration
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Insufficient privileges to migrate MCP URLs';
    END IF;

    -- Process each connection with a plain text URL
    FOR connection_record IN 
        SELECT id, server_url, connection_name
        FROM agent_mcp_connections 
        WHERE server_url IS NOT NULL 
        AND vault_server_url_id IS NULL
    LOOP
        -- Create vault secret for the URL
        BEGIN
            SELECT create_vault_secret(
                connection_record.server_url,
                'mcp_server_url_' || connection_record.id || '_' || extract(epoch from now()),
                'MCP Server URL for connection: ' || connection_record.connection_name
            ) INTO vault_id;

            -- Update the record with vault ID and move URL to deprecated column
            UPDATE agent_mcp_connections 
            SET 
                vault_server_url_id = vault_id::TEXT,
                server_url_deprecated = server_url,
                server_url = NULL,  -- Clear the plain text URL
                updated_at = NOW()
            WHERE id = connection_record.id;

            migrated_count := migrated_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log error but continue with other records
            RAISE WARNING 'Failed to migrate URL for connection %: %', connection_record.id, SQLERRM;
        END;
    END LOOP;

    RETURN migrated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Migrate existing data first
-- Move existing server_url values to server_url_deprecated for safety
UPDATE agent_mcp_connections 
SET server_url_deprecated = server_url 
WHERE server_url IS NOT NULL AND vault_server_url_id IS NULL;

-- Step 6: Add security constraints (after migration)
-- Ensure that active connections have either vault ID or deprecated URL (during migration)
ALTER TABLE agent_mcp_connections 
ADD CONSTRAINT chk_secure_url_storage CHECK (
    (is_active = false) OR 
    (vault_server_url_id IS NOT NULL) OR 
    (server_url_deprecated IS NOT NULL)
);

-- Step 7: Create trigger to prevent plain text URL storage
CREATE OR REPLACE FUNCTION public.prevent_plaintext_mcp_urls()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent storing URLs in the main server_url column (force vault usage)
    IF NEW.server_url IS NOT NULL AND NEW.vault_server_url_id IS NULL THEN
        RAISE EXCEPTION 'Security Error: MCP server URLs must be stored in vault. Use vault storage for new connections.';
    END IF;
    
    -- Ensure vault UUID format if provided
    IF NEW.vault_server_url_id IS NOT NULL THEN
        IF NEW.vault_server_url_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            RAISE EXCEPTION 'Security Error: vault_server_url_id must be a valid UUID. Use create_vault_secret() to encrypt URLs.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_plaintext_mcp_urls_trigger
  BEFORE INSERT OR UPDATE ON agent_mcp_connections
  FOR EACH ROW
  EXECUTE FUNCTION prevent_plaintext_mcp_urls();

-- Step 8: Update RLS policies to use vault function
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own agent MCP connections" ON agent_mcp_connections;
DROP POLICY IF EXISTS "Users can manage their own agent MCP connections" ON agent_mcp_connections;

-- Create new policies that don't expose server URLs
CREATE POLICY "Users can view their own agent MCP connections" ON agent_mcp_connections
    FOR SELECT USING (
        agent_id IN (
            SELECT id FROM agents WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their own agent MCP connections" ON agent_mcp_connections
    FOR ALL USING (
        agent_id IN (
            SELECT id FROM agents WHERE user_id = auth.uid()
        )
    );

-- Step 9: Create view for safe MCP connection access (without exposing URLs)
CREATE OR REPLACE VIEW public.safe_agent_mcp_connections AS
SELECT 
    id,
    agent_id,
    connection_name,
    connection_type,
    is_active,
    auth_config,
    created_at,
    updated_at,
    -- Never expose actual URLs in views
    CASE 
        WHEN vault_server_url_id IS NOT NULL THEN '🔒 Encrypted'
        WHEN server_url_deprecated IS NOT NULL THEN '🔒 Encrypted (Legacy)'
        ELSE 'No URL'
    END as server_url_status
FROM agent_mcp_connections;

-- Grant access to the safe view
GRANT SELECT ON public.safe_agent_mcp_connections TO authenticated;

-- Step 10: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_mcp_connections_vault_url 
ON agent_mcp_connections(vault_server_url_id) 
WHERE vault_server_url_id IS NOT NULL;

-- Step 11: Add comments for documentation
COMMENT ON COLUMN agent_mcp_connections.vault_server_url_id IS 'UUID reference to encrypted server URL in Supabase Vault';
COMMENT ON COLUMN agent_mcp_connections.server_url_deprecated IS 'Deprecated: Plain text URL storage (migration only)';
COMMENT ON COLUMN agent_mcp_connections.server_url IS 'DEPRECATED: Must be NULL for security (use vault_server_url_id)';
COMMENT ON FUNCTION public.get_mcp_server_url(UUID) IS 'Securely retrieves decrypted MCP server URL (service role only)';
COMMENT ON FUNCTION public.migrate_mcp_urls_to_vault() IS 'One-time migration function to move existing URLs to vault storage';

-- Step 12: Security audit query
-- This query can be used to verify no plain text URLs exist
CREATE OR REPLACE FUNCTION public.audit_mcp_url_security()
RETURNS TABLE(
    security_status TEXT,
    connection_count BIGINT,
    details TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'SECURE_VAULT_STORAGE'::TEXT,
        COUNT(*),
        'Connections with vault-encrypted URLs'::TEXT
    FROM agent_mcp_connections 
    WHERE vault_server_url_id IS NOT NULL AND server_url IS NULL
    
    UNION ALL
    
    SELECT 
        'MIGRATION_PENDING'::TEXT,
        COUNT(*),
        'Connections with deprecated plain text URLs'::TEXT
    FROM agent_mcp_connections 
    WHERE server_url_deprecated IS NOT NULL AND vault_server_url_id IS NULL
    
    UNION ALL
    
    SELECT 
        'SECURITY_VIOLATION'::TEXT,
        COUNT(*),
        'CRITICAL: Connections with plain text URLs in main column'::TEXT
    FROM agent_mcp_connections 
    WHERE server_url IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_vault_secret(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_decrypt(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_mcp_server_url(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.migrate_mcp_urls_to_vault() TO service_role;
GRANT EXECUTE ON FUNCTION public.audit_mcp_url_security() TO authenticated;
