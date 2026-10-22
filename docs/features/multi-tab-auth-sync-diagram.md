# Multi-Tab Auth Sync - Visual Flow Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser Window                                │
├─────────────┬─────────────┬─────────────┬─────────────────────────┤
│   Tab 1     │   Tab 2     │   Tab 3     │   Tab 4                 │
│  (Active)   │ (Background)│ (Background)│ (Background)            │
└─────┬───────┴──────┬──────┴──────┬──────┴──────┬──────────────────┘
      │              │             │             │
      │  ┌───────────┴─────────────┴─────────────┴────────────┐
      │  │        BroadcastChannel                             │
      │  │        "agentopia-auth-sync"                        │
      │  │  (Real-time cross-tab messaging)                    │
      │  └───────────┬─────────────┬─────────────┬────────────┘
      │              │             │             │
      │  ┌───────────┴─────────────┴─────────────┴────────────┐
      │  │        localStorage                                 │
      │  │        "agentopia-auth-event"                       │
      │  │  (Fallback + Backup method)                         │
      │  └───────────┬─────────────┬─────────────┬────────────┘
      │              │             │             │
      └──────────────┴─────────────┴─────────────┴─────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │   Supabase Auth      │
          │   (Server-side)      │
          └──────────────────────┘
```

## Logout Event Flow

```
Step 1: User clicks logout in Tab 1
─────────────────────────────────────────────────────────────────

┌─────────────┐
│   Tab 1     │  User Action: Click "Log out"
│  [ACTIVE]   │
└─────┬───────┘
      │
      ▼
┌─────────────────────────────────────────┐
│  AuthContext.signOut()                  │
│  1. supabase.auth.signOut()             │
│  2. authSync.broadcast('LOGOUT')        │
│  3. setUser(null)                       │
└─────┬───────────────────────────────────┘
      │
      ├──────────────────┬──────────────────┬──────────────────┐
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
┌───────────┐      ┌───────────┐      ┌───────────┐      ┌───────────┐
│ Tab 2     │      │ Tab 3     │      │ Tab 4     │      │ Tab N     │
│ Receives  │      │ Receives  │      │ Receives  │      │ Receives  │
│ LOGOUT    │      │ LOGOUT    │      │ LOGOUT    │      │ LOGOUT    │
│ event     │      │ event     │      │ event     │      │ event     │
└─────┬─────┘      └─────┬─────┘      └─────┬─────┘      └─────┬─────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────────────┐
│  All tabs execute:                                               │
│  1. setUser(null)                                                │
│  2. setUserRoles([])                                             │
│  3. window.location.href = '/login'                              │
└──────────────────────────────────────────────────────────────────┘

Result: All tabs now on login page ✅
```

## Login Event Flow

```
Step 1: User logs in via Tab 2
─────────────────────────────────────────────────────────────────

┌─────────────┐
│   Tab 2     │  User Action: Submit login form
│  [ACTIVE]   │
└─────┬───────┘
      │
      ▼
┌─────────────────────────────────────────┐
│  AuthContext.signIn()                   │
│  1. supabase.auth.signInWithPassword()  │
│  2. authSync.broadcast('LOGIN')         │
│  3. setUser(userData)                   │
└─────┬───────────────────────────────────┘
      │
      ├──────────────────┬──────────────────┬──────────────────┐
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
┌───────────┐      ┌───────────┐      ┌───────────┐      ┌───────────┐
│ Tab 1     │      │ Tab 3     │      │ Tab 4     │      │ Tab N     │
│ Receives  │      │ Receives  │      │ Receives  │      │ Receives  │
│ LOGIN     │      │ LOGIN     │      │ LOGIN     │      │ LOGIN     │
│ event     │      │ event     │      │ event     │      │ event     │
└─────┬─────┘      └─────┬─────┘      └─────┬─────┘      └─────┬─────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────────────┐
│  All tabs execute:                                               │
│  1. supabase.auth.getSession()                                   │
│  2. setUser(session.user)                                        │
│  3. UI updates to authenticated state                            │
└──────────────────────────────────────────────────────────────────┘

