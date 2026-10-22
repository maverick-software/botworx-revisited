# Migration File Fix - January 1, 2026

## Problem
Migration sync error between local and cloud Supabase due to improper migration filename.

## Root Cause
The file `20251017_create_system_prompts.sql` was missing the required 6-digit timestamp suffix that Supabase expects.

Supabase migration naming convention:
```
YYYYMMDDHHmmss_description.sql
```

The file had: `20251017_create_system_prompts.sql` (only date, no time)
Should be: `20251017HHMMSS_create_system_prompts.sql`

## Fix Applied

**Renamed file:**
```
FROM: supabase/migrations/20251017_create_system_prompts.sql
TO:   supabase/migrations/20251017000000_create_system_prompts.sql
```

Added `000000` timestamp to properly order it before `20251017000001_add_intent_classifier_prompt.sql`.

## Current State

Migration files in correct order:
1. ✅ `20251017000000_create_system_prompts.sql` 
2. ✅ `20251017000001_add_intent_classifier_prompt.sql`
3. ✅ `20260101000001_add_team_hierarchy.sql` (ready to push)

## Next Steps

1. User needs to re-authenticate with Supabase:
   ```bash
   npx supabase login
   ```

2. Then push migrations:
   ```bash
   npx supabase db push
   ```

This will push the team hierarchy migration successfully.

## Files Modified
- Renamed: `supabase/migrations/20251017_create_system_prompts.sql` → `supabase/migrations/20251017000000_create_system_prompts.sql`

**Status**: File fix complete. Awaiting user re-authentication to push migrations.

