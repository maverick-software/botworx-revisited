# Chat Message Structure Fix - 2025-10-13

## Issue Description
Chat message history was losing its structure during error conditions. When errors occurred, thinking messages would remain in the messages array but be hidden, causing:
- Invisible gaps in the message structure
- React reconciliation issues with unstable keys
- Broken UI after errors (requires refresh to fix)

## Root Causes

### 1. Thinking Messages Not Removed on Error
**File:** `src/hooks/chat/useAIProcessing.ts`

When `completeAIProcessing(false)` was called on error:
```typescript
// BEFORE - BAD
const completeAIProcessing = useCallback((success: boolean = true) => {
  setAiState(success ? 'completed' : 'failed');
  setProcessSteps(prev => prev.map(step => ({ ...step, completed: true })));
  
  setTimeout(() => {
    setAiState(null);
    setCurrentTool(null);
    setThinkingMessageIndex(null);
  }, 500);
}, []);
```

**Problem:** The thinking message stayed in the array with `isCompleted: false`, creating a hidden orphan message.

### 2. Unstable React Keys from Filtering
**File:** `src/components/chat/MessageComponents.tsx`

```typescript
// BEFORE - BAD
{messages.map((message, index) => {
  if (message.role === 'thinking') {
    const isCurrentThinking = index === thinkingMessageIndex && !message.metadata?.isCompleted;
    if (!isCurrentThinking) {
      return null; // ❌ Creates gaps in rendered elements
    }
    return <InlineThinkingIndicator key={`thinking-${index}`} ... />
  }
  return <div key={`${message.role}-${index}-...`} ... />
})}
```

**Problems:**
- Returning `null` inside map creates invisible elements
- Keys based on `index` become unstable when messages appear/disappear
- React can't properly reconcile the component tree

### 3. Missing Message Cleanup Parameter
**File:** `src/pages/AgentChatPage.tsx`

```typescript
// BEFORE - BAD
catch (err: any) {
  aiHook.completeAIProcessing(false); // No way to clean up messages
}
```

**Problem:** Error handler couldn't remove the thinking message from the array.

## Solutions Applied

### Fix 1: Remove Thinking Messages on Error
**File:** `src/hooks/chat/useAIProcessing.ts`

```typescript
// AFTER - GOOD
const completeAIProcessing = useCallback((
  success: boolean = true, 
  setMessages?: React.Dispatch<React.SetStateAction<Message[]>>
) => {
  setAiState(success ? 'completed' : 'failed');
  setProcessSteps(prev => prev.map(step => ({ ...step, completed: true })));
  
  // ✅ If failed and setMessages provided, remove the thinking message
  if (!success && setMessages) {
    setMessages(prev => prev.filter(msg => 
      !(msg.role === 'thinking' && !msg.metadata?.isCompleted)
    ));
  }
  
  setTimeout(() => {
    setAiState(null);
    setCurrentTool(null);
    setThinkingMessageIndex(null);
  }, 500);
}, []);
```

**Benefits:**
- Thinking messages are properly removed on error
- No orphaned messages in the array
- Clean state after errors

### Fix 2: Filter Before Mapping
**File:** `src/components/chat/MessageComponents.tsx`

```typescript
// AFTER - GOOD
// ✅ Filter out completed/stale thinking messages before rendering
const displayMessages = messages.filter((message, index) => {
  if (message.role === 'thinking') {
    // Only show the thinking message if it's the current active one
    return index === thinkingMessageIndex && !message.metadata?.isCompleted;
  }
  return true; // Show all non-thinking messages
});

return (
  <div className="space-y-4">
    {displayMessages.map((message, index) => {
      if (message.role === 'thinking') {
        return (
          <InlineThinkingIndicator
            key={`thinking-${message.timestamp?.getTime() || index}`}
            ...
          />
        );
      }
      return <div key={...} ... />
    })}
  </div>
);
```

**Benefits:**
- No `null` returns in map
- Stable array structure for React
- Better keys using timestamps
- Cleaner rendering logic

### Fix 3: Pass setMessages to Error Handler
**File:** `src/pages/AgentChatPage.tsx`

```typescript
// AFTER - GOOD
catch (err: any) {
  if (err.name === 'AbortError') {
    console.log('[handleSubmit] Chat request cancelled.');
    aiHook.completeAIProcessing(false, messageHook.setMessages); // ✅ Pass setMessages
  } else {
    console.error('Error submitting chat message:', err);
    aiHook.completeAIProcessing(false, messageHook.setMessages); // ✅ Pass setMessages
    // ... error message handling
  }
}
```

**Benefits:**
- Error handler can clean up thinking messages
- Consistent state management
- No orphaned UI elements

## Testing

### Before Fix
1. Send a message to agent
2. Simulate/trigger an error (e.g., network failure)
3. **Result:** Thinking indicator disappears but message structure is broken
4. Send another message
5. **Result:** UI shows gaps, messages may overlap or be misaligned
6. Refresh page
7. **Result:** Chat loads correctly (because DB doesn't have thinking messages)

### After Fix
1. Send a message to agent
2. Simulate/trigger an error
3. **Result:** ✅ Thinking message cleanly removed, error message shown
4. Send another message
5. **Result:** ✅ Chat continues normally, no structure issues
6. No refresh needed

## Related Issues Fixed
- Avatar loading error (separate fix in `InlineThinkingIndicator.tsx`)
- Media library URL resolution with `useMediaLibraryUrl` hook

## Files Modified
1. `src/hooks/chat/useAIProcessing.ts` - Enhanced `completeAIProcessing` with message cleanup
2. `src/pages/AgentChatPage.tsx` - Updated error handlers to pass `setMessages`
3. `src/components/chat/MessageComponents.tsx` - Pre-filter messages for stable rendering
4. `src/components/InlineThinkingIndicator.tsx` - Added `useMediaLibraryUrl` for avatar resolution

## Impact
- ✅ Chat structure remains stable during errors
- ✅ No invisible orphaned messages
- ✅ Better React reconciliation with stable keys
- ✅ No refresh required after errors
- ✅ Improved user experience

