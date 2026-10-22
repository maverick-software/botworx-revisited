# Signup Toggle Feature Documentation

**Date**: January 16, 2025  
**Feature**: Admin Signup Toggle Control  
**Status**: ✅ Complete - Ready for Deployment

## Overview

This feature allows administrators to enable or disable new user signups via a toggle on the Admin User Management page. When disabled, users attempting to access the registration page will see a message indicating that registrations are currently unavailable.

## Components

### 1. Database Migration
**File**: `supabase/migrations/20250116000000_create_platform_settings_and_signup_toggle.sql`

Creates the `platform_settings` table for storing platform-wide configuration:
- Stores signup status as 'true' or 'false'
- Default status is 'true' (signups enabled)
- Admin-only access via RLS policies
- Anonymous users can READ signup status only
- Service role has full access

### 2. Edge Functions

#### Get Signup Status
**File**: `supabase/functions/get-signup-status/index.ts`
- **Purpose**: Check if signups are currently enabled
- **Access**: Public (anonymous users can call this)
- **Returns**: `{ enabled: boolean, message: string }`
- **Default Behavior**: Returns enabled=true if setting not found

#### Toggle Signup Status
**File**: `supabase/functions/admin-toggle-signup/index.ts`
- **Purpose**: Enable or disable signups
- **Access**: Admin users only (verified via user_roles)
- **Requires**: JWT authentication
- **Body**: `{ enabled: boolean }`
- **Returns**: `{ success: boolean, enabled: boolean, message: string }`

### 3. Frontend Components

#### Register Page
**File**: `src/pages/RegisterPage.tsx`
- Checks signup status on mount
- Shows loading state while checking
- Displays disabled message if signups are off
- Provides link back to login page
- Only shows registration form if signups are enabled

#### Admin User Management
**File**: `src/pages/AdminUserManagement.tsx`
- Displays signup toggle card at top of page
- Shows current status with visual indicators
- Toggle switch to enable/disable signups
- Real-time status updates
- Loading state during toggle operation

## User Experience

### For New Users (Signups Disabled)
1. Navigate to `/register` page
2. See "Registration Unavailable" message
3. Clear explanation that signups are disabled
4. Link back to login page

### For Administrators
1. Navigate to Admin → User Management
2. See "New User Registrations" card at top
3. Visual status indicator (green = enabled, red = disabled)
4. Toggle switch to change status
5. Instant feedback on status changes

## Deployment Instructions

### Step 1: Deploy Database Migration
```powershell
# Navigate to project root
cd C:\Users\charl\Software\Agentopia

# Push the migration to Supabase
supabase db push --include-all
```

### Step 2: Deploy Edge Functions
```powershell
# Deploy get-signup-status function
supabase functions deploy get-signup-status

# Deploy admin-toggle-signup function
supabase functions deploy admin-toggle-signup
```

### Step 3: Verify Frontend Changes
The frontend changes are already in place:
- `src/pages/RegisterPage.tsx` - Updated
- `src/pages/AdminUserManagement.tsx` - Updated

No additional deployment needed for frontend (handled by normal build process).

## Testing Guide

### Test 1: Initial Setup
1. ✅ Verify migration created `platform_settings` table
2. ✅ Verify default signup_enabled = 'true' exists
3. ✅ Verify RLS policies are in place

```sql
-- Check table exists
SELECT * FROM platform_settings WHERE key = 'signup_enabled';

-- Should return: key='signup_enabled', value='true'
```

### Test 2: Anonymous User Can Check Status
1. ✅ Call get-signup-status function without auth
2. ✅ Should return enabled=true

```powershell
# Test via curl (or browser)
curl -X POST https://your-project.supabase.co/functions/v1/get-signup-status
```

### Test 3: Admin Can Toggle Status
1. ✅ Log in as admin user
2. ✅ Navigate to Admin → User Management
3. ✅ See signup toggle card with current status
4. ✅ Click toggle to disable signups
5. ✅ Verify status changes to "Disabled"
6. ✅ Click toggle to re-enable
7. ✅ Verify status changes to "Enabled"

### Test 4: Register Page Respects Status

**When Enabled:**
1. ✅ Navigate to `/register`
2. ✅ See registration form
3. ✅ Can complete registration

**When Disabled:**
1. ✅ Admin disables signups
2. ✅ Navigate to `/register` (new browser/incognito)
3. ✅ See "Registration Unavailable" message
4. ✅ No registration form visible
5. ✅ Can click back to login

### Test 5: Non-Admin Cannot Toggle
1. ✅ Log in as regular user
2. ✅ Try to call admin-toggle-signup function
3. ✅ Should return 403 Forbidden error

## Security Features

### Row Level Security (RLS)
- ✅ Admins can read/write all settings
- ✅ Anonymous users can only read signup_enabled
- ✅ Service role has full access
- ✅ Regular users cannot modify settings

### Admin Verification
- ✅ JWT authentication required
- ✅ Admin role checked via user_roles table
- ✅ Non-admin requests rejected with 403

### Default Behavior
- ✅ Signups default to enabled if setting missing
- ✅ Graceful error handling in all components
- ✅ Clear user feedback on all operations

## Database Schema

### platform_settings Table
```sql
CREATE TABLE platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  description text,
  category text DEFAULT 'general',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Example Row
```json
{
  "id": "...",
  "key": "signup_enabled",
  "value": "true",
  "description": "Controls whether new users can sign up for accounts",
  "category": "authentication",
  "created_at": "2025-01-16T...",
  "updated_at": "2025-01-16T..."
}
```

## API Reference

### GET /functions/v1/get-signup-status
**Request**: No body required
**Response**:
```json
{
  "enabled": true,
  "message": "Signups are currently enabled"
}
```

### POST /functions/v1/admin-toggle-signup
**Request**:
```json
{
  "enabled": false
}
```
**Response**:
```json
{
  "success": true,
  "enabled": false,
  "message": "Signups disabled successfully"
}
```

## Troubleshooting

### Issue: Toggle not working
- Verify user has admin role
- Check browser console for errors
- Verify edge functions are deployed
- Check Supabase function logs

### Issue: Register page shows form when disabled
- Clear browser cache
- Check network tab for get-signup-status call
- Verify database setting value is 'false'

### Issue: Anonymous users see error
- Verify RLS policy for anonymous read access
- Check edge function CORS headers
- Test with curl/Postman

## Future Enhancements

Potential improvements for this feature:
- Add scheduled enable/disable times
- Email notifications when signups toggled
- Signup request queue system
- Custom disabled message per admin
- Analytics on blocked signup attempts
- Whitelist emails for signup when disabled

## Related Files

### Database
- `supabase/migrations/20250116000000_create_platform_settings_and_signup_toggle.sql`

### Edge Functions
- `supabase/functions/get-signup-status/index.ts`
- `supabase/functions/admin-toggle-signup/index.ts`

### Frontend
- `src/pages/RegisterPage.tsx`
- `src/pages/AdminUserManagement.tsx`

---

**Version**: 1.0  
**Last Updated**: January 16, 2025  
**Tested**: ⏳ Pending deployment and testing  
**Approved By**: Pending user approval

