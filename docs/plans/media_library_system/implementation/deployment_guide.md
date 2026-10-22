# Media Library System - Deployment Guide
**Date**: August 29, 2025  
**System**: Comprehensive Media Library & Document Management  
**Environment**: Production Deployment

## 🚀 **DEPLOYMENT STEPS**

### **STEP 1: Database Migration**
```powershell
# Navigate to project directory
cd C:\Users\charl\software\agentopia

# Push database migrations
supabase db push --include-all

# Verify migrations applied successfully
supabase db diff
```

**Expected Output**:
- ✅ `media_library` table created
- ✅ `agent_media_assignments` table created  
- ✅ `media_processing_logs` table created
- ✅ `media_categories` table created
- ✅ `media-library` storage bucket created
- ✅ RLS policies applied
- ✅ Helper functions created

### **STEP 2: Edge Function Deployment**
```powershell
# Deploy Media Library API
supabase functions deploy media-library-api

# Deploy Media Library MCP Tools
supabase functions deploy media-library-mcp

# Verify deployment
supabase functions list
```

**Expected Output**:
- ✅ `media-library-api` function deployed
- ✅ `media-library-mcp` function deployed
- ✅ Functions show as "deployed" status

### **STEP 3: Frontend Build & Test**
```powershell
# Install dependencies (if needed)
npm install

# Build the frontend
npm run build

# Start development server for testing
npm run dev
```

**Expected Output**:
- ✅ Build completes without errors
- ✅ Development server starts on localhost
- ✅ No TypeScript or linting errors

## 🧪 **TESTING CHECKLIST**

### **1. Basic Functionality Tests**

#### **A. Media Library Page Access**
- [ ] Navigate to `/media` in browser
- [ ] Page loads without errors
- [ ] Statistics cards display correctly
- [ ] Upload area is visible and functional

#### **B. Document Upload Test**
- [ ] Drag and drop a PDF file
- [ ] Upload progress shows correctly
- [ ] Document appears in library after processing
- [ ] Processing status updates from "uploaded" → "processing" → "completed"

#### **C. Category Management**
- [ ] Default categories are created automatically
- [ ] Categories display with correct icons
- [ ] Category filtering works in library view
- [ ] Category selection works in upload

### **2. Agent Integration Tests**

#### **A. WhatIKnowModal Integration**
- [ ] Open agent chat page
- [ ] Click "What I Know" modal
- [ ] Media Library section displays
- [ ] "Assign from Library" button works
- [ ] MediaLibrarySelector modal opens

#### **B. Document Assignment**
- [ ] Select documents in MediaLibrarySelector
- [ ] Assignment completes successfully
- [ ] Assigned count updates in WhatIKnowModal
- [ ] Documents appear in agent's knowledge

### **3. MCP Tools Tests**

#### **A. Tool Discovery**
- [ ] Agent chat shows Media Library tools available
- [ ] Tools appear in agent's tool list
- [ ] Tool descriptions are accurate

#### **B. Tool Execution**
```
Test these commands in agent chat:
1. "Search my documents for 'project requirements'"
2. "List all my assigned documents"
3. "Get the content of document [ID]"
4. "Summarize document [ID]"
5. "Find documents related to 'security policies'"
```

Expected Results:
- [ ] All tools execute without errors
- [ ] Results are relevant and formatted correctly
- [ ] Error handling works for invalid requests

### **4. Security Tests**

#### **A. Access Control**
- [ ] Users can only see their own media files
- [ ] Agents can only access assigned documents
- [ ] Storage bucket enforces user isolation
- [ ] RLS policies prevent unauthorized access

#### **B. File Upload Security**
- [ ] File size limits are enforced (50MB)
- [ ] File type validation works
- [ ] Malicious file upload attempts are blocked
- [ ] Storage paths are user-scoped

## 🔧 **CONFIGURATION VERIFICATION**

### **1. Environment Variables**
Ensure these are set in Supabase:
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `SUPABASE_ANON_KEY`
- ✅ `OPENAI_API_KEY` (for document processing)

### **2. Storage Bucket Configuration**
```sql
-- Verify bucket exists and is configured correctly
SELECT * FROM storage.buckets WHERE id = 'media-library';

-- Verify RLS policies
SELECT * FROM storage.objects WHERE bucket_id = 'media-library' LIMIT 1;
```

### **3. Integration Catalog**
```sql
-- Verify Media Library integration exists
SELECT * FROM integrations WHERE name = 'media_library_mcp';

-- Verify MCP tool capabilities
SELECT ic.* FROM integration_capabilities ic
INNER JOIN integrations i ON ic.integration_id = i.id
WHERE i.name = 'media_library_mcp';
```

## 🚨 **TROUBLESHOOTING**

### **Common Issues & Solutions**

#### **1. Migration Failures**
```powershell
# If migrations fail, check for conflicts
supabase db diff

# Reset if necessary (CAUTION: DATA LOSS)
# supabase db reset  # NEVER USE - User forbids this
```

#### **2. Edge Function Errors**
```powershell
# Check function logs
supabase functions logs media-library-api

# Redeploy if needed
supabase functions deploy media-library-api --no-verify-jwt
```

#### **3. Upload Failures**
- Check storage bucket permissions
- Verify file size limits
- Check CORS configuration
- Validate file type restrictions

#### **4. MCP Tool Issues**
- Verify tool registration in `integration_capabilities`
- Check universal tool executor routing
- Validate agent permissions
- Test edge function directly

## 📋 **POST-DEPLOYMENT TASKS**

### **1. User Onboarding**
- [ ] Create user documentation
- [ ] Add help tooltips to UI
- [ ] Create video tutorials
- [ ] Update agent training materials

### **2. Monitoring Setup**
- [ ] Set up error tracking
- [ ] Monitor storage usage
- [ ] Track processing performance
- [ ] Monitor MCP tool usage

### **3. Performance Optimization**
- [ ] Analyze query performance
- [ ] Optimize database indexes
- [ ] Implement caching where needed
- [ ] Monitor edge function performance

## 🎉 **SUCCESS CRITERIA**

The deployment is considered successful when:
- ✅ All tests pass without errors
- ✅ Users can upload and organize documents
- ✅ Agents can access assigned documents via MCP tools
- ✅ Processing pipeline works end-to-end
- ✅ Security policies are enforced
- ✅ Performance meets expectations

## 📞 **SUPPORT & MAINTENANCE**

### **Log Locations**
- **Database Logs**: Supabase Dashboard → Logs
- **Edge Function Logs**: `supabase functions logs [function-name]`
- **Frontend Logs**: Browser Developer Console
- **Processing Logs**: `media_processing_logs` table

### **Backup Strategy**
- **Database**: Automatic Supabase backups
- **Files**: Stored in Supabase Storage with replication
- **Configuration**: Version controlled in Git

---

**🎯 DEPLOYMENT STATUS**: READY FOR PRODUCTION  
**🔧 MAINTENANCE**: Standard Agentopia maintenance procedures apply  
**📈 MONITORING**: Integrated with existing Supabase monitoring
