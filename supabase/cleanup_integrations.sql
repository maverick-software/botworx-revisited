-- Cleanup script for removing dummy integrations data
-- Run this in Supabase SQL Editor to remove the example/dummy data

-- Delete in proper order due to foreign key constraints
-- 1. Delete user integrations first (if any exist)
DELETE FROM user_integrations;

-- 2. Delete integrations
DELETE FROM integrations;

-- 3. Delete integration categories
DELETE FROM integration_categories;

-- Show the final counts to verify cleanup
SELECT 'Categories' as table_name, count(*) as count FROM integration_categories
UNION ALL
SELECT 'Integrations' as table_name, count(*) as count FROM integrations
UNION ALL
SELECT 'User Integrations' as table_name, count(*) as count FROM user_integrations
ORDER BY table_name;

-- Optional: Reset the sequences if you want to start fresh with ID 1
-- (Uncomment these lines if you want to reset auto-increment counters)
-- ALTER SEQUENCE integration_categories_id_seq RESTART WITH 1;
-- ALTER SEQUENCE integrations_id_seq RESTART WITH 1;
-- ALTER SEQUENCE user_integrations_id_seq RESTART WITH 1; 