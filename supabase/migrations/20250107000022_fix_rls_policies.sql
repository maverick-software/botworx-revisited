-- Fix RLS policies for integrations tables
-- Allow read access to integrations and categories for all authenticated users

-- Enable RLS on integration_categories if not already enabled
ALTER TABLE integration_categories ENABLE ROW LEVEL SECURITY;

-- Create read policy for integration_categories
DROP POLICY IF EXISTS "Integration categories are readable by authenticated users" ON integration_categories;
CREATE POLICY "Integration categories are readable by authenticated users"
    ON integration_categories FOR SELECT
    TO authenticated
    USING (true);

-- Enable RLS on integrations if not already enabled  
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Create read policy for integrations
DROP POLICY IF EXISTS "Integrations are readable by authenticated users" ON integrations;
CREATE POLICY "Integrations are readable by authenticated users"
    ON integrations FOR SELECT
    TO authenticated
    USING (true);

-- Create service role policies for full access
DROP POLICY IF EXISTS "Service role full access to integration_categories" ON integration_categories;
CREATE POLICY "Service role full access to integration_categories"
    ON integration_categories FOR ALL
    TO service_role
    USING (true);

DROP POLICY IF EXISTS "Service role full access to integrations" ON integrations;
CREATE POLICY "Service role full access to integrations"
    ON integrations FOR ALL
    TO service_role
    USING (true); 