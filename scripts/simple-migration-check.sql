-- Simple migration check script
-- Run this in Supabase SQL Editor to check droplet name synchronization

-- 1. Check if do_droplet_name column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'account_tool_environments' 
  AND column_name = 'do_droplet_name';

-- 2. Show current droplet records with name comparison
SELECT 
    id,
    name as "intended_name",
    do_droplet_name as "actual_do_name", 
    do_droplet_id,
    status,
    CASE 
        WHEN do_droplet_name IS NULL THEN '❌ Missing DO name'
        WHEN do_droplet_name = name THEN '✅ Names match'
        WHEN do_droplet_name != name THEN '⚠️ Names different'
        ELSE '❓ Unknown status'
    END as "sync_status"
FROM account_tool_environments 
WHERE do_droplet_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 3. Count records that need name sync
SELECT 
    COUNT(*) as total_droplets,
    COUNT(CASE WHEN do_droplet_name IS NULL THEN 1 END) as missing_do_names,
    COUNT(CASE WHEN do_droplet_name IS NOT NULL THEN 1 END) as have_do_names
FROM account_tool_environments 
WHERE do_droplet_id IS NOT NULL; 