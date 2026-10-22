# Edge Function Patterns Research - Token Usage Tracking

**Research Date**: October 22, 2025  
**Researcher**: AI Assistant  
**Status**: Complete

---

## Objective

Analyze existing Supabase Edge Function patterns for admin operations to ensure consistent authentication, authorization, error handling, and response structures for the new `admin-get-user-token-usage` function.

---

## Reference Functions Analyzed

1. **`admin-get-users/index.ts`** - Data retrieval with pagination and search
2. **`admin-update-user-roles/index.ts`** - Data modification with validation

---

## Standard Edge Function Structure

### A. File Structure Template

```typescript
// 1. Imports
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Function 'function-name' started.");

// 2. Helper Functions
async function getUserIdFromRequest(req: Request, supabaseClient: SupabaseClient): Promise<string | null> {
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  return userError ? null : user?.id ?? null;
}

async function checkAdminRole(userId: string, supabaseClient: SupabaseClient): Promise<boolean> {
  if (!userId) return false;
  const { data: isAdmin, error: rpcError } = await supabaseClient.rpc('user_has_role', {
    user_id: userId,
    role_name: 'admin'
  });
  if (rpcError) {
    console.error("RPC Error checking admin role:", rpcError);
    return false;
  }
  return isAdmin ?? false;
}

// 3. Main Handler
serve(async (req) => {
  // 3a. Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }
  
  // 3b. Method validation
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // 3c. Auth and authorization
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
        auth: { persistSession: false }
      }
    );
    
    const userId = await getUserIdFromRequest(req, supabaseClient);
    const isAdmin = await checkAdminRole(userId!, supabaseClient);
    
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Requires admin role" }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // 3d. Parse and validate request body
    const body = await req.json();
    // ... validation logic
    
    // 3e. Create admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    // 3f. Perform database operations
    // ... business logic
    
    // 3g. Return success response
    return new Response(JSON.stringify({ /* data */ }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
    
  } catch (error) {
    // 3h. Error handling
    console.error("Error in function-name:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
```

---

## Key Patterns and Best Practices

### 1. Authentication & Authorization

**Pattern** (from both examples):

