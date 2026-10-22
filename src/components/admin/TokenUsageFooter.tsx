import React from 'react';
import { Download, RefreshCw } from 'lucide-react';

interface TokenUsageFooterProps {
  onExportCSV: () => void;
  onRefresh: () => void;
  onClose: () => void;
  isExporting: boolean;
  isRefreshing: boolean;
}

export function TokenUsageFooter({
  onExportCSV,
  onRefresh,
  onClose,
  isExporting,
  isRefreshing,
}: TokenUsageFooterProps) {
  return (
    <div className="flex justify-between items-center">
      <div className="flex gap-2">
        <button
          onClick={onExportCSV}
          disabled={isExporting}
          className="px-4 py-2 bg-muted hover:bg-muted/70 text-foreground rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 bg-muted hover:bg-muted/70 text-foreground rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <button
        onClick={onClose}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
      >
        Close
      </button>
    </div>
  );
}

