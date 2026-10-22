-- Migration: Create upsert vault secret function
-- Purpose: Handle vault secret creation with conflict resolution for existing names
-- Issue: create_vault_secret fails with 409 when secret name already exists
-- File: 20250914000002_create_upsert_vault_secret_function.sql

-- Create function to upsert vault secrets (create or update)
CREATE OR REPLACE FUNCTION public.upsert_vault_secret(
    p_secret TEXT,
    p_name TEXT,
    p_description TEXT
)
RETURNS TABLE(id UUID, name TEXT, created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_secret_id UUID;
    v_existing_id UUID;
    v_created BOOLEAN := FALSE;
BEGIN
    -- Check if secret with this name already exists
    SELECT s.id INTO v_existing_id
    FROM vault.secrets s
    WHERE s.name = p_name
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
        -- Update existing secret
        PERFORM vault.update_secret(v_existing_id, p_secret);
        v_secret_id := v_existing_id;
        v_created := FALSE;
    ELSE
        -- Create new secret
        v_secret_id := vault.create_secret(p_secret, p_name, p_description);
        v_created := TRUE;
    END IF;
    
    -- Return the result
    RETURN QUERY SELECT v_secret_id, p_name, v_created;
END;
$$;

-- Grant execution rights to service_role
GRANT EXECUTE ON FUNCTION public.upsert_vault_secret(TEXT, TEXT, TEXT) TO service_role;

-- Add helpful comment
COMMENT ON FUNCTION public.upsert_vault_secret(TEXT, TEXT, TEXT) IS 
'Creates a new vault secret or updates existing one if name conflicts. Returns secret ID and creation status.';

-- Create a simpler wrapper that just returns the UUID (for backward compatibility)
CREATE OR REPLACE FUNCTION public.create_or_update_vault_secret(
    p_secret TEXT,
    p_name TEXT,
    p_description TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result RECORD;
BEGIN
    SELECT * INTO v_result FROM public.upsert_vault_secret(p_secret, p_name, p_description);
    RETURN v_result.id;
END;
$$;

-- Grant execution rights to service_role
GRANT EXECUTE ON FUNCTION public.create_or_update_vault_secret(TEXT, TEXT, TEXT) TO service_role;

-- Add helpful comment
COMMENT ON FUNCTION public.create_or_update_vault_secret(TEXT, TEXT, TEXT) IS 
'Simple wrapper for upsert_vault_secret that only returns the UUID. Handles conflicts gracefully.';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 20250914000002_create_upsert_vault_secret_function completed successfully';
    RAISE NOTICE 'Created upsert_vault_secret and create_or_update_vault_secret functions';
    RAISE NOTICE 'These functions handle vault secret name conflicts gracefully';
END $$;
