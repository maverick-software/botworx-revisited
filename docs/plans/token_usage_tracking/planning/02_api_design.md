# API Design - Token Usage Tracking

**Planning Date**: October 22, 2025  
**Status**: Complete  
**Phase**: Planning (2.2)

---

## Objective

Design Edge Function API endpoints for fetching aggregated token usage data with proper authentication, authorization, error handling, and TypeScript interfaces.

---

## Edge Function: `get-user-token-usage`

### Endpoint Location

**Path**: `supabase/functions/get-user-token-usage/index.ts`

### Authentication

- **Required**: Yes (JWT Bearer token)
- **RLS**: Enforced via database policies
- **Admin Check**: Required for viewing other users' data

### Request Schema

```typescript
interface GetUserTokenUsageRequest {
  // Target user ID (optional - defaults to current user)
  // Admins can specify any user, regular users can only query themselves
  userId?: string;
  
  // Date range filter
  startDate?: string; // ISO 8601 date (YYYY-MM-DD)
  endDate?: string;   // ISO 8601 date (YYYY-MM-DD)
  
  // Period type filter
  periodType?: 'daily' | 'weekly' | 'monthly' | 'all';
  
  // Pagination
  limit?: number;  // Default: 30, Max: 100
  offset?: number; // Default: 0
  
  // Sorting
  sortBy?: 'period_start' | 'total_tokens' | 'message_count';
  sortOrder?: 'asc' | 'desc'; // Default: desc
}
```

### Response Schema

```typescript
interface GetUserTokenUsageResponse {
  success: boolean;
  data: {
    usage: TokenUsageRecord[];
    summary: UsageSummary;
    pagination: PaginationInfo;
  };
  error?: string;
}

interface TokenUsageRecord {
  id: string;
  userId: string;
  periodStart: string; // ISO 8601 timestamp
  periodEnd: string;   // ISO 8601 timestamp
  periodType: 'daily' | 'weekly' | 'monthly';
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  messageCount: number;
  conversationCount: number;
  agentIds: string[];
  lastActivity: string; // ISO 8601 timestamp
  createdAt: string;
  updatedAt: string;
}

interface UsageSummary {
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalMessages: number;
  totalConversations: number;
  uniqueAgents: number;
  dateRange: {
    start: string;
    end: string;
  };
  avgTokensPerDay: number;
  avgTokensPerMessage: number;
}

interface PaginationInfo {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}
```

### Error Response Schema

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code: ErrorCode;
  details?: Record<string, any>;
}

type ErrorCode = 
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_REQUEST'
  | 'USER_NOT_FOUND'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR';
```

### Example Requests

#### Request 1: Get Current User's Daily Usage for Last 30 Days

```bash
curl -X POST https://[PROJECT].supabase.co/functions/v1/get-user-token-usage \
  -H "Authorization: Bearer [JWT]" \
  -H "Content-Type: application/json" \
  -d '{
    "periodType": "daily",
    "limit": 30
  }'
```

#### Request 2: Admin Gets Specific User's Usage

```bash
curl -X POST https://[PROJECT].supabase.co/functions/v1/get-user-token-usage \
  -H "Authorization: Bearer [JWT]" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "3f966af2-72a1-41bc-8fac-400b8002664b",
    "startDate": "2025-09-01",
    "endDate": "2025-10-01",
    "periodType": "monthly"
  }'
```

#### Request 3: Get Usage with Custom Sorting

```bash
curl -X POST https://[PROJECT].supabase.co/functions/v1/get-user-token-usage \
  -H "Authorization: Bearer [JWT]" \
  -H "Content-Type: application/json" \
  -d '{
    "periodType": "daily",
    "sortBy": "total_tokens",
    "sortOrder": "desc",
    "limit": 10
  }'
