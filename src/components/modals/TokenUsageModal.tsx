import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useTokenUsage } from '../../hooks/useTokenUsage';
import { TokenUsageHeader } from '../admin/TokenUsageHeader';
import { TokenUsageSummary } from '../admin/TokenUsageSummary';
import { TokenUsageChart } from '../charts/TokenUsageChart';
import { TokenUsageTable } from '../admin/TokenUsageTable';
import { TokenUsageFooter } from '../admin/TokenUsageFooter';
import type { PeriodType, SortField, SortOrder } from '../../types/token-usage';

interface TokenUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  userName?: string;
}

export function TokenUsageModal({
  isOpen,
  onClose,
  userId,
  userEmail,
  userName,
}: TokenUsageModalProps) {
  // Date range state (default: last 30 days)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // Filters state
  const [periodType, setPeriodType] = useState<PeriodType>('daily');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>('period_start');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // Fetch data using custom hook
  const {
    usage,
    summary,
    isLoading,
    error,
    totalRecords,
    hasNextPage,
    hasPrevPage,
    refetch,
    exportCSV,
  } = useTokenUsage({
    userId,
    dateRange,
    periodType,
    sortBy,
    sortOrder,
    currentPage,
    enabled: isOpen,
  });

  // Reset to page 1 when filters change
  const handleDateRangeChange = (newRange: { start: string; end: string }) => {
    setDateRange(newRange);
    setCurrentPage(1);
  };

  const handlePeriodTypeChange = (newType: PeriodType) => {
    setPeriodType(newType);
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      // Toggle sort order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleRefresh = async () => {
    await refetch();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <TokenUsageHeader
            userEmail={userEmail}
            userName={userName}
            dateRange={dateRange}
            periodType={periodType}
            onDateRangeChange={handleDateRangeChange}
            onPeriodTypeChange={handlePeriodTypeChange}
          />
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-6 overflow-auto px-6 pb-6">
          {/* Summary Cards */}
          <TokenUsageSummary summary={summary} loading={isLoading} />

          {/* Chart */}
          <TokenUsageChart
            data={usage}
            loading={isLoading}
            chartType={chartType}
            onChartTypeChange={setChartType}
          />

          {/* Table */}
          <TokenUsageTable
            data={usage}
            loading={isLoading}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            currentPage={currentPage}
            totalRecords={totalRecords}
            onPageChange={handlePageChange}
            hasNextPage={hasNextPage}
            hasPrevPage={hasPrevPage}
          />

          {/* Error Display */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/50 text-destructive p-4 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{error}</span>
              </div>
              <button
                onClick={handleRefresh}
                className="px-3 py-1 bg-destructive/20 hover:bg-destructive/30 rounded text-sm transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4">
          <TokenUsageFooter
            onExportCSV={exportCSV}
            onRefresh={handleRefresh}
            onClose={onClose}
            isExporting={false}
            isRefreshing={isLoading}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

