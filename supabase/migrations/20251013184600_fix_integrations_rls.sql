-- Fix integrations (service_providers) RLS - proper access control
-- Date: October 13, 2025
-- Reason: No public access - require authentication, admin-only CRUD

-- Access Control Requirements:
-- 1. Regular authenticated users: READ-only (browse integration catalog)
-- 2. Agents: READ-only (same as users - browse available integrations)
-- 3. Admins: Full CRUD (manage integrations)
-- 4. Service role: Full access (for system operations)

-- Drop existing policies
DROP POLICY IF EXISTS "Integrations are readable by everyone" ON service_providers;
DROP POLICY IF EXISTS "Public read access to service providers" ON service_providers;
DROP POLICY IF EXISTS "Authenticated users can view integrations" ON service_providers;
DROP POLICY IF EXISTS "Service role full access to service providers" ON service_providers;

-- Policy 1: Authenticated users and agents can READ enabled integrations
CREATE POLICY "Authenticated users can view integrations" ON service_providers
    FOR SELECT 
    TO authenticated
    USING (is_enabled = true);

-- Policy 2: Service role has full access (system operations)
CREATE POLICY "Service role full access to service providers" ON service_providers
    FOR ALL
    TO service_role
    USING (true);

-- Policy 3: Admin-only CRUD (INSERT, UPDATE, DELETE)
-- Note: This requires admin role checking
-- For now, only service_role can modify (admins use service_role for management)
-- If you have an admin_role check, uncomment and modify:

-- Migration note:
-- The integrations VIEW queries service_providers table
-- By restricting service_providers to authenticated users only,
-- the integrations view is also restricted
-- Users must log in to see available integrations

