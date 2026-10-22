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

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isErrorResponse(response: any): response is ErrorResponse {
  return response && response.success === false && 'error' in response && 'code' in response;
}

export function isTokenUsageRecord(data: any): data is TokenUsageRecord {
  return (
    data &&
    typeof data.id === 'string' &&
    typeof data.userId === 'string' &&
    typeof data.totalTokens === 'number'
  );
}

export function isGetUserTokenUsageResponse(response: any): response is GetUserTokenUsageResponse {
  return response && response.success === true && 'data' in response && 'usage' in response.data;
}

