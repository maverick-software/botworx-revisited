import React from 'react';
import { Zap } from 'lucide-react';
import { DialogTitle } from '../ui/dialog';
import type { PeriodType } from '../../types/token-usage';

interface TokenUsageHeaderProps {
  userEmail: string;
  userName?: string;
  dateRange: { start: string; end: string };
  periodType: PeriodType;
  onDateRangeChange: (range: { start: string; end: string }) => void;
  onPeriodTypeChange: (type: PeriodType) => void;
}

export function TokenUsageHeader({
  userEmail,
  userName,
  dateRange,
  periodType,
  onDateRangeChange,
  onPeriodTypeChange,
}: TokenUsageHeaderProps) {
  const setLast7Days = () => {
    onDateRangeChange({
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
    });
  };

  const setLast30Days = () => {
    onDateRangeChange({
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
    });
  };

  const setLast90Days = () => {
    onDateRangeChange({
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* User Info */}
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-blue-500" />
        <div>
          <DialogTitle className="text-xl font-bold text-foreground">
            Token Usage - {userName || userEmail}
          </DialogTitle>
          {userName && (
            <p className="text-sm text-muted-foreground">{userEmail}</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        {/* Date Range Selector */}
        <div className="flex-1 min-w-[300px]">
          <label className="text-sm font-medium text-foreground block mb-1">Date Range</label>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
              className="px-3 py-2 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
              className="px-3 py-2 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Period Type Selector */}
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Period</label>
          <select
            value={periodType}
            onChange={(e) => onPeriodTypeChange(e.target.value as PeriodType)}
            className="px-3 py-2 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {/* Quick Filters */}
        <div className="flex gap-2">
          <button
            onClick={setLast7Days}
            className="px-3 py-2 bg-muted hover:bg-muted/70 text-foreground rounded-lg text-sm transition-colors"
          >
            Last 7 Days
          </button>
          <button
            onClick={setLast30Days}
            className="px-3 py-2 bg-muted hover:bg-muted/70 text-foreground rounded-lg text-sm transition-colors"
          >
            Last 30 Days
          </button>
          <button
            onClick={setLast90Days}
            className="px-3 py-2 bg-muted hover:bg-muted/70 text-foreground rounded-lg text-sm transition-colors"
          >
            Last 90 Days
          </button>
        </div>
      </div>
    </div>
  );
}

