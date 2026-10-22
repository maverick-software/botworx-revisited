# Signup Flow Fixes - November 2025

## Problems Identified

### 1. **422 Error on Email Check** ❌
```
POST /auth/v1/otp 422 (Unprocessable Content)
```
**Cause:** Using `signInWithOtp` with `shouldCreateUser: false` to check user existence - this is not a supported use case for the OTP endpoint.

### 2. **500 Error on Signup** ❌
```
POST /auth/v1/signup 500 (Internal Server Error)
AuthApiError: Database error saving new user
```
**Cause:** The `handle_new_user()` trigger was trying to insert `full_name` into the profiles table, but the table schema has `first_name` and `last_name` columns instead.

---

## Solutions Implemented

### Fix #1: Remove OTP Email Check ✅

**Problem:** Supabase doesn't expose user existence for security reasons, and the OTP endpoint isn't designed for user existence checks.

**Solution:** Simplified the flow:
- Email submission now goes directly to the password screen
- Added "Don't have an account? Sign up" link on the password screen
- User can switch to signup flow if needed

**File:** `src/pages/LoginPage.tsx`

**Changes:**
```typescript
// BEFORE (Broken - caused 422 error)
const { error: otpError } = await supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: false }
});

// AFTER (Works - simple and secure)
const handleEmailSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setCheckingEmail(true);
  clearError();
  
  // Default to login flow with option to switch to signup
  console.log('[LoginPage] Email submitted:', email);
  setIsExistingUser(true);
  setStep('password');
  setCheckingEmail(false);
};
```

**Added UI Element:**
```typescript
<div className="text-sm text-gray-400">
  Don't have an account?{' '}
  <button
    type="button"
    onClick={() => {
      setIsExistingUser(false);
      setStep('name');
    }}
    className="text-white hover:underline font-medium"
  >
    Sign up
  </button>
</div>
```

---

### Fix #2: Update Database Trigger ✅

**Problem:** The `handle_new_user()` trigger function was inserting into a non-existent `full_name` column.

**Database Schema (Actual):**
```sql
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  first_name text NULL,    -- ✅ These exist
  last_name text NULL,     -- ✅ These exist
  -- ... other columns
);
```

**Trigger Function (Before - Broken):**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, created_at, updated_at)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),  -- ❌ Wrong
        NOW(), 
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Trigger Function (After - Fixed):**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        first_name,  -- ✅ Correct columns
        last_name,   -- ✅ Correct columns
        created_at, 
        updated_at
    )
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'first_name', NULL),  -- ✅ Correct metadata
        COALESCE(NEW.raw_user_meta_data->>'last_name', NULL),   -- ✅ Correct metadata
        NOW(), 
        NOW()
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Don't fail user creation if profile creation fails
        RAISE WARNING 'Failed to create profile for user %: % - %', NEW.id, SQLSTATE, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Applied via:** Direct SQL execution to remote database (migration history was out of sync)

---

## User Flow After Fixes

### New User Signup Path:
```
1. Enter email → Click "Login or Sign up"
   ↓
2. See password screen with "Don't have an account? Sign up" link
   ↓
3. Click "Sign up" → Name collection screen
   ↓
4. Enter first & last name → Click "Continue"
   ↓
5. Create password screen with validation rules
   ↓
6. Password matches requirements → Click "Continue"
   ↓
7. ✅ Account created!
   - auth.users entry created
   - profiles entry created with first_name and last_name
   - User logged in and redirected
```

### Existing User Login Path:
```
1. Enter email → Click "Login or Sign up"
   ↓
2. See password screen
   ↓
3. Enter password → Click "Log in"
   ↓
4. ✅ Logged in!
```

---

## Related Fixes from Previous Session

### Fix #3: Logout "Auth session missing" Error ✅

Also fixed in this session: Logout was failing with 403 error when session was stale.

**Solution:** Made logout always succeed locally even if server rejects:
- Ignore "Auth session missing" errors
- Always clear local state and localStorage
- Always broadcast to other tabs
- Never block logout process

**File:** `src/contexts/AuthContext.tsx` (lines 309-353)

See: `docs/fixes/logout-403-auth-session-missing.md`

---

## Testing Checklist

