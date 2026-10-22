-- Quick fix for the current droplet name synchronization issue
-- This script will:
-- 1. Check if do_droplet_name column exists
-- 2. Update the current droplet with the correct DigitalOcean name

-- First, let's see the current state
SELECT 
    id,
    name as "current_display_name",
    do_droplet_name as "do_name_field",
    do_droplet_id,
    status,
    public_ip_address
FROM account_tool_environments 
WHERE do_droplet_id IS NOT NULL
ORDER BY created_at DESC;

-- Update the existing droplet to show the correct DigitalOcean name
-- Replace 'toolbox-3f966af2-ed2898fd' with the actual name from your DigitalOcean dashboard
UPDATE account_tool_environments 
SET do_droplet_name = 'toolbox-3f966af2-ed2898fd'
WHERE do_droplet_id = 503259738;

-- Verify the update
SELECT 
    id,
    name as "user_friendly_name", 
    do_droplet_name as "actual_do_name",
    do_droplet_id,
    status,
    public_ip_address,
    CASE 
        WHEN do_droplet_name IS NOT NULL THEN '✅ DO name set'
        ELSE '❌ Missing DO name'
    END as "sync_status"
FROM account_tool_environments 
WHERE do_droplet_id = 503259738; 