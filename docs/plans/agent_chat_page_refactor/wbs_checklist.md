# AgentChatPage Refactor - WBS Checklist

**Date:** October 9, 2025  
**Goal:** Fix loading spinner and simplify conversation state management

---

## ✅ Pre-Refactor (COMPLETE)

- [x] Back up AgentChatPage.tsx
- [x] Archive investigation document
- [x] Create refactor plan
- [x] Create WBS checklist
- [x] Document current problems

---

## Phase 1: Define New State Machine

### 1.1 Create Type Definitions
- [ ] Define `ConversationLifecycle` discriminated union type
- [ ] Add JSDoc comments explaining each state
- [ ] Export type if needed in other components

### 1.2 Update State Declaration
- [ ] Replace `selectedConversationId` state
- [ ] Replace `isTemporaryConversation` state
- [ ] Replace `isCreatingNewConversation` state
- [ ] Remove `isCreatingNewConversationRef` ref
- [ ] Add single `conversationLifecycle` state

**Deliverables:**
- Clean type definition
- Single state variable replacing 4+ variables

---

## Phase 2: Refactor fetchHistory

### 2.1 Simplify Guards
- [ ] Remove complex conditional checks
- [ ] Add single guard: `if (lifecycle.status !== 'active') return`
- [ ] Remove all early returns that forget to clear loading

### 2.2 Fix Loading State
- [ ] Move `setIsHistoryLoading(true)` inside try block
- [ ] Add `finally` block with `setIsHistoryLoading(false)`
- [ ] Ensure loading ALWAYS clears

### 2.3 Update Dependencies
- [ ] Change dependency from `selectedConversationId` to `conversationLifecycle`
- [ ] Remove `isTemporaryConversation` from deps
- [ ] Remove `isCreatingNewConversation` from deps
- [ ] Keep `agentId`, `user?.id`, `conversationRefreshKey`

**Deliverables:**
- Simplified fetchHistory with guaranteed loading state cleanup
- Single, clear dependency array

---

## Phase 3: Refactor handleSubmit

### 3.1 Determine Message Type
- [ ] Check if `lifecycle.status === 'none'` (first message)
- [ ] Remove all temporary conversation logic

### 3.2 First Message Flow
- [ ] Generate new conversation ID
- [ ] Set lifecycle to `'creating'` status
- [ ] Send message with new ID
- [ ] After success, set lifecycle to `'active'`
- [ ] Update URL with conversation ID

### 3.3 Subsequent Messages
- [ ] Use existing ID from `lifecycle.id`
- [ ] Send message (no state changes)

**Deliverables:**
- Clear first vs. subsequent message logic
- No more temporary/creating flags

---

## Phase 4: Refactor URL Sync Effect

### 4.1 Simplify URL Parsing
- [ ] Get `conv` param from URL
- [ ] If present AND different from current → set lifecycle to 'active'
- [ ] If absent → set lifecycle to 'none'

### 4.2 Remove Premature ID Generation
- [ ] Remove code that generates temp IDs before sending
- [ ] Remove code that adds IDs to URL before sending
- [ ] Clean slate until user sends message

**Deliverables:**
- Simple URL sync logic
- No premature ID generation

---

## Phase 5: Update Render Logic

### 5.1 Update Loading Condition
- [ ] Check `isHistoryLoading` for spinner
- [ ] Ensure spinner only shows when actually loading history

### 5.2 Update Empty State
- [ ] Show starter screen when `lifecycle.status === 'none'`
- [ ] Don't show spinner for empty state

**Deliverables:**
- Clear render conditions
- No more stuck spinners

---

## Phase 6: Update Helper Functions

### 6.1 Update completeAIProcessing
- [ ] Remove `setIsCreatingNewConversation(false)`
- [ ] Remove ref clearing
- [ ] Update lifecycle state if needed

### 6.2 Update completeAIProcessingWithResponse
- [ ] Remove `setIsCreatingNewConversation(false)`
- [ ] Remove ref clearing
- [ ] Update lifecycle state if needed

### 6.3 Update startAIProcessing
- [ ] Verify no lifecycle state conflicts
- [ ] Keep indicator logic unchanged

**Deliverables:**
- Clean helper functions without old flags

---

## Phase 7: Cleanup

### 7.1 Remove Dead Code
- [ ] Delete unused imports
- [ ] Delete old flag declarations
- [ ] Delete commented code
- [ ] Clean up console.logs (keep essential ones)

### 7.2 Add Documentation
- [ ] Add comments explaining lifecycle states
- [ ] Document state transition flow
- [ ] Update any related docs

**Deliverables:**
- Clean, documented code
- No dead code

---

## Phase 8: Testing

### 8.1 Manual Testing
- [ ] Test: Open chat → no spinner, clean slate
- [ ] Test: Send first message → status indicator shows
- [ ] Test: First message completes → no stuck spinner
- [ ] Test: Send second message → works normally
- [ ] Test: Click existing chat → loads history
- [ ] Test: Switch between chats → history loads
- [ ] Test: Refresh page → maintains conversation
- [ ] Test: Click "New Chat" → returns to clean slate

### 8.2 Edge Cases
- [ ] Test: Cancel first message mid-send
- [ ] Test: Network error on first message
- [ ] Test: Multiple rapid messages
- [ ] Test: Real-time updates work correctly

### 8.3 Browser Testing
- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Edge

**Deliverables:**
- All test cases pass
- No regressions

---

## Phase 9: Deployment

### 9.1 Pre-Deploy
- [ ] Review all changes
- [ ] Ensure backup is accessible
- [ ] Document rollback procedure

### 9.2 Deploy
- [ ] Commit changes
- [ ] Deploy to production
- [ ] Monitor for errors

### 9.3 Post-Deploy
- [ ] Verify in production
- [ ] Monitor user reports
- [ ] Performance check

**Deliverables:**
- Successful deployment
- No critical issues

---

## Success Criteria

✅ **Primary Goal:** Loading spinner never gets stuck  
✅ **Secondary Goal:** Code is significantly simpler  
✅ **Tertiary Goal:** All existing functionality preserved  

---

## Rollback Plan

If critical issues:
1. Restore from backup: `AgentChatPage.tsx.backup_YYYYMMDD_HHMMSS`
2. Commit rollback
3. Deploy immediately
4. Review what went wrong
5. Update refactor plan

---

## Notes

- Focus on ONE phase at a time
- Test after each phase
- Keep git commits small and focused
- Can pause/resume at any phase boundary

