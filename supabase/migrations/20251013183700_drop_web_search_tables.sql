-- Drop web search specific tables and migrate to unified credential system
-- Part of credential centralization effort
-- Date: October 13, 2025

-- These tables are redundant - web search credentials should be stored in 
-- user_integration_credentials (the unified credential table) instead of having
-- a separate parallel system for web search providers.

-- All web search API keys (Serper, SerpAPI, Brave Search) should use the
-- centralized user_integration_credentials table with service_providers

-- Drop dependent tables first
DROP TABLE IF EXISTS public.agent_web_search_permissions CASCADE;
DROP TABLE IF EXISTS public.web_search_operation_logs CASCADE;
DROP TABLE IF EXISTS public.user_web_search_keys CASCADE;
DROP TABLE IF EXISTS public.web_search_providers CASCADE;

-- Drop related functions
DROP FUNCTION IF EXISTS public.get_user_web_search_keys() CASCADE;
DROP FUNCTION IF EXISTS public.update_user_web_search_keys_updated_at() CASCADE;

-- Migration notes:
-- Web search providers (Serper API, SerpAPI, Brave Search) are already in service_providers
-- Web search API keys should be stored in user_integration_credentials with credential_type='api_key'
-- Agent permissions should use agent_integration_permissions table
-- Operation logs should use existing integration logging patterns
-- User can re-add web search API keys via the unified integrations UI

