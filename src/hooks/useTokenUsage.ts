import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type {
  TokenUsageRecord,
  UsageSummary,
  GetUserTokenUsageResponse,
  PeriodType,
  SortField,
  SortOrder,
} from '../types/token-usage';

const PER_PAGE = 30;

interface UseTokenUsageOptions {
  userId: string;
  dateRange: { start: string; end: string };
  periodType: PeriodType;
  sortBy: SortField;
  sortOrder: SortOrder;
  currentPage: number;
  enabled: boolean; // Don't fetch if modal is closed
}

interface UseTokenUsageReturn {
  // Data
  usage: TokenUsageRecord[];
  summary: UsageSummary | null;
  
  // State
  isLoading: boolean;
  error: string | null;
  
  // Pagination
  totalRecords: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  
  // Actions
  refetch: () => Promise<void>;
  exportCSV: () => void;
}

export function useTokenUsage(options: UseTokenUsageOptions): UseTokenUsageReturn {
  const [usage, setUsage] = useState<TokenUsageRecord[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  
  const fetchUsage = useCallback(async () => {
    if (!options.enabled) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: funcError } = await supabase.functions.invoke<GetUserTokenUsageResponse>(
        'get-user-token-usage',
        {
          body: {
            userId: options.userId,
            startDate: options.dateRange.start,
            endDate: options.dateRange.end,
            periodType: options.periodType,
            sortBy: options.sortBy,
            sortOrder: options.sortOrder,
            limit: PER_PAGE,
            offset: (options.currentPage - 1) * PER_PAGE,
          }
        }
      );
      
      if (funcError) throw new Error(funcError.message);
      if (!data || !data.success) throw new Error(data?.error || 'Failed to fetch usage');
      
      // Transform snake_case to camelCase for frontend
      const transformedUsage = data.data.usage.map((record: any) => ({
        id: record.id,
        userId: record.user_id,
        periodStart: record.period_start,
        periodEnd: record.period_end,
        periodType: record.period_type,
        totalPromptTokens: record.total_prompt_tokens,
        totalCompletionTokens: record.total_completion_tokens,
        totalTokens: record.total_tokens,
        messageCount: record.message_count,
        conversationCount: record.conversation_count,
        agentIds: record.agent_ids || [],
        lastActivity: record.last_activity,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      }));
      
      setUsage(transformedUsage);
      setSummary(data.data.summary);
      setTotalRecords(data.data.pagination.total);
      
    } catch (err: any) {
      console.error('[useTokenUsage] Error:', err);
      setError(err.message || 'Failed to fetch token usage');
      setUsage([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    options.enabled,
    options.userId,
    options.dateRange.start,
    options.dateRange.end,
    options.periodType,
    options.sortBy,
    options.sortOrder,
    options.currentPage,
  ]);
  
  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);
  
  const exportCSV = useCallback(() => {
    if (usage.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = [
      'Date',
      'Period Type',
      'Total Tokens',
      'Input Tokens',
      'Output Tokens',
      'Messages',
      'Conversations',
      'Agents'
    ];
    
    const rows = usage.map(record => [
      new Date(record.periodStart).toLocaleDateString(),
      record.periodType,
      record.totalTokens,
      record.totalPromptTokens,
      record.totalCompletionTokens,
      record.messageCount,
      record.conversationCount,
      record.agentIds.length
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `token-usage-${options.userId}-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [usage, options.userId]);
  
  return {
    usage,
    summary,
    isLoading,
    error,
    totalRecords,
    hasNextPage: options.currentPage < Math.ceil(totalRecords / PER_PAGE),
    hasPrevPage: options.currentPage > 1,
    refetch: fetchUsage,
    exportCSV,
  };
}