```

### Example Responses

#### Success Response

```json
{
  "success": true,
  "data": {
    "usage": [
      {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "userId": "3f966af2-72a1-41bc-8fac-400b8002664b",
        "periodStart": "2025-10-22T00:00:00.000Z",
        "periodEnd": "2025-10-23T00:00:00.000Z",
        "periodType": "daily",
        "totalPromptTokens": 1435,
        "totalCompletionTokens": 901,
        "totalTokens": 2336,
        "messageCount": 12,
        "conversationCount": 3,
        "agentIds": [
          "48500f5c-f65d-46b5-a2a3-3da29523f113",
          "141355f1-6192-4245-a625-a2db9e6d37f1"
        ],
        "lastActivity": "2025-10-22T18:45:23.120Z",
        "createdAt": "2025-10-23T00:05:00.000Z",
        "updatedAt": "2025-10-23T00:05:00.000Z"
      }
    ],
    "summary": {
      "totalTokens": 45678,
      "totalPromptTokens": 28901,
      "totalCompletionTokens": 16777,
      "totalMessages": 234,
      "totalConversations": 45,
      "uniqueAgents": 5,
      "dateRange": {
        "start": "2025-09-22T00:00:00.000Z",
        "end": "2025-10-22T23:59:59.999Z"
      },
      "avgTokensPerDay": 1522,
      "avgTokensPerMessage": 195
    },
    "pagination": {
      "limit": 30,
      "offset": 0,
      "total": 30,
      "hasMore": false
    }
  }
}
```

#### Error Response: Unauthorized

```json
{
  "success": false,
  "error": "You are not authorized to view token usage for this user",
  "code": "FORBIDDEN"
}
```

#### Error Response: Invalid Request

```json
{
  "success": false,
  "error": "Invalid date range: startDate must be before endDate",
  "code": "INVALID_REQUEST",
  "details": {
    "startDate": "2025-10-01",
    "endDate": "2025-09-01"
  }
}
```

---

## Edge Function: `aggregate-token-usage`

### Endpoint Location

**Path**: `supabase/functions/aggregate-token-usage/index.ts`

### Authentication

- **Required**: Yes (Service Role Key or Admin JWT)
- **Admin Only**: Yes
- **Purpose**: Manual trigger for aggregation (also called by cron)

### Request Schema

```typescript
interface AggregateTokenUsageRequest {
  // Optional: Aggregate for specific user only
  userId?: string;
  
  // Optional: Aggregate for specific date range
  startDate?: string; // ISO 8601 date (YYYY-MM-DD)
  endDate?: string;   // ISO 8601 date (YYYY-MM-DD)
  
  // Optional: Force re-aggregation (overwrite existing records)
  force?: boolean; // Default: false
}
```

### Response Schema

```typescript
interface AggregateTokenUsageResponse {
  success: boolean;
  data: {
    usersProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    totalTokensAggregated: number;
    duration: number; // milliseconds
    dateRange: {
      start: string;
      end: string;
    };
  };
  error?: string;
}
```

### Example Request

```bash
curl -X POST https://[PROJECT].supabase.co/functions/v1/aggregate-token-usage \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-10-01",
    "endDate": "2025-10-22"
  }'
```

### Example Response

```json
{
  "success": true,
  "data": {
    "usersProcessed": 47,
    "recordsCreated": 156,
    "recordsUpdated": 38,
    "totalTokensAggregated": 1456789,
    "duration": 3421,
    "dateRange": {
      "start": "2025-10-01T00:00:00.000Z",
      "end": "2025-10-22T00:00:00.000Z"
    }
  }
}
```

---

## Edge Function: `backfill-token-usage`

### Endpoint Location

**Path**: `supabase/functions/backfill-token-usage/index.ts`

### Authentication

- **Required**: Yes (Service Role Key or Admin JWT)
- **Admin Only**: Yes
- **Purpose**: Backfill historical data in batches

### Request Schema

```typescript
interface BackfillTokenUsageRequest {
  startDate: string; // ISO 8601 date (YYYY-MM-DD) - Required
  endDate: string;   // ISO 8601 date (YYYY-MM-DD) - Required
  batchSize?: number; // Days per batch, Default: 30, Max: 90
}
```

### Response Schema

```typescript
interface BackfillTokenUsageResponse {
  success: boolean;
  data: {
    batches: BackfillBatchResult[];
    summary: BackfillSummary;
  };
  error?: string;
}

interface BackfillBatchResult {
  batchStart: string;
  batchEnd: string;
  usersProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  status: 'success' | 'error';
  error?: string;
  durationSeconds: number;
}

interface BackfillSummary {
  totalBatches: number;
  successfulBatches: number;
  failedBatches: number;
  totalUsersProcessed: number;
  totalRecordsCreated: number;
  totalRecordsUpdated: number;
  totalDurationSeconds: number;
  dateRange: {
    start: string;
    end: string;
  };
}
```

### Example Request

```bash
curl -X POST https://[PROJECT].supabase.co/functions/v1/backfill-token-usage \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-01-01",
    "endDate": "2025-10-22",
    "batchSize": 30
  }'
