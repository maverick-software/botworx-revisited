import React from 'react';
import { Zap, TrendingUp, MessageSquare, Users } from 'lucide-react';
import { StatCard } from './StatCard';
import type { UsageSummary } from '../../types/token-usage';

interface TokenUsageSummaryProps {
  summary: UsageSummary | null;
  loading: boolean;
}

export function TokenUsageSummary({ summary, loading }: TokenUsageSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Tokens Card */}
      <StatCard
        icon={<Zap className="h-5 w-5 text-blue-500" />}
        label="Total Tokens"
        value={summary?.totalTokens.toLocaleString() || '—'}
        subValue={summary ? `↓ ${summary.totalPromptTokens.toLocaleString()} / ↑ ${summary.totalCompletionTokens.toLocaleString()}` : undefined}
        loading={loading}
      />

      {/* Avg Tokens Per Day */}
      <StatCard
        icon={<TrendingUp className="h-5 w-5 text-green-500" />}
        label="Avg Per Day"
        value={summary?.avgTokensPerDay.toLocaleString() || '—'}
        subValue={summary ? `${summary.avgTokensPerMessage} per message` : undefined}
        loading={loading}
      />

      {/* Message Count */}
      <StatCard
        icon={<MessageSquare className="h-5 w-5 text-purple-500" />}
        label="Messages"
        value={summary?.totalMessages.toLocaleString() || '—'}
        subValue={summary ? `${summary.totalConversations} conversations` : undefined}
        loading={loading}
      />

      {/* Unique Agents */}
      <StatCard
        icon={<Users className="h-5 w-5 text-orange-500" />}
        label="Agents Used"
        value={summary?.uniqueAgents || '—'}
        loading={loading}
      />
    </div>
  );
}

