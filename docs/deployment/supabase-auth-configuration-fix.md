# Supabase Auth Configuration - Localhost Redirect Issue

## Problem Summary

- **Symptom**: Google OAuth login from `https://app.gofragents.com` redirects to `http://localhost:3000`
- **Root Cause**: Supabase Dashboard `site_url` is set to localhost instead of production domain
- **Impact**: Production users cannot log in with Google OAuth

---

## Understanding Supabase Auth Configuration

### Two Separate Configurations

1. **`supabase/config.toml`** (Local File)
   - **Purpose**: Local Supabase CLI development only
   - **Scope**: Only affects `supabase start` and local Edge Functions
   - **Does NOT affect**: Hosted Supabase (production)

2. **Supabase Dashboard Settings** (Cloud Configuration)
   - **Purpose**: Production hosted Supabase instance
   - **Scope**: Affects your live application at `https://app.gofragents.com`
   - **Location**: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/auth/url-configuration

---

## Solution: Update Dashboard Settings

### Step 1: Access Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/txhscptzjrrudnqwavcb
2. Navigate to: **Authentication** → **URL Configuration**

### Step 2: Update Site URL

**Current (Wrong):**
```
site_url: http://localhost:3000
```

**Change to:**
```
site_url: https://app.gofragents.com
```

### Step 3: Configure Redirect URLs

Add **ALL** of these to the **Redirect URLs** list:

```
https://app.gofragents.com
https://app.gofragents.com/
https://app.gofragents.com/**
http://localhost:5173
http://localhost:5173/
http://localhost:5173/**
```

**Why add localhost?**
- Allows developers to test OAuth locally
- Does not compromise security (OAuth requires exact matches)

### Step 4: Save and Wait

1. Click **Save**
2. Wait **2-3 minutes** for changes to propagate across Supabase infrastructure
3. Clear browser cache or use incognito mode to test

---

## How OAuth Redirects Work

### Before Fix (Broken Flow):

```
User on app.gofragents.com
    ↓
Click "Continue with Google"
    ↓
Redirect to Google OAuth (user authenticates)
    ↓
Google redirects to: txhscptzjrrudnqwavcb.supabase.co/auth/v1/callback
    ↓
Supabase uses site_url from Dashboard: http://localhost:3000 ❌
    ↓
User redirected to localhost (doesn't work in production)
```

### After Fix (Working Flow):

```
User on app.gofragents.com
    ↓
Click "Continue with Google"
    ↓
Redirect to Google OAuth (user authenticates)
    ↓
Google redirects to: txhscptzjrrudnqwavcb.supabase.co/auth/v1/callback
    ↓
Supabase uses site_url from Dashboard: https://app.gofragents.com ✅
    ↓
User redirected back to app.gofragents.com (success!)
```

---

## Multi-Environment Setup

### Development Environment

**Developer Machine:**
- Uses `config.toml` with `site_url: http://localhost:5173`
- Tests OAuth with localhost redirect URLs
- Changes to `config.toml` do NOT affect production

**To test locally:**
```bash
npm run dev
# Visit http://localhost:5173
# OAuth will redirect back to localhost ✅
```

### Production Environment

**Live Application:**
- Uses Supabase Dashboard settings
- `site_url: https://app.gofragents.com`
- Redirects always go to production domain

**Users experience:**
```
Visit https://app.gofragents.com
OAuth redirects to https://app.gofragents.com ✅
```

---

## Troubleshooting

### Issue 1: Still redirecting to localhost after update

**Possible causes:**
1. Changes haven't propagated (wait 5 minutes)
2. Browser cache (try incognito mode)
3. Wrong Supabase project (verify project ID)

**Solution:**
```bash
# Clear all browser data
# Open incognito window
# Try OAuth flow again
```

### Issue 2: "redirect_uri_mismatch" error

**Cause:** Google OAuth credentials don't include Supabase callback URL

**Solution:**
1. Go to: Google Cloud Console → APIs & Services → Credentials
2. Edit your OAuth 2.0 Client ID
3. Add to **Authorized redirect URIs**:
   ```
   https://txhscptzjrrudnqwavcb.supabase.co/auth/v1/callback
   ```
4. Save and wait 5 minutes

### Issue 3: Can't logout from localhost

**Cause:** You updated Dashboard `site_url` to production, now local dev can't logout

**Solution:**
This is expected behavior. The fix:
- **Dashboard** stays set to production URL (correct)
- **Add localhost to Redirect URLs** in Dashboard (already done in Step 3)
- **Frontend code uses `window.location.origin`** (already correct in LoginPage.tsx)

The logout works because:
1. Supabase checks if redirect URL is in the allowed list
2. `http://localhost:5173` is in `additional_redirect_urls`
3. Frontend passes `redirectTo: window.location.origin` (dynamic)
4. Works in both localhost and production ✅

---

## Verification Checklist

After configuration:

- [ ] Supabase Dashboard `site_url` = `https://app.gofragents.com`
- [ ] All redirect URLs added to Dashboard (prod + localhost)
- [ ] Waited 5 minutes for propagation
- [ ] Cleared browser cache / tested in incognito
- [ ] OAuth login works on production
- [ ] OAuth logout works on production  
- [ ] OAuth login still works on localhost
- [ ] OAuth logout still works on localhost

---

## Key Takeaways

1. **`config.toml` is for local CLI only** - it does NOT affect production
2. **Dashboard settings control production** - always configure there
3. **Add both environments to redirect URLs** - allows testing locally
4. **`site_url` should be production domain** - this is the default redirect
5. **`additional_redirect_urls` allows other domains** - like localhost for dev

---

## Related Files

- `supabase/config.toml` - Local dev config (lines 37-45)
- `src/pages/LoginPage.tsx` - Google OAuth implementation
- `src/contexts/AuthContext.tsx` - Logout logic
- `docs/deployment/oauth-redirect-configuration.md` - Detailed OAuth guide

---

**Status:** ✅ RESOLVED  
**Last Updated:** October 23, 2025  
**Action Required:** Update Supabase Dashboard settings (5 minutes)