```

### Example Response

```json
{
  "success": true,
  "data": {
    "batches": [
      {
        "batchStart": "2025-01-01",
        "batchEnd": "2025-01-31",
        "usersProcessed": 42,
        "recordsCreated": 987,
        "recordsUpdated": 0,
        "status": "success",
        "durationSeconds": 4.56
      },
      {
        "batchStart": "2025-02-01",
        "batchEnd": "2025-02-28",
        "usersProcessed": 45,
        "recordsCreated": 1123,
        "recordsUpdated": 0,
        "status": "success",
        "durationSeconds": 5.12
      }
    ],
    "summary": {
      "totalBatches": 10,
      "successfulBatches": 10,
      "failedBatches": 0,
      "totalUsersProcessed": 450,
      "totalRecordsCreated": 11234,
      "totalRecordsUpdated": 0,
      "totalDurationSeconds": 52.34,
      "dateRange": {
        "start": "2025-01-01",
        "end": "2025-10-22"
      }
    }
  }
}
```

---

## TypeScript Type Definitions

### Shared Types File

**Path**: `src/types/token-usage.ts`

```typescript
// =============================================================================
// REQUEST TYPES
// =============================================================================

export interface GetUserTokenUsageRequest {
  userId?: string;
  startDate?: string;
  endDate?: string;
  periodType?: 'daily' | 'weekly' | 'monthly' | 'all';
  limit?: number;
  offset?: number;
  sortBy?: 'period_start' | 'total_tokens' | 'message_count';
  sortOrder?: 'asc' | 'desc';
}

export interface AggregateTokenUsageRequest {
  userId?: string;
  startDate?: string;
  endDate?: string;
  force?: boolean;
}

