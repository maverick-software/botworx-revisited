# Modal Reload Debugging Guide

This guide helps debug why modals keep reloading when users tab away and return.

## Debugging Steps

### 1. Enable Console Debugging

Several debug flags have been added to track modal behavior:

```typescript
// In IntegrationsPage.tsx
useModalSoftRefreshProtection(
  showSetupModal,
  closeModal,
  {
    allowedPaths: ['/integrations'],
    debug: true // ✅ This is now enabled
  }
);

// Document visibility tracking
const { isVisible } = useDocumentVisibility({ debug: true }); // ✅ Enabled
```

### 2. What to Look For

Open browser DevTools (F12) → Console tab, then:

1. **Open the Email Relay modal**
2. **Fill in some data** 
3. **Tab away** to another tab/window
4. **Tab back** to the integrations page
5. **Check console logs**

### 3. Key Console Messages

Look for these debug messages:

#### ✅ **Good Behavior (Modal State Preserved)**
```
[useDocumentVisibility] Visibility changed: { isVisible: false, visibilityState: "hidden" }
[SoftRefreshProtection] Window lost focus - state protected
[EmailRelaySetupModal] Modal opened or reloaded { hasFormData: true, formData: {...} }
[IntegrationsPage] Modal state changed: { showSetupModal: true, selectedIntegration: "Email Relay" }
```

#### ❌ **Bad Behavior (Modal State Lost)**
```
[SoftRefreshProtection] Path changed: { from: "/integrations", to: "/integrations" }
[SoftRefreshProtection] Triggering state reset due to navigation
[EmailRelaySetupModal] Form state cleaned up
[EmailRelaySetupModal] Modal opened or reloaded { hasFormData: false, formData: {} }
```

### 4. Common Causes and Solutions

#### **Cause 1: Layout Transition Effects**
```typescript
// ❌ PROBLEMATIC (Fixed)
useEffect(() => {
  setIsTransitioning(true);
  const timer = setTimeout(() => setIsTransitioning(false), 300);
  return () => clearTimeout(timer);
}, [location.pathname]); // Caused full UI re-render on tab switch
```

**✅ Solution Applied:**
- Disabled the transition effect in `Layout.tsx`
- No more full UI re-renders when tabbing

#### **Cause 2: Aggressive Location Listeners**
```typescript
// ❌ PROBLEMATIC (Fixed) 
useEffect(() => {
  setShowSetupModal(false);
  setSelectedIntegration(null);
}, [location.pathname, location.search, location.hash]); // Too aggressive!
```

**✅ Solution Applied:**
- Replaced with `useModalSoftRefreshProtection`
- Only closes modal when actually navigating away

#### **Cause 3: Modal Component Re-mounting**
```typescript
// ❌ PROBLEMATIC (Fixed)
const [formData, setFormData] = useState({ ... }); // Lost on re-mount
```

**✅ Solution Applied:**
- Using `useFormModalState` with persistence
- Form data survives tab switches

### 5. Testing Checklist

- [ ] Open Email Relay modal
- [ ] Fill in connection name, select SMTP
- [ ] Choose an SMTP preset (Gmail, Outlook, etc.)
- [ ] Fill in host, username, password
- [ ] Tab away to another browser tab
- [ ] Wait 2-3 seconds
- [ ] Tab back to integrations page
- [ ] **Verify:** All form data should still be there
- [ ] **Check console:** Should see "state protected" messages

### 6. If Issues Persist

If modals still reload after these fixes, check for:

1. **React Router Issues**
   - Check if router is causing unnecessary re-renders
   - Look for `Navigate` components triggering

2. **Auth Context Changes**
   - Supabase auth state changes on tab switch
   - Session refresh triggering re-renders

3. **Browser Extensions**
   - Ad blockers or other extensions interfering
   - Try in incognito mode

4. **Memory/Performance Issues**
   - Large forms causing React to re-mount
   - Too many event listeners

### 7. Advanced Debugging

Add this to any component suspected of causing issues:

```typescript
import { useEffect, useRef } from 'react';

// Debug component re-renders
const renderCount = useRef(0);
useEffect(() => {
  renderCount.current += 1;
  console.log(`[ComponentName] Render #${renderCount.current}`, {
    props: { /* relevant props */ },
    timestamp: new Date().toISOString()
  });
});

// Debug why useEffect runs
useEffect(() => {
  console.log('[ComponentName] useEffect triggered by dependencies:', {
    /* list dependency values */
  });
}, [/* dependencies */]);
```

### 8. Reporting Issues

If you find modals still reloading, include:

1. **Console logs** from the debug messages
2. **Steps to reproduce** the issue
3. **Browser and OS** information
4. **Which specific modal** is affected
5. **Any error messages** in the console

This will help identify any remaining causes of the soft refresh issue.
