-- Simplify to use Supabase Vault's built-in create_secret function

-- Drop existing function first to avoid parameter name conflicts
DROP FUNCTION IF EXISTS public.create_vault_secret(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_vault_secret(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_vault_secret(TEXT);

CREATE OR REPLACE FUNCTION "public"."create_vault_secret"("secret_value" "text", "name" "text" DEFAULT NULL::"text", "description" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
    SELECT vault.create_secret(secret_value, name, description);
$$; 