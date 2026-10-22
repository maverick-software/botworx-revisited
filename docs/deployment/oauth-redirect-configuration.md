# OAuth Redirect Configuration for Production

## Problem

When logging in with Google OAuth from `https://app.gofragents.com`, users are being redirected to `http://localhost:5173` after authentication.

## Root Cause

The `site_url` in `supabase/config.toml` was hardcoded to `http://localhost:3000` (and needs to be updated to `http://localhost:5173` for dev). This setting controls where Supabase redirects users after OAuth authentication.

## Solution

### 1. Local `config.toml` (Development ONLY)

**File:** `supabase/config.toml`

⚠️ **IMPORTANT**: This file is ONLY used for local Supabase CLI. It does NOT affect your hosted Supabase instance.

```toml
[auth]
enabled = true
# Local development only - does NOT affect production
site_url = "http://localhost:5173"
# Add production URL here so it shows in dropdown when using local CLI
additional_redirect_urls = ["https://app.gofragents.com"]
jwt_expiry = 3600
enable_refresh_token_rotation = true
```

**For hosted Supabase (production)**, you MUST configure these in the Dashboard (see Step 2).

### 2. Supabase Dashboard (Production)

You **MUST** also update these settings in your Supabase Dashboard for production:

1. **Go to:** Supabase Dashboard → Your Project → Authentication → URL Configuration

2. **Update the following fields:**

   **Site URL:**
   ```
   https://app.gofragents.com
   ```

   **Redirect URLs (add all of these):**
   ```
   https://app.gofragents.com
   https://app.gofragents.com/
   https://app.gofragents.com/**
   http://localhost:5173
   http://localhost:5173/
   http://localhost:5173/**
   ```

3. **Click "Save"**

### 3. Google Cloud Console (OAuth Credentials)

**File:** Google Cloud Console → APIs & Services → Credentials → Your OAuth 2.0 Client

**Authorized JavaScript origins:**
```
https://app.gofragents.com
http://localhost:5173
```

**Authorized redirect URIs:**
```
https://app.gofragents.com
https://app.gofragents.com/
https://txhscptzjrrudnqwavcb.supabase.co/auth/v1/callback
http://localhost:5173
http://localhost:5173/
```

---

## How OAuth Redirects Work

### Current Flow (Before Fix):

```
1. User visits: https://app.gofragents.com
2. Clicks "Continue with Google"
3. Redirected to Google OAuth
4. User authenticates
5. Google redirects to Supabase: https://txhscptzjrrudnqwavcb.supabase.co/auth/v1/callback
6. Supabase uses site_url to redirect: http://localhost:3000 ❌ (WRONG!)
7. User lands on localhost (doesn't work in production)
```

### Fixed Flow (After Configuration):

```
1. User visits: https://app.gofragents.com
2. Clicks "Continue with Google"
3. Redirected to Google OAuth
4. User authenticates
5. Google redirects to Supabase: https://txhscptzjrrudnqwavcb.supabase.co/auth/v1/callback
6. Supabase uses site_url to redirect: https://app.gofragents.com ✅
7. User lands back on the app (correct!)
```

---

## Code Reference

The frontend correctly uses `window.location.origin`:

**File:** `src/pages/LoginPage.tsx` (Lines 116-121)
```typescript
const handleGoogleLogin = async () => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,  // ✅ This is correct!
      }
    });
    if (error) throw error;
  } catch (err: any) {
    console.error('Google login error:', err);
  }
};
```

This means the frontend is trying to tell Supabase to redirect back to the current origin, but Supabase overrides it with the `site_url` from the config.

---

## Environment-Specific Configuration

### Development (`localhost:5173`)
```toml
[auth]
site_url = "http://localhost:5173"
additional_redirect_urls = ["https://app.gofragents.com"]
```

### Production (`app.gofragents.com`)
**Set in Supabase Dashboard:**
- Site URL: `https://app.gofragents.com`
- Additional Redirect URLs: `http://localhost:5173, http://localhost:5173/**`

---

## Testing

### 1. Development Testing
```bash
# Start dev server
npm run dev

# Visit http://localhost:5173
# Click "Continue with Google"
# Should redirect back to http://localhost:5173 after auth ✅
```

### 2. Production Testing
```bash
# Visit https://app.gofragents.com
# Click "Continue with Google"
# Should redirect back to https://app.gofragents.com after auth ✅
```

---

## Troubleshooting

### Issue: Still redirecting to localhost in production

**Solution:**
1. Verify Supabase Dashboard settings (they override config.toml)
2. Clear browser cookies and localStorage
3. Try in incognito mode
4. Check browser console for redirect URLs

### Issue: "redirect_uri_mismatch" error

**Solution:**
1. Copy the exact redirect URI from the error message
2. Add it to Google Cloud Console → Authorized redirect URIs
3. Make sure there's no trailing slash mismatch

### Issue: "Invalid redirect URL" from Supabase

**Solution:**
1. Check that the URL is in `additional_redirect_urls` in Supabase Dashboard
2. Supabase requires exact matches (including trailing slashes)
3. Add both with and without trailing slash

---

## Deployment Checklist

When deploying to production:

- [ ] Update Supabase Dashboard → Authentication → Site URL to `https://app.gofragents.com`
- [ ] Add all redirect URLs in Supabase Dashboard
- [ ] Update Google OAuth credentials with production URLs
- [ ] Test OAuth login in production
- [ ] Clear browser cache and test in incognito
- [ ] Monitor Supabase logs for any redirect issues

---

## Related Files

- `supabase/config.toml` - Local development config (lines 37-45)
- `src/pages/LoginPage.tsx` - Google OAuth implementation (lines 116-121)
- `src/lib/supabase.ts` - Supabase client configuration

---

## Important Notes

1. **`config.toml` is for local development only** - Production settings MUST be configured in the Supabase Dashboard
2. **`site_url`** is the primary redirect destination after OAuth
3. **`additional_redirect_urls`** allows other domains (useful for dev/staging)
4. **Google OAuth credentials** must include the Supabase callback URL
5. **Always test OAuth** in both dev and production after changes

---

**Last Updated:** October 23, 2025  
**Issue Status:** 🔧 FIXED  
**Production Status:** ⚠️ REQUIRES DASHBOARD UPDATE

