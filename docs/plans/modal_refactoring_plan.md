# Modal Files Refactoring Plan

## 🚨 **CRITICAL ISSUE**
- `EnhancedChannelsModal.tsx`: **1,140 lines** (228% over 500-line limit)
- `EnhancedToolsModal.tsx`: **1,525 lines** (305% over 500-line limit)

**Both files violate Philosophy #1: ≤500 lines per file**

## 📋 **MASTER CHECKLIST**

### ✅ **Phase 1: Preparation & Analysis**
- [x] Create backups of original files
- [x] Analyze file structures and identify extractable components
- [x] Create comprehensive refactoring plan with WBS
- [ ] Review rule base for applicable patterns
- [ ] Check web for modern React modal patterns

### 🔄 **Phase 2: Channels Modal Refactoring** 
- [ ] **2.1** Extract connected channels rendering logic
- [ ] **2.2** Extract available services rendering logic  
- [ ] **2.3** Extract setup form components
- [ ] **2.4** Extract permission management logic
- [ ] **2.5** Extract state management hooks
- [ ] **2.6** Create main orchestrator component
- [ ] **2.7** Test refactored channels modal

### 🔄 **Phase 3: Tools Modal Refactoring**
- [ ] **3.1** Extract connected tools rendering logic
- [ ] **3.2** Extract Zapier MCP components
- [ ] **3.3** Extract available tools rendering logic
- [ ] **3.4** Extract setup form components
- [ ] **3.5** Extract web search provider logic
- [ ] **3.6** Extract email relay provider logic
- [ ] **3.7** Create main orchestrator component
- [ ] **3.8** Test refactored tools modal

### ✅ **Phase 4: Verification**
- [ ] **4.1** Verify all files ≤500 lines
- [ ] **4.2** Run linting and fix errors
- [ ] **4.3** Test full functionality
- [ ] **4.4** Document changes
- [ ] **4.5** Clean up backup files

---

## 🏗️ **WORK BREAKDOWN STRUCTURE (WBS)**

### **WBS 2.1: Extract Channels Connected Components**
**Target Files to Create:**
- `src/components/modals/channels/ConnectedChannelsList.tsx` (~150 lines)
- `src/components/modals/channels/ChannelConnectionItem.tsx` (~100 lines)
- `src/components/modals/channels/RemoveChannelButton.tsx` (~50 lines)

**Extracted Logic:**
- `renderConnectedChannels()` function
- Channel connection mapping
- Remove/modify permissions logic

### **WBS 2.2: Extract Channels Available Services**
**Target Files to Create:**
- `src/components/modals/channels/AvailableChannelsList.tsx` (~200 lines)
- `src/components/modals/channels/ChannelSetupCard.tsx` (~120 lines)

**Extracted Logic:**
- `renderAvailableServices()` function
- Service setup flows
- Credential selection logic

### **WBS 2.3: Extract Channels Setup Forms**
**Target Files to Create:**
- `src/components/modals/channels/GmailSetupForm.tsx` (~80 lines)
- `src/components/modals/channels/SMTPSetupForm.tsx` (~100 lines)
- `src/components/modals/channels/MailgunSetupForm.tsx` (~100 lines)

**Extracted Logic:**
- Form handling for each provider
- Validation logic
- API key setup flows

### **WBS 2.4: Extract Channels Permission Management**
**Target Files to Create:**
- `src/components/modals/channels/ChannelPermissionsModal.tsx` (~150 lines)
- `src/components/modals/channels/ScopeSelector.tsx` (~80 lines)

**Extracted Logic:**
- Permission editing modal
- Scope management
- Permission updating logic

### **WBS 2.5: Extract Channels State & Hooks**
**Target Files to Create:**
- `src/components/modals/channels/useChannelsModalState.ts` (~100 lines)
- `src/components/modals/channels/useChannelPermissions.ts` (~80 lines)

**Extracted Logic:**
- State management hooks
- API interaction logic
- Permission fetching logic

### **WBS 2.6: Create Channels Main Component**
**Target File:**
- `src/components/modals/EnhancedChannelsModal.tsx` (~200 lines)

**Remaining Logic:**
- Main modal container
- Tab switching logic
- Component orchestration

---

### **WBS 3.1: Extract Tools Connected Components**
**Target Files to Create:**
- `src/components/modals/tools/ConnectedToolsList.tsx` (~200 lines)
- `src/components/modals/tools/ToolConnectionItem.tsx` (~120 lines)
- `src/components/modals/tools/RemoveToolButton.tsx` (~50 lines)

**Extracted Logic:**
- `renderConnectedTools()` function
- Unified tool grouping logic
- Web search/email relay unification

### **WBS 3.2: Extract Tools Zapier MCP Components**
**Target Files to Create:**
- `src/components/modals/tools/ZapierMCPTab.tsx` (~150 lines)
- `src/components/modals/tools/ZapierConnectionStatus.tsx` (~80 lines)

**Extracted Logic:**
- Zapier MCP connection management
- Tools list component (already partially extracted)
- Connection/disconnection logic

### **WBS 3.3: Extract Tools Available Services**
**Target Files to Create:**
- `src/components/modals/tools/AvailableToolsList.tsx` (~300 lines)
- `src/components/modals/tools/ToolSetupCard.tsx` (~150 lines)

**Extracted Logic:**
- `renderAvailableTools()` function
- Tool discovery and display
- Integration setup flows

### **WBS 3.4: Extract Tools Setup Forms**
**Target Files to Create:**
- `src/components/modals/tools/WebSearchSetupForm.tsx` (~200 lines)
- `src/components/modals/tools/EmailRelaySetupForm.tsx` (~150 lines)
- `src/components/modals/tools/DigitalOceanSetupForm.tsx` (~100 lines)

**Extracted Logic:**
- Provider-specific setup forms
- API key management
- Connection testing logic

### **WBS 3.5-3.6: Extract Provider-Specific Logic**
**Target Files to Create:**
- `src/components/modals/tools/providers/WebSearchProviders.tsx` (~120 lines)
- `src/components/modals/tools/providers/EmailRelayProviders.tsx` (~100 lines)

**Extracted Logic:**
- Provider definitions and configurations
- Capability mapping
- Provider-specific constants

### **WBS 3.7: Create Tools Main Component**
**Target File:**
- `src/components/modals/EnhancedToolsModal.tsx` (~300 lines)

**Remaining Logic:**
- Main modal container
- Tab switching logic
- Component orchestration

---

## 📊 **TARGET FILE SIZES**
After refactoring, all files should be ≤500 lines:

**Channels Modal Structure:**
- Main component: ~200 lines
- 8 extracted components: 50-200 lines each
- **Total: ~1,140 lines → 9 files of ≤200 lines each**

**Tools Modal Structure:**  
- Main component: ~300 lines
- 11 extracted components: 50-300 lines each
- **Total: ~1,525 lines → 12 files of ≤300 lines each**

## 🎯 **SUCCESS CRITERIA**
1. ✅ All files ≤500 lines (Philosophy #1 compliance)
2. ✅ Maintained full functionality 
3. ✅ Zero linting errors
4. ✅ Proper component separation by concerns
5. ✅ Reusable extracted components
6. ✅ Clean import/export structure

## ⚠️ **RISK MITIGATION**
- Backups created before any changes
- Incremental refactoring with testing at each step
- Maintain exact API interfaces during extraction
- Preserve all existing functionality
- Keep backup files until verification complete

---

**Ready to proceed with Phase 2: Channels Modal Refactoring**