export interface BackfillTokenUsageRequest {
  startDate: string;
  endDate: string;
  batchSize?: number;
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

export interface GetUserTokenUsageResponse {
  success: boolean;
  data: {
    usage: TokenUsageRecord[];
    summary: UsageSummary;
    pagination: PaginationInfo;
  };
  error?: string;
}

export interface AggregateTokenUsageResponse {
  success: boolean;
  data: {
    usersProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    totalTokensAggregated: number;
    duration: number;
    dateRange: {
      start: string;
      end: string;
    };
  };
  error?: string;
}

export interface BackfillTokenUsageResponse {
  success: boolean;
  data: {
    batches: BackfillBatchResult[];
    summary: BackfillSummary;
  };
  error?: string;
}

// =============================================================================
// DATA TYPES
// =============================================================================

export interface TokenUsageRecord {
  id: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  periodType: 'daily' | 'weekly' | 'monthly';
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  messageCount: number;
  conversationCount: number;
  agentIds: string[];
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageSummary {
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalMessages: number;
  totalConversations: number;
  uniqueAgents: number;
  dateRange: {
    start: string;
    end: string;
  };
  avgTokensPerDay: number;
  avgTokensPerMessage: number;
}

export interface PaginationInfo {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export interface BackfillBatchResult {
  batchStart: string;
  batchEnd: string;
  usersProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  status: 'success' | 'error';
  error?: string;
  durationSeconds: number;
}

export interface BackfillSummary {
  totalBatches: number;
  successfulBatches: number;
  failedBatches: number;
  totalUsersProcessed: number;
  totalRecordsCreated: number;
  totalRecordsUpdated: number;
  totalDurationSeconds: number;
  dateRange: {
    start: string;
    end: string;
  };
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export interface ErrorResponse {
  success: false;
  error: string;
  code: ErrorCode;
  details?: Record<string, any>;
}

export type ErrorCode = 
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_REQUEST'
  | 'USER_NOT_FOUND'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR';

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type PeriodType = 'daily' | 'weekly' | 'monthly';
export type SortField = 'period_start' | 'total_tokens' | 'message_count';
export type SortOrder = 'asc' | 'desc';

export interface DateRange {
  start: string;
  end: string;
}

// Type guard for error responses
export function isErrorResponse(response: any): response is ErrorResponse {
  return response && response.success === false && 'error' in response && 'code' in response;
}

// Type guard for token usage records
export function isTokenUsageRecord(data: any): data is TokenUsageRecord {
  return (
    data &&
    typeof data.id === 'string' &&
    typeof data.userId === 'string' &&
    typeof data.totalTokens === 'number'
  );
}
```

---

## Error Handling Strategy

### HTTP Status Codes

| Status Code | Usage |
|-------------|-------|
| `200` | Success |
| `400` | Invalid request (bad parameters) |
| `401` | Missing or invalid JWT token |
| `403` | Forbidden (not admin when required) |
| `404` | User not found |
| `500` | Internal server error |

### Error Messages

All errors follow this format:

```typescript
{
  success: false,
  error: "Human-readable error message",
  code: "ERROR_CODE",
  details?: { /* Additional context */ }
}
```

### Common Error Scenarios

#### 1. Unauthorized Access

```typescript
if (!currentUserId) {
  return new Response(
    JSON.stringify({
      success: false,
      error: "Authentication required",
      code: "UNAUTHORIZED"
    }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}
```

#### 2. Forbidden Access (Non-Admin)

```typescript
if (requestedUserId !== currentUserId && !isAdmin) {
  return new Response(
    JSON.stringify({
      success: false,
      error: "You are not authorized to view token usage for this user",
      code: "FORBIDDEN"
    }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}
```

#### 3. Invalid Date Range

```typescript
if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
  return new Response(
    JSON.stringify({
      success: false,
      error: "Invalid date range: startDate must be before endDate",
      code: "INVALID_REQUEST",
      details: { startDate, endDate }
    }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}
```

#### 4. Database Error

```typescript
if (error) {
  console.error("[get-user-token-usage] Database error:", error);
  return new Response(
    JSON.stringify({
      success: false,
      error: "Failed to fetch token usage data",
      code: "DATABASE_ERROR",
      details: { message: error.message }
    }),
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}
```

---

## Authorization Logic

### Check if User is Admin

```typescript
async function isUserAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role_id, roles!inner(name)')
    .eq('user_id', userId)
    .eq('roles.name', 'admin')
    .maybeSingle();
  
  if (error) {
    console.error("[isUserAdmin] Error checking admin status:", error);
    return false;
  }
  
  return !!data;
}
```

### Authorize Request

```typescript
async function authorizeRequest(
  supabase: SupabaseClient,
  currentUserId: string,
  requestedUserId?: string
): Promise<{ authorized: boolean; error?: ErrorResponse }> {
  // If no specific user requested, default to current user
  const targetUserId = requestedUserId || currentUserId;
  
  // Users can always view their own data
  if (targetUserId === currentUserId) {
    return { authorized: true };
  }
  
  // Check if current user is admin
  const isAdmin = await isUserAdmin(supabase, currentUserId);
  
  if (!isAdmin) {
    return {
      authorized: false,
      error: {
        success: false,
        error: "You are not authorized to view token usage for this user",
        code: "FORBIDDEN"
      }
    };
  }
  
  // Admin accessing other user's data
  return { authorized: true };
}
```

---

## CORS Configuration

All Edge Functions must include CORS headers:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle OPTIONS request
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}

// Include in all responses
return new Response(
  JSON.stringify(responseData),
  { 
    status: 200, 
    headers: { 
      ...corsHeaders, 
      'Content-Type': 'application/json' 
    } 
  }
);
```

---

## Rate Limiting Considerations

**Current State**: Supabase Edge Functions have built-in rate limiting

**Recommended Custom Limits**:
- `get-user-token-usage`: 100 requests/minute per user
- `aggregate-token-usage`: 10 requests/minute (admin only)
- `backfill-token-usage`: 1 request/minute (admin only, long-running)

**Implementation**: Can be added later using Supabase Edge Function middleware or Upstash Redis

---

## Testing Strategy

### Unit Tests

- Test authorization logic
- Test request validation
- Test date range calculations
- Test error handling

### Integration Tests

- Test with real database queries
- Test RLS policies
- Test admin vs non-admin access
- Test pagination

### Load Tests

- Test 100 concurrent requests to `get-user-token-usage`
- Test aggregation with 10,000+ messages
- Test backfill with 1 year of data

---

**API Design Complete**: ✅  
**TypeScript Types**: Defined  
**Error Handling**: Comprehensive  
**Authorization**: Secure

