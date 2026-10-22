# AgentChatPage Refactor Documentation

**Status:** 🔴 **READY TO START**  
**Created:** October 9, 2025  
**Priority:** HIGH (Blocking bug - stuck loading spinner)

---

## 📁 Documentation Structure

```
docs/plans/agent_chat_page_refactor/
├── README.md                 ← You are here
├── refactor_plan.md          ← Detailed refactor strategy
└── wbs_checklist.md          ← Phase-by-phase checklist
```

---

## 🎯 Quick Summary

### **The Problem**
Loading spinner gets stuck after sending the first message in a new conversation.

### **Root Cause**
- Over-complicated state management with 7+ state variables
- Race conditions between state updates and effects
- `isHistoryLoading` set to `true` but not always cleared
- Multiple early returns in `fetchHistory` without cleanup

### **The Solution**
Replace complex multi-flag system with a simple state machine:
```typescript
type ConversationLifecycle = 
  | { status: 'none' }                    // Clean slate
  | { status: 'creating', tempId: string} // Sending first message
  | { status: 'active', id: string }      // Active conversation
```

---

## 📚 How to Use This Documentation

### **If you're implementing the refactor:**
1. Read `refactor_plan.md` for overall strategy
2. Follow `wbs_checklist.md` phase by phase
3. Check off items as you complete them
4. Test after each phase

### **If you're reviewing the refactor:**
1. Read `refactor_plan.md` for context
2. Use `wbs_checklist.md` to verify completeness
3. Review test cases in Phase 8

### **If there's a problem:**
1. Check `wbs_checklist.md` for rollback procedure
2. Restore from backup: `src/pages/AgentChatPage.tsx.backup_YYYYMMDD_HHMMSS`
3. Review what went wrong before retrying

---

## 🔄 Current Status

### **Completed**
- ✅ Backed up original file
- ✅ Archived investigation document
- ✅ Created refactor plan
- ✅ Created WBS checklist

### **Next Steps**
- ⏳ Phase 1: Define new state machine
- ⏳ Phase 2: Refactor fetchHistory
- ⏳ Phase 3: Refactor handleSubmit
- ...continuing through Phase 9

---

## 🚨 Important Notes

### **DO NOT**
- ❌ Skip phases
- ❌ Test multiple phases at once
- ❌ Delete the backup file
- ❌ Deploy without testing

### **DO**
- ✅ Follow phases in order
- ✅ Test after each phase
- ✅ Keep git commits focused
- ✅ Monitor after deployment

---

## 📊 Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| State Variables | 7+ | 2 |
| Lines in fetchHistory | ~100 | ~40 |
| Complexity | HIGH | LOW |
| Loading Spinner Bug | ❌ Stuck | ✅ Works |

---

## 📞 Questions?

Refer to:
- **Strategy**: `refactor_plan.md`
- **Implementation**: `wbs_checklist.md`
- **Original Issue**: `archive/agent_status_indicator_investigation_YYYYMMDD_HHMMSS.md`
- **Backup**: `src/pages/AgentChatPage.tsx.backup_YYYYMMDD_HHMMSS`

---

## 🎉 Success Criteria

1. ✅ Loading spinner NEVER gets stuck
2. ✅ Code is significantly simpler
3. ✅ All existing functionality preserved
4. ✅ No regressions in other features