```typescript
// Step 1: Create client with user's auth token
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  {
    global: { headers: { Authorization: req.headers.get("Authorization")! } },
    auth: { persistSession: false }
  }
);

// Step 2: Extract user ID
const userId = await getUserIdFromRequest(req, supabaseClient);

// Step 3: Check admin role using RPC
const isAdmin = await checkAdminRole(userId!, supabaseClient);

// Step 4: Reject if not admin
if (!isAdmin) {
  return new Response(JSON.stringify({ error: "Forbidden: Requires admin role" }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

**RPC Function** (`user_has_role`):
```sql
CREATE OR REPLACE FUNCTION user_has_role(user_id UUID, role_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = $1 
      AND r.name = $2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Why This Pattern**:
- ✅ Verifies user is authenticated
- ✅ Checks admin role via secure RPC function
- ✅ Returns 403 Forbidden for unauthorized access
- ✅ Logs admin actions with user ID

---

### 2. CORS Handling

**Pattern** (consistent across all functions):

```typescript
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }
  
  // ... rest of handler
  
  // Include CORS headers in all responses
  return new Response(JSON.stringify({ /* data */ }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200
  });
});
```

**`_shared/cors.ts`** file:
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
```

---

### 3. Request Body Validation

**Pattern** (from `admin-update-user-roles`):

```typescript
// Parse body
const { userIdToUpdate, roleIds } = await req.json();

// Validate required fields
if (!userIdToUpdate || !Array.isArray(roleIds)) {
  return new Response(JSON.stringify({ error: "Bad Request: Missing required fields" }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Validate UUIDs
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(userIdToUpdate)) {
  return new Response(JSON.stringify({ error: "Bad Request: Invalid UUID format" }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

**Validation Checklist**:
- ✅ Check required fields exist
- ✅ Validate data types
- ✅ Validate UUIDs format
- ✅ Validate date ranges
- ✅ Return 400 Bad Request for validation errors

---

### 4. Database Operations with Service Role

**Pattern**:

```typescript
// Create admin client (bypasses RLS)
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Perform operations
const { data, error } = await supabaseAdmin
  .from('table_name')
  .select('columns')
  .eq('filter_column', value);

if (error) {
  console.error("Database error:", error);
  throw new Error(`Failed to fetch data: ${error.message}`);
}
```

**Key Points**:
- ✅ Use `SUPABASE_SERVICE_ROLE_KEY` for admin operations
- ✅ Bypasses Row Level Security (RLS) policies
- ✅ Required for cross-user data access
- ✅ Always validate authorization before using service role

---

### 5. Pagination Pattern

**Pattern** (from `admin-get-users`):

```typescript
const body = await req.json();
const page = parseInt(body.page || "1", 10);
const perPage = parseInt(body.perPage || "20", 10);

// Option A: Using auth.admin.listUsers (for auth.users table)
const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
  page: page,
  perPage: perPage
});

// Option B: Using database queries (for custom tables)
const offset = (page - 1) * perPage;
const { data, count, error } = await supabaseAdmin
  .from('table_name')
  .select('*', { count: 'exact' })
  .range(offset, offset + perPage - 1)
  .order('created_at', { ascending: false });

const totalPages = Math.ceil((count || 0) / perPage);
```

**Response Format**:
```typescript
return new Response(JSON.stringify({
  data: resultArray,
  total: totalCount,
  page: currentPage,
  perPage: perPage,
  totalPages: totalPages
}), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  status: 200
});
```

---

### 6. Search/Filter Pattern

**Pattern** (from `admin-get-users`):

```typescript
const searchTerm = body.searchTerm?.trim() || null;

if (searchTerm) {
  const lowerSearchTerm = searchTerm.toLowerCase();
  
  // For auth.users table
  users = users.filter(user => {
    const emailMatch = user.email?.toLowerCase().includes(lowerSearchTerm);
    // ... other field matches
    return emailMatch || /* other conditions */;
  });
  
  // For database tables (more efficient)
  const { data } = await supabaseAdmin
    .from('table_name')
    .select('*')
    .or(`email.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`);
}
```

**Recommended for Token Usage**: 
- No search needed initially (fetching by specific user ID)
- Could add date range filtering

---

### 7. Error Handling

**Pattern** (consistent across all functions):

```typescript
try {
  // ... business logic
  
  // Specific error handling for known cases
  if (specificError) {
    return new Response(JSON.stringify({ error: "Specific error message" }), {
      status: 400, // or appropriate status code
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
} catch (error) {
  console.error("Error in function-name:", error);
  
  // Handle JSON parsing errors specifically
  if (error instanceof SyntaxError) {
    return new Response(JSON.stringify({ error: "Bad Request: Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // Generic error response
  return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

**HTTP Status Codes**:
- `200` - Success
- `400` - Bad Request (validation errors, malformed input)
- `403` - Forbidden (authentication/authorization failures)
- `405` - Method Not Allowed (non-POST requests)
- `500` - Internal Server Error (unexpected errors)

---

### 8. Logging

**Pattern**:

```typescript
// Startup log
console.log("Function 'function-name' started.");

// Authorization log
console.log(`Admin user ${userId} authorized for operation.`);

// Operation log
console.log(`Fetching data for user: ${targetUserId}`);

// Error log
console.error("Error in function-name:", error);

// Success log
console.log(`Successfully completed operation for user ${targetUserId}`);
```

**Best Practices**:
- ✅ Log function startup
- ✅ Log admin user performing action
- ✅ Log key operations (but not sensitive data)
- ✅ Always log errors with context
- ✅ Include user IDs for audit trail

---

### 9. Response Structure

**Success Response**:
```typescript
return new Response(JSON.stringify({
  // Option A: Simple data return
  data: resultObject,
  
  // Option B: Structured response with metadata
  success: true,
  data: resultObject,
  metadata: {
    timestamp: new Date().toISOString(),
    requestId: crypto.randomUUID()
  }
}), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  status: 200
});
```

**Error Response**:
```typescript
return new Response(JSON.stringify({
  error: "Human-readable error message",
  code: "ERROR_CODE", // Optional
  details: { /* additional context */ } // Optional
}), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  status: statusCode
});
```

---

## Proposed: `admin-get-user-token-usage` Function

### Function Signature

**Endpoint**: `admin-get-user-token-usage`

**Request Body**:
```typescript
interface TokenUsageRequest {
  userId: string;           // UUID of user to query
  startDate?: string;       // ISO 8601 date (default: 30 days ago)
  endDate?: string;         // ISO 8601 date (default: now)
  periodType?: 'daily' | 'weekly' | 'monthly'; // Default: 'daily'
  includeHistory?: boolean; // Include historical chart data (default: true)
}
```

**Response Body**:
```typescript
interface TokenUsageResponse {
  userId: string;
  userEmail: string;
  
  // Current period stats
  currentPeriod: {
    daily: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      message_count: number;
      conversation_count: number;
      last_activity: string; // ISO timestamp
    };
    weekly: { /* same structure */ };
    monthly: { /* same structure */ };
  };
  
  // Historical data for charting
  history: Array<{
    period_start: string;    // ISO timestamp
    period_end: string;      // ISO timestamp
    period_type: string;     // 'daily', 'weekly', 'monthly'
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    message_count: number;
    conversation_count: number;
  }>;
  
  // Aggregate breakdown
  breakdown: {
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_tokens: number;
    total_messages: number;
    total_conversations: number;
    date_range: {
      start: string;
      end: string;
    };
  };
  
  // Optional: Cost estimation
  estimatedCost?: {
    input_cost_usd: number;
    output_cost_usd: number;
    total_cost_usd: number;
    pricing_model: string; // e.g., "gpt-4o-mini-default"
  };
}
```

---

### Implementation Skeleton

```typescript
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Function 'admin-get-user-token-usage' started.");

// Helper functions (reuse from other admin functions)
async function getUserIdFromRequest(req: Request, supabaseClient: SupabaseClient): Promise<string | null> {
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  return userError ? null : user?.id ?? null;
}

async function checkAdminRole(userId: string, supabaseClient: SupabaseClient): Promise<boolean> {
  if (!userId) return false;
  const { data: isAdmin, error: rpcError } = await supabaseClient.rpc('user_has_role', {
    user_id: userId,
    role_name: 'admin'
  });
  if (rpcError) {
    console.error("RPC Error checking admin role:", rpcError);
    return false;
  }
  return isAdmin ?? false;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }
  
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Auth check
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
        auth: { persistSession: false }
      }
    );
    
    const adminUserId = await getUserIdFromRequest(req, supabaseClient);
    const isAdmin = await checkAdminRole(adminUserId!, supabaseClient);
    
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Requires admin role" }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Parse request
    const { userId, startDate, endDate, periodType, includeHistory } = await req.json();
    
    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRegex.test(userId)) {
      return new Response(JSON.stringify({ error: "Bad Request: Invalid or missing userId" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return new Response(JSON.stringify({ error: "Bad Request: Invalid date format" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`Admin ${adminUserId} fetching token usage for user ${userId} from ${start.toISOString()} to ${end.toISOString()}`);
    
    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    // Fetch user email
    const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (!targetUser) {
      return new Response(JSON.stringify({ error: "Not Found: User does not exist" }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Fetch token usage data from user_token_usage table
    const { data: usageData, error: usageError } = await supabaseAdmin
      .from('user_token_usage')
      .select('*')
      .eq('user_id', userId)
      .gte('period_start', start.toISOString())
      .lte('period_end', end.toISOString())
      .order('period_start', { ascending: false });
    
    if (usageError) {
      console.error("Error fetching token usage:", usageError);
      throw new Error(`Failed to fetch token usage: ${usageError.message}`);
    }
    
    // Calculate current period stats (daily, weekly, monthly)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const dailyStats = usageData?.find(u => 
      new Date(u.period_start) >= todayStart && u.period_type === 'daily'
    ) || { total_prompt_tokens: 0, total_completion_tokens: 0, total_tokens: 0, message_count: 0, conversation_count: 0 };
    
    const weeklyStats = usageData?.filter(u => 
      new Date(u.period_start) >= weekStart
    ).reduce((acc, u) => ({
      total_prompt_tokens: acc.total_prompt_tokens + u.total_prompt_tokens,
      total_completion_tokens: acc.total_completion_tokens + u.total_completion_tokens,
      total_tokens: acc.total_tokens + u.total_tokens,
      message_count: acc.message_count + u.message_count,
      conversation_count: acc.conversation_count + u.conversation_count
    }), { total_prompt_tokens: 0, total_completion_tokens: 0, total_tokens: 0, message_count: 0, conversation_count: 0 });
    
    const monthlyStats = usageData?.filter(u => 
      new Date(u.period_start) >= monthStart
    ).reduce((acc, u) => ({
      total_prompt_tokens: acc.total_prompt_tokens + u.total_prompt_tokens,
      total_completion_tokens: acc.total_completion_tokens + u.total_completion_tokens,
      total_tokens: acc.total_tokens + u.total_tokens,
      message_count: acc.message_count + u.message_count,
      conversation_count: acc.conversation_count + u.conversation_count
    }), { total_prompt_tokens: 0, total_completion_tokens: 0, total_tokens: 0, message_count: 0, conversation_count: 0 });
    
    // Build response
    const response = {
      userId,
      userEmail: targetUser.email,
      currentPeriod: {
        daily: {
          prompt_tokens: dailyStats.total_prompt_tokens,
          completion_tokens: dailyStats.total_completion_tokens,
          total_tokens: dailyStats.total_tokens,
          message_count: dailyStats.message_count,
          conversation_count: dailyStats.conversation_count,
          last_activity: dailyStats.last_activity || null
        },
        weekly: {
          prompt_tokens: weeklyStats.total_prompt_tokens,
          completion_tokens: weeklyStats.total_completion_tokens,
          total_tokens: weeklyStats.total_tokens,
          message_count: weeklyStats.message_count,
          conversation_count: weeklyStats.conversation_count,
          last_activity: null
        },
        monthly: {
          prompt_tokens: monthlyStats.total_prompt_tokens,
          completion_tokens: monthlyStats.total_completion_tokens,
          total_tokens: monthlyStats.total_tokens,
          message_count: monthlyStats.message_count,
          conversation_count: monthlyStats.conversation_count,
          last_activity: null
        }
      },
      history: includeHistory !== false ? (usageData || []).map(u => ({
        period_start: u.period_start,
        period_end: u.period_end,
        period_type: u.period_type,
        prompt_tokens: u.total_prompt_tokens,
        completion_tokens: u.total_completion_tokens,
        total_tokens: u.total_tokens,
        message_count: u.message_count,
        conversation_count: u.conversation_count
      })) : [],
      breakdown: {
        total_prompt_tokens: (usageData || []).reduce((sum, u) => sum + u.total_prompt_tokens, 0),
        total_completion_tokens: (usageData || []).reduce((sum, u) => sum + u.total_completion_tokens, 0),
        total_tokens: (usageData || []).reduce((sum, u) => sum + u.total_tokens, 0),
        total_messages: (usageData || []).reduce((sum, u) => sum + u.message_count, 0),
        total_conversations: new Set((usageData || []).flatMap(u => u.agent_ids || [])).size,
        date_range: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      }
    };
    
    console.log(`Successfully fetched token usage for user ${userId}`);
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (error) {
    console.error("Error in admin-get-user-token-usage:", error);
    
    if (error instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: "Bad Request: Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
```

---

## Testing Strategy

### 1. Manual Testing via Supabase Dashboard

```bash
# Test with curl
curl -X POST https://[project-ref].supabase.co/functions/v1/admin-get-user-token-usage \
  -H "Authorization: Bearer [USER_JWT_TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "3f966af2-72a1-41bc-8fac-400b8002664b",
    "startDate": "2025-10-01T00:00:00Z",
    "endDate": "2025-10-22T23:59:59Z"
  }'
```

### 2. Test Cases

1. **✅ Happy Path**: Valid admin, valid user ID, date range with data
2. **❌ Unauthorized**: Non-admin user attempts access (403)
3. **❌ Invalid User ID**: Malformed UUID (400)
4. **❌ User Not Found**: Valid UUID but user doesn't exist (404)
5. **❌ Invalid Dates**: Malformed date strings (400)
6. **❌ Missing Auth**: No Authorization header (401)
7. **✅ Empty Data**: Valid request but user has no token usage (200, empty arrays)
8. **✅ Date Range**: Verify filtering by date range works correctly

---

## Deployment Process

```powershell
# Deploy function to Supabase
supabase functions deploy admin-get-user-token-usage

# Verify deployment
supabase functions list

# Check logs
supabase functions logs admin-get-user-token-usage
```

---

## Key Takeaways

### ✅ Consistent Patterns to Follow

1. **Authentication**: Always use `getUserIdFromRequest` + `checkAdminRole`
2. **CORS**: Include `corsHeaders` in all responses
3. **Validation**: Validate UUIDs, dates, and required fields
4. **Logging**: Log admin actions and errors
5. **Error Handling**: Return appropriate HTTP status codes
6. **Service Role**: Use for cross-user database access
7. **Response Structure**: Consistent JSON format

### ✅ Security Checklist

- ✅ Verify admin role before data access
- ✅ Use service role only after authorization check
- ✅ Validate all user inputs
- ✅ Log all admin actions for audit trail
- ✅ Don't expose internal error details to client
- ✅ Handle CORS properly for browser requests

---

**Research Complete**: ✅  
**Recommended Function Name**: `admin-get-user-token-usage`  
**Estimated Complexity**: Medium (similar to `admin-get-users`)  
**Dependencies**: `user_token_usage` table, `user_has_role` RPC function