Result: All tabs show logged-in state ✅
```

## Communication Methods (Layered)

```
┌──────────────────────────────────────────────────────────────┐
│  Primary Method: BroadcastChannel                            │
│  ✓ Instant real-time messaging                               │
│  ✓ No storage overhead                                       │
│  ✓ Supported in Chrome 54+, Firefox 38+, Safari 15.4+       │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   │ If not available, fallback to:
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  Fallback Method: localStorage Events                        │
│  ✓ Works in all browsers                                     │
│  ✓ storage event fires on key changes                        │
│  ✓ Slightly higher latency (~50-100ms)                       │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   │ Plus additional monitoring:
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  Additional Layer: Supabase Storage Detection                │
│  ✓ Monitors "sb-*-auth-token" localStorage keys              │
│  ✓ Catches Supabase's native session changes                 │
│  ✓ Acts as safety net                                        │
└──────────────────────────────────────────────────────────────┘
```

## Event Timeline (Logout Example)

```
Time    Tab 1 (Initiator)              Tab 2 (Listener)
─────────────────────────────────────────────────────────────────
0ms     User clicks logout              [Idle - showing app]
        ↓
10ms    Call signOut()                  [Still showing app]
        ↓
15ms    supabase.auth.signOut()         [Still showing app]
        └─ Removes session from         [Still showing app]
           localStorage
        ↓
20ms    authSync.broadcast('LOGOUT')    [Still showing app]
        ├─ BroadcastChannel.postMessage()
        └─ localStorage.setItem()
        ↓
21ms    [Logged out]                    Receives BroadcastChannel msg ✅
        ↓                               ↓
22ms    [Shows login page]              storage event fires ✅
                                        ↓
25ms                                    AuthContext listener called
                                        ↓
30ms                                    setUser(null)
                                        ↓
35ms                                    window.location.href = '/login'
                                        ↓
50ms                                    [Shows login page] ✅

Total sync time: ~30-50ms ⚡
```

## Security Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    Same Origin Only                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Tab 1      │  │   Tab 2      │  │   Tab 3      │     │
│  │ agentopia.io │  │ agentopia.io │  │ agentopia.io │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │              │
│         └─────────────────┴─────────────────┘              │
│                    Can communicate ✅                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Different Origin - BLOCKED                      │
│                                                              │
│  ┌──────────────┐            ┌──────────────┐              │
│  │   Tab 1      │    ✗✗✗    │   Tab 2      │              │
│  │ agentopia.io │            │ malicious.io │              │
│  └──────────────┘            └──────────────┘              │
│                                                              │
│          Cannot communicate ❌                               │
│          (Browser security prevents this)                   │
└─────────────────────────────────────────────────────────────┘
```

## Code Locations

```
src/
├── lib/
│   └── auth-sync.ts                    ← Core sync utility
│       ├── AuthSyncManager class
│       ├── BroadcastChannel setup
│       ├── localStorage event handling
│       └── Supabase storage monitoring
│
├── contexts/
│   └── AuthContext.tsx                 ← Integration layer
│       ├── useEffect: Multi-tab listener
│       ├── signIn: Broadcast LOGIN
│       ├── signUp: Broadcast LOGIN
│       └── signOut: Broadcast LOGOUT
│
└── components/modals/
    └── LogoutConfirmDialog.tsx         ← User-facing UI
        └── Calls signOut() on confirm
```

## Error Handling Flow

```
Scenario: BroadcastChannel fails
────────────────────────────────────────────────────────────

┌────────────────────────────┐
│ Try: new BroadcastChannel  │
└───────────┬────────────────┘
            │
            ├─── Success ──→ Use BroadcastChannel ✅
            │
            └─── Failure ──→ Log warning
                              ↓
                         Use localStorage only ✅
                              ↓
                         Still works! 🎉
```

## Browser Compatibility Matrix

```
Browser          BroadcastChannel    localStorage    Result
─────────────────────────────────────────────────────────────
Chrome 54+              ✅               ✅          ⚡ Fast
Firefox 38+             ✅               ✅          ⚡ Fast
Safari 15.4+            ✅               ✅          ⚡ Fast
Edge 79+                ✅               ✅          ⚡ Fast
Safari < 15.4           ❌               ✅          ✓ Works
IE 11                   ❌               ✅          ✓ Works
```

---

**Legend:**
- ✅ Fully supported
- ⚡ Optimal performance
- ✓ Works with fallback
- ❌ Not available
- ✗ Security blocked

