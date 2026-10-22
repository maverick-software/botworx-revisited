import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  loading?: boolean;
}

export function StatCard({ icon, label, value, subValue, loading }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {icon}
      </div>

      {loading ? (
        <div className="h-8 w-24 bg-muted/50 animate-pulse rounded" />
      ) : (
        <>
          <div className="text-2xl font-bold text-foreground">{value}</div>
          {subValue && (
            <div className="text-xs text-muted-foreground mt-1">{subValue}</div>
          )}
        </>
      )}
    </div>
  );
}

