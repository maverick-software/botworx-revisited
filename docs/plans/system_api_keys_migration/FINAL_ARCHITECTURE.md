# System API Keys - Final Architecture

**Date:** October 13, 2025  
**Status:** ✅ FINALIZED

---

## 🎯 Architecture Decision

After implementation and review, we've settled on a **hybrid approach** that balances centralized control with per-user customization needs.

---

## 📊 System API Keys (Admin-Managed)

**Location:** Admin Settings → API Keys tab

**Criteria:** Simple API key-only services with **no per-user configuration needed**

### Services (4 total):

1. **OpenAI** - `sk-...`
   - All agents use same API key
   - No per-user config needed

2. **Anthropic** - `sk-ant-...`
   - All agents use same API key
   - No per-user config needed

3. **Mistral AI**
   - All agents use same API key
   - No per-user config needed

4. **Serper API**
   - All agents use same API key for web search
   - No per-user config needed

### Characteristics:
- ✅ Single shared credential
- ✅ No per-user customization needed
- ✅ Immediate platform-wide deployment
- ✅ Centralized cost control
- ✅ Simplified user experience

---

## 👤 User-Level Integrations

**Location:** User Integrations page (per-account configuration)

**Criteria:** Services requiring **per-user/account configuration**

### Services:

1. **SMTP / SMTP.com**
   - **Why user-level:** Each account needs their own sender identity
     - From Email (different per account)
     - From Name (different per account)
     - Reply-To Email (different per account)
   - Users configure their own SMTP settings
   - Each account has unique sender credentials

2. **ClickSend SMS**
   - **Why user-level:** Each account needs their own phone number/sender ID
     - Phone Number (different per account)
     - Sender ID (different per account)
     - Country-specific settings
   - Users configure their own ClickSend credentials
   - Each account has unique phone identity

3. **Gmail / Microsoft Outlook** (OAuth)
   - **Why user-level:** Personal email accounts
   - Each user authenticates with their own account
   - Cannot be shared across users

---

## 🔄 Why This Split?

### System-Level Services:
```
Question: Do users need different configurations?
Answer: NO → System API Key

Example: OpenAI
- All users can use the same API key
- No customization needed (model selection happens at runtime)
- Centralized billing and control
```

### User-Level Services:
```
Question: Do users need different configurations?
Answer: YES → User Integration

Example: SMTP.com
- User A needs emails from: support@companyA.com
- User B needs emails from: sales@companyB.com
- Cannot share sender identity
- Must be configured per-account
```

---

## 🛠️ Implementation Details

### Frontend Changes:

1. **Admin Panel** (`src/pages/admin/AdminSystemAPIKeysPage.tsx`)
   - Shows only 4 simple API key services
   - Clear note explaining the split

2. **User Integrations** (`src/pages/IntegrationsPage.tsx`)
   - Shows SMTP, ClickSend, Gmail, Outlook
   - Users configure their own settings

3. **Tool Discovery** (`supabase/functions/get-agent-tools/index.ts`)
   - Checks system keys for: OpenAI, Anthropic, Mistral, Serper
   - Checks user credentials for: SMTP, ClickSend, Gmail, Outlook

### Edge Functions:

#### System Key Services:
- `mistral-ai-api` - System key only
- `web-search-api` - System Serper key (with user fallback to other providers)

#### User Credential Services:
- `smtp-api` - User SMTP credentials (can optionally support system fallback)
- `clicksend-api` - User ClickSend credentials (can optionally support system fallback)
- `gmail-api` - User OAuth tokens
- `microsoft-outlook-api` - User OAuth tokens

---

## 💡 Benefits of This Architecture

### For Administrators:
✅ Control costs for high-volume AI services  
✅ Simple setup for API-only services  
✅ No need to manage per-user configurations  

### For Users:
✅ Can customize sender identities (email/SMS)  
✅ Can use their own email accounts (Gmail/Outlook)  
✅ Flexibility where needed  
✅ Simplicity where possible  

### For Platform:
✅ Clear separation of concerns  
✅ Scales well with different use cases  
✅ Maintains security and isolation  
✅ Reduces configuration overhead  

---

## 📋 Migration Status

### Completed ✅
- [x] Admin panel updated (4 system keys)
- [x] Tool discovery updated
- [x] User integrations filter updated
- [x] Documentation complete

### Deployment Needed 🚀
- [ ] Frontend rebuild
- [ ] Frontend deployment
- [ ] Edge function deployment (get-agent-tools)

---

## 🎓 Key Takeaway

> **System API Keys** = Simple, shared, no customization  
> **User Integrations** = Complex, personal, needs customization

This architecture provides the **best of both worlds**: centralized control where appropriate, and user flexibility where necessary.

---

**Architecture Finalized:** October 13, 2025  
**Ready for Production:** After frontend rebuild/deploy

