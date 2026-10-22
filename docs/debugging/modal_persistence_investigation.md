# Modal Persistence Investigation

## Current Issue
When users tab away from the browser and return, modal input fields lose their data. The modal appears to be remounting/resetting.

## Debugging Setup

### 1. Added TestPersistentModal Component
- Created a test modal to isolate the issue
- Tracks render counts, input state, and lifecycle events
- Monitors visibility change events explicitly

### 2. Added Comprehensive Logging
- IntegrationsPage lifecycle (mount/unmount)
- IntegrationSetupModal lifecycle and Dialog events
- GmailSetupModal lifecycle and state changes
- Document visibility changes

### 3. Disabled Potential Culprits
- ❌ Commented out `useModalSoftRefreshProtection` hook - wasn't the issue
- ❌ Disabled Layout transition effects - already commented out
- ✅ Removed `if (!isOpen) return null` from all modal components - partial fix

## Key Findings

### Finding 1: Component Self-Destruction Pattern
All modal components had this pattern that destroyed them when `isOpen=false`:
```tsx
if (!isOpen) return null; // ❌ Destroys entire component!
```

**Solution Applied:** Removed this pattern from all modal components. Let the Dialog handle visibility.

### Finding 2: Dialog Component Behavior
The Radix UI Dialog component (`@radix-ui/react-dialog`) might unmount its content when:
- `open` prop changes from `true` to `false`
- Window loses focus (needs verification)

### Finding 3: State Management Issue
When tabbing away:
1. Something triggers `showSetupModal` to become `false`
2. Dialog closes (or hides)
3. Component unmounts (or state resets)
4. User tabs back
5. Modal reopens but with fresh state

## Test Procedure

### Using Test Modal:
1. Click "Test Modal Persistence" button
2. Type text in the input field
3. Tab away to another browser tab
4. Wait 5-10 seconds
5. Tab back
6. Check if:
   - Input text is preserved
   - Render count increments
   - Console shows lifecycle events

### Console Output to Watch:
```javascript
// Good behavior (state preserved):
[TestPersistentModal] Window lost focus { inputValue: "test", isOpen: true }
[TestPersistentModal] Window gained focus { inputValue: "test", isOpen: true }
// Render count should NOT reset

// Bad behavior (state lost):
[TestPersistentModal] Component unmounting!!!
[TestPersistentModal] Component mounted { renderCount: 1 }
// Input value is empty, render count resets
```

## Potential Root Causes

### 1. Dialog Auto-Close on Focus Loss
Radix Dialog might have built-in behavior to close when:
- Document becomes hidden
- Window loses focus
- User clicks outside (already handled)

### 2. State Management in Parent
IntegrationsPage might be:
- Resetting `showSetupModal` state
- Re-rendering and losing modal reference
- Being unmounted by router

### 3. Auth/Context Provider Issues
Higher-level providers might be:
- Triggering re-renders on visibility change
- Resetting state on auth refresh
- Causing full app re-render

## Next Steps to Try

### Option 1: Force Dialog to Stay Mounted
```tsx
// Try adding these props to Dialog:
<Dialog 
  open={isOpen}
  modal={false} // Prevent modal behavior
  // Or try a custom portal that persists
>
```

### Option 2: State Persistence Outside Component
```tsx
// Move form state to a higher level that won't unmount
const formStateRef = useRef({});
// Or use sessionStorage/localStorage
```

### Option 3: Prevent Dialog Close on Visibility Change
```tsx
// Override onOpenChange to ignore certain triggers
onOpenChange={(open, event) => {
  // Only close on explicit user action
  if (userTriggered) {
    setShowModal(open);
  }
}}
```

### Option 4: Custom Dialog Implementation
Replace Radix Dialog with a custom implementation that:
- Never unmounts content
- Uses CSS visibility instead of conditional rendering
- Preserves all internal state

## Testing Commands

```bash
# Watch console in browser DevTools
# Filter by: [TestPersistentModal], [IntegrationsPage], [Dialog]

# Key events to monitor:
- Component mounted/unmounting
- Window focus/blur
- Document visibilitychange
- Dialog onOpenChange
- Input value changes
```

## Current Status
- ✅ Removed component self-destruction pattern
- ✅ Added comprehensive debugging
- ✅ Created test modal for isolation
- 🔄 Testing Dialog behavior with visibility changes
- ⏳ Need to identify what triggers `showSetupModal=false`
