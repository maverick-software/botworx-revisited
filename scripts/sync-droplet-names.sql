-- Manual sync script to fix droplet name mismatch
-- Run this after verifying the correct name in DigitalOcean dashboard

-- For the specific droplet ID 503259738, update with correct name
UPDATE account_tool_environments 
SET 
    do_droplet_name = 'toolbox-3f966af2-ed2898fd',
    name = 'toolbox-3f966af2-ed2898fd'
WHERE do_droplet_id = 503259738;

-- Verify the update
SELECT 
    id,
    name as "intended_name",
    do_droplet_name as "actual_do_name", 
    do_droplet_id,
    status,
    public_ip_address
FROM account_tool_environments 
WHERE do_droplet_id = 503259738;

-- Check all droplets to see if there are other mismatches
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
ORDER BY created_at DESC; 