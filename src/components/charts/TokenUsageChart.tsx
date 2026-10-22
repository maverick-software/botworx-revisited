import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TokenUsageRecord } from '../../types/token-usage';

interface TokenUsageChartProps {
  data: TokenUsageRecord[];
  loading: boolean;
  chartType: 'line' | 'bar';
  onChartTypeChange: (type: 'line' | 'bar') => void;
}

export function TokenUsageChart({
  data,
  loading,
  chartType,
  onChartTypeChange,
}: TokenUsageChartProps) {
  // Transform data for Recharts
  const chartData = data.map((record) => ({
    date: new Date(record.periodStart).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    prompt: record.totalPromptTokens,
    completion: record.totalCompletionTokens,
    total: record.totalTokens,
    messages: record.messageCount,
  }));

  const tooltipConfig = {
    contentStyle: {
      backgroundColor: '#1F2937',
      border: '1px solid #374151',
      borderRadius: '8px',
    },
    labelStyle: { color: '#F3F4F6' },
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
      {/* Chart Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-foreground">Token Usage Timeline</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onChartTypeChange('line')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              chartType === 'line'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-muted/70'
            }`}
          >
            Line
          </button>
          <button
            onClick={() => onChartTypeChange('bar')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              chartType === 'bar'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-muted/70'
            }`}
          >
            Bar
          </button>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : data.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          No data available for the selected period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          {chartType === 'line' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
              <Tooltip {...tooltipConfig} />
              <Legend />
              <Line
                type="monotone"
                dataKey="prompt"
                stroke="#3B82F6"
                name="Input Tokens"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="completion"
                stroke="#10B981"
                name="Output Tokens"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
              <Tooltip {...tooltipConfig} />
              <Legend />
              <Bar dataKey="prompt" fill="#3B82F6" name="Input Tokens" />
              <Bar dataKey="completion" fill="#10B981" name="Output Tokens" />
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}

