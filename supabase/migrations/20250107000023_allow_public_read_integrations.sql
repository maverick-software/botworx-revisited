-- Allow public read access to integrations
-- These are not sensitive data, so anonymous users should be able to read them

-- Update integration_categories policy to allow anonymous read
DROP POLICY IF EXISTS "Integration categories are readable by authenticated users" ON integration_categories;
CREATE POLICY "Integration categories are readable by everyone"
    ON integration_categories FOR SELECT
    TO public
    USING (true);

-- Update integrations policy to allow anonymous read
DROP POLICY IF EXISTS "Integrations are readable by authenticated users" ON integrations;
CREATE POLICY "Integrations are readable by everyone"
    ON integrations FOR SELECT
    TO public
    USING (true); 