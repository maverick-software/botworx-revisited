-- Fix migration history by removing the problematic 20250125 entry
-- and ensuring our local migrations are properly tracked

-- First, let's see what's in the migration history
SELECT version, name, statements, hash, executed_at 
FROM supabase_migrations.schema_migrations 
WHERE version = '20250125'
ORDER BY executed_at DESC;

-- Remove the problematic 20250125 migration from history
DELETE FROM supabase_migrations.schema_migrations 
WHERE version = '20250125';

-- Now check what remains
SELECT version, name, statements, hash, executed_at 
FROM supabase_migrations.schema_migrations 
ORDER BY executed_at DESC
LIMIT 10;
