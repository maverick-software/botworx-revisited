import React from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import type { TokenUsageRecord, SortField, SortOrder } from '../../types/token-usage';

const PER_PAGE = 30;

interface TokenUsageTableProps {
  data: TokenUsageRecord[];
  loading: boolean;
  sortBy: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  currentPage: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function TokenUsageTable({
  data,
  loading,
  sortBy,
  sortOrder,
  onSort,
  currentPage,
  totalRecords,
  onPageChange,
  hasNextPage,
  hasPrevPage,
}: TokenUsageTableProps) {
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-4 w-4 inline ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 inline ml-1" />
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th
                onClick={() => onSort('period_start')}
                className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
              >
                Date
                <SortIcon field="period_start" />
              </th>
              <th
                onClick={() => onSort('total_tokens')}
                className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
              >
                Total Tokens
                <SortIcon field="total_tokens" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Input Tokens
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Output Tokens
              </th>
              <th
                onClick={() => onSort('message_count')}
                className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
              >
                Messages
                <SortIcon field="message_count" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Conversations
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Agents
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mb-2" />
                    <span className="text-muted-foreground">Loading usage data...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  No usage data found for this period
                </td>
              </tr>
            ) : (
              data.map((record) => (
                <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-foreground">
                      {formatDate(record.periodStart)}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {record.periodType}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-foreground">
                      {record.totalTokens.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-blue-400">
                      ↓ {record.totalPromptTokens.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-green-400">
                      ↑ {record.totalCompletionTokens.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">
                    {record.messageCount}
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">
                    {record.conversationCount}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-muted-foreground">
                      {record.agentIds.length} agent{record.agentIds.length !== 1 ? 's' : ''}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && data.length > 0 && (
        <div className="bg-muted/30 px-6 py-3 flex items-center justify-between border-t border-border">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * PER_PAGE + 1} -{' '}
            {Math.min(currentPage * PER_PAGE, totalRecords)} of {totalRecords}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!hasPrevPage}
              className="px-3 py-2 bg-muted hover:bg-muted/70 text-foreground rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!hasNextPage}
              className="px-3 py-2 bg-muted hover:bg-muted/70 text-foreground rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