### Test Case 1: New User Signup ✅
1. Go to login page
2. Enter new email → Click "Login or Sign up"
3. Click "Don't have an account? Sign up"
4. Enter first name: "John"
5. Enter last name: "Doe"
6. Click "Continue"
7. Enter password meeting requirements
8. Confirm password (must match)
9. Click "Continue"
10. **Expected:** User created successfully, logged in, redirected to home

### Test Case 2: Existing User Login ✅
1. Go to login page
2. Enter existing email → Click "Login or Sign up"
3. Enter password
4. Click "Log in"
5. **Expected:** Logged in successfully, redirected to home

### Test Case 3: Logout ✅
1. Log in
2. Click account menu → "Log out"
3. Confirm in modal
4. **Expected:** Logged out successfully, even if session is stale

---

## Console Output (Expected)

### During Signup:
```
[LoginPage] Email submitted: user@example.com
[AuthContext] User <uuid> signed up. Creating profile...
[AuthContext] Profile created for user <uuid>
[AuthContext] Broadcasting LOGIN event to other tabs
[AuthSync] Broadcasting: {type: 'LOGIN', userId: '<uuid>', timestamp: ...}
```

### During Login:
```
[LoginPage] Email submitted: user@example.com
[AuthContext] User signed in: <uuid>
[AuthContext] Broadcasting LOGIN event to other tabs
[AuthSync] Broadcasting: {type: 'LOGIN', userId: '<uuid>', timestamp: ...}
```

### During Logout:
```
[AuthContext] Broadcasting LOGOUT event to other tabs
[AuthContext] Cleared auth tokens from localStorage
[AuthSync] Broadcasting: {type: 'LOGOUT', timestamp: ...}
```

---

## Files Changed

1. **`src/pages/LoginPage.tsx`**
   - Simplified email check (removed broken OTP approach)
   - Added "Sign up" link on password screen
   - Improved error handling

2. **`src/contexts/AuthContext.tsx`**
   - Fixed logout to handle stale sessions gracefully
   - Added comprehensive local state cleanup
   - Improved multi-tab synchronization

3. **Database: `handle_new_user()` trigger**
   - Fixed to use `first_name` and `last_name` instead of `full_name`
   - Matches actual profiles table schema
   - Added error handling to not fail user creation

4. **`supabase/migrations/20250103000000_fix_new_user_trigger_for_names.sql`**
   - Created migration file (for version control)
   - Applied directly via SQL due to migration history mismatch

---

## Why These Errors Occurred

### Root Cause Analysis:

1. **OTP Error:** Attempted to use an authentication endpoint for a purpose it wasn't designed for (user existence check). Supabase intentionally doesn't expose user existence for security reasons (prevents email enumeration attacks).

2. **Signup Error:** Database schema evolved (`full_name` → `first_name` + `last_name`) but the trigger function wasn't updated to match. This is a common issue when refactoring database schemas.

3. **Logout Error:** Session expiration is normal, but the app was treating it as a critical failure instead of gracefully handling it.

---

## Security Considerations

✅ **Email Enumeration Prevention:**
- Not exposing whether email exists or not
- Generic "Invalid login credentials" error for both wrong password and non-existent user
- User must explicitly choose "Sign up" if they don't have an account

✅ **Password Security:**
- Real-time validation with visual feedback
- Requirements: min 8 chars, uppercase, lowercase, number, special char
- Password visibility toggle for better UX
- Confirmation required (must match)

✅ **Session Management:**
- Graceful handling of stale sessions
- Multi-tab synchronization
- Complete local cleanup on logout
- No hardcoded redirects (environment-aware)

---

## Status

**All Issues Fixed:** ✅  
**Date:** November 3, 2025  
**Impact:** High - affects all new user signups and logins  
**User-Facing:** Signup and login now work correctly  
**Multi-Tab Auth:** Working correctly

---

## Next Steps (If Needed)

1. **Password Reset Flow:**
   - Currently has "Forgot password?" button but no implementation
   - Should use `supabase.auth.resetPasswordForEmail()`

2. **Email Verification:**
   - Consider enabling email verification in Supabase dashboard
   - Add confirmation email flow

3. **Social Login:**
   - Google OAuth is implemented ✅
   - Could add more providers (Apple, Microsoft, GitHub, etc.)

4. **Migration History:**
   - Clean up migration history mismatch
   - Ensure local and remote migrations are in sync
   - Consider using `supabase migration repair` if needed

