# Frontend Component Architecture - Token Usage Tracking

**Planning Date**: October 22, 2025  
**Status**: Complete  
**Phase**: Planning (2.3)

---

## Objective

Design a comprehensive React component architecture for the token usage tracking UI on the Admin User Management page, including component hierarchy, data flow, state management, and integration with existing UI patterns.

---

## UI Location

**Parent Component**: `src/pages/AdminUserManagement.tsx`  
**New Modal**: `TokenUsageModal` (opens from "View Usage" button in user table)

---

## Component Hierarchy

```
AdminUserManagement
├── EditUserRolesModal (existing)
├── ConfirmationModal (existing)
└── TokenUsageModal (NEW) ✨
    ├── TokenUsageHeader
    │   ├── User Info Display
    │   ├── Date Range Selector
    │   └── Period Type Selector (Daily/Weekly/Monthly)
    ├── TokenUsageSummary
    │   ├── TotalTokensCard
    │   ├── AvgTokensCard
    │   ├── MessageCountCard
    │   └── ConversationCountCard
    ├── TokenUsageChart
    │   └── Recharts LineChart/BarChart
    ├── TokenUsageTable
    │   ├── Table Headers
    │   ├── Table Rows
    │   └── Pagination Controls
    └── TokenUsageFooter
        ├── Export Button (CSV)
        ├── Refresh Button
        └── Close Button
```

---

## Component Design Specifications

### 1. `TokenUsageModal.tsx`

**Purpose**: Main modal container for viewing user token usage

**Props**:
```typescript
interface TokenUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  userName?: string;
}
```

**State Management**:
```typescript
interface TokenUsageModalState {
  // Data
  usage: TokenUsageRecord[];
  summary: UsageSummary | null;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // Filters
  dateRange: {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
  };
  periodType: 'daily' | 'weekly' | 'monthly';
  
  // Pagination
  currentPage: number;
  totalRecords: number;
  
  // Sorting
  sortBy: 'period_start' | 'total_tokens' | 'message_count';
  sortOrder: 'asc' | 'desc';
}
```

**Key Features**:
- Auto-loads data when modal opens
- Default date range: Last 30 days
- Default period: Daily
- Responsive layout (works on all screen sizes)
- Error handling with retry button
- Loading skeleton states

**Layout**:
```tsx
<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
    <DialogHeader>
      <TokenUsageHeader {...headerProps} />
    </DialogHeader>
    
    <div className="flex flex-col gap-6 overflow-auto">
      <TokenUsageSummary summary={summary} loading={isLoading} />
      <TokenUsageChart data={usage} loading={isLoading} />
      <TokenUsageTable data={usage} loading={isLoading} {...tableProps} />
    </div>
    
    <DialogFooter>
      <TokenUsageFooter {...footerProps} />
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**File Location**: `src/components/modals/TokenUsageModal.tsx`

---

### 2. `TokenUsageHeader.tsx`

**Purpose**: Display user info and filter controls

**Props**:
```typescript
interface TokenUsageHeaderProps {
  userEmail: string;
  userName?: string;
  dateRange: { start: string; end: string };
  periodType: 'daily' | 'weekly' | 'monthly';
  onDateRangeChange: (range: { start: string; end: string }) => void;
  onPeriodTypeChange: (type: 'daily' | 'weekly' | 'monthly') => void;
}
```

**Layout**:
```tsx
<div className="flex flex-col gap-4">
  {/* User Info */}
  <div className="flex items-center gap-3">
    <Zap className="h-6 w-6 text-blue-500" />
    <div>
      <h2 className="text-xl font-bold text-foreground">
        Token Usage - {userName || userEmail}
      </h2>
      <p className="text-sm text-muted-foreground">{userEmail}</p>
    </div>
  </div>
  
  {/* Filters */}
  <div className="flex gap-4 items-end">
    {/* Date Range Selector */}
    <div className="flex-1">
      <label className="text-sm font-medium">Date Range</label>
      <div className="flex gap-2">
        <input type="date" value={dateRange.start} ... />
        <span className="self-center">to</span>
        <input type="date" value={dateRange.end} ... />
      </div>
    </div>
    
    {/* Period Type Selector */}
    <div>
      <label className="text-sm font-medium">Period</label>
      <select value={periodType} onChange={...}>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
    </div>
    
    {/* Quick Filters */}
    <div className="flex gap-2">
      <button onClick={() => setLast7Days()}>Last 7 Days</button>
      <button onClick={() => setLast30Days()}>Last 30 Days</button>
      <button onClick={() => setLast90Days()}>Last 90 Days</button>
    </div>
  </div>
</div>
```

**File Location**: `src/components/admin/TokenUsageHeader.tsx`

---

### 3. `TokenUsageSummary.tsx`

**Purpose**: Display key metrics in card format

**Props**:
```typescript
interface TokenUsageSummaryProps {
  summary: UsageSummary | null;
  loading: boolean;
}
```

**Layout**:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Total Tokens Card */}
  <StatCard
    icon={<Zap className="h-5 w-5 text-blue-500" />}
    label="Total Tokens"
    value={summary?.totalTokens.toLocaleString() || '—'}
    subValue={`↓ ${summary?.totalPromptTokens} / ↑ ${summary?.totalCompletionTokens}`}
    loading={loading}
  />
  
  {/* Avg Tokens Per Day */}
  <StatCard
    icon={<TrendingUp className="h-5 w-5 text-green-500" />}
    label="Avg Per Day"
    value={summary?.avgTokensPerDay.toLocaleString() || '—'}
    loading={loading}
  />
  
  {/* Message Count */}
  <StatCard
    icon={<MessageSquare className="h-5 w-5 text-purple-500" />}
    label="Messages"
    value={summary?.totalMessages.toLocaleString() || '—'}
    subValue={`${summary?.totalConversations} conversations`}
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
```

**File Location**: `src/components/admin/TokenUsageSummary.tsx`

---

### 4. `StatCard.tsx`

**Purpose**: Reusable card component for displaying metrics

**Props**:
```typescript
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  loading?: boolean;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}
```

**Layout**:
```tsx
<div className="bg-card border border-border rounded-lg p-4 shadow-sm">
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
      {trend && (
        <div className={`flex items-center gap-1 text-xs mt-2 ${getTrendColor(trend)}`}>
          {getTrendIcon(trend)}
          <span>{trendValue}</span>
        </div>
      )}
    </>
  )}
</div>
```

**File Location**: `src/components/admin/StatCard.tsx`

---

### 5. `TokenUsageChart.tsx`

**Purpose**: Visualize token usage over time using Recharts

**Props**:
```typescript
interface TokenUsageChartProps {
  data: TokenUsageRecord[];
  loading: boolean;
  chartType: 'line' | 'bar';
  onChartTypeChange: (type: 'line' | 'bar') => void;
}
```

**Chart Data Format**:
```typescript
const chartData = data.map(record => ({
  date: formatDate(record.periodStart), // "Oct 22" or "2025-10-22"
  prompt: record.totalPromptTokens,
  completion: record.totalCompletionTokens,
  total: record.totalTokens,
  messages: record.messageCount,
}));
```

**Layout**:
```tsx
<div className="bg-card border border-border rounded-lg p-4 shadow-sm">
  {/* Chart Header */}
  <div className="flex justify-between items-center mb-4">
    <h3 className="text-lg font-semibold text-foreground">Token Usage Timeline</h3>
    <div className="flex gap-2">
      <button 
        onClick={() => onChartTypeChange('line')}
        className={chartType === 'line' ? 'active' : ''}
      >
        Line
      </button>
      <button 
        onClick={() => onChartTypeChange('bar')}
        className={chartType === 'bar' ? 'active' : ''}
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
          <XAxis 
            dataKey="date" 
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1F2937', 
              border: '1px solid #374151',
              borderRadius: '8px'
            }}
            labelStyle={{ color: '#F3F4F6' }}
          />
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
          <XAxis dataKey="date" stroke="#9CA3AF" />
          <YAxis stroke="#9CA3AF" />
          <Tooltip {...tooltipConfig} />
          <Legend />
          <Bar dataKey="prompt" fill="#3B82F6" name="Input Tokens" />
          <Bar dataKey="completion" fill="#10B981" name="Output Tokens" />
        </BarChart>
      )}
    </ResponsiveContainer>
  )}
</div>
```

**File Location**: `src/components/charts/TokenUsageChart.tsx`

---

### 6. `TokenUsageTable.tsx`

**Purpose**: Display detailed token usage records in table format

**Props**:
```typescript
interface TokenUsageTableProps {
  data: TokenUsageRecord[];
  loading: boolean;
  sortBy: 'period_start' | 'total_tokens' | 'message_count';
  sortOrder: 'asc' | 'desc';
  onSort: (field: 'period_start' | 'total_tokens' | 'message_count') => void;
  currentPage: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
}
```

**Layout**:
```tsx
<div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-border">
      <thead className="bg-muted/50">
        <tr>
          <th onClick={() => onSort('period_start')} className="sortable">
            Date
            <SortIcon field="period_start" currentSort={sortBy} order={sortOrder} />
          </th>
          <th onClick={() => onSort('total_tokens')} className="sortable">
            Total Tokens
            <SortIcon field="total_tokens" currentSort={sortBy} order={sortOrder} />
          </th>
          <th>Input Tokens</th>
          <th>Output Tokens</th>
          <th onClick={() => onSort('message_count')} className="sortable">
            Messages
            <SortIcon field="message_count" currentSort={sortBy} order={sortOrder} />
          </th>
          <th>Conversations</th>
          <th>Agents Used</th>
        </tr>
      </thead>
      <tbody className="bg-card divide-y divide-border">
        {loading ? (
          <tr>
            <td colSpan={7} className="text-center py-12">
              <LoadingSpinner />
            </td>
          </tr>
        ) : data.length === 0 ? (
          <tr>
            <td colSpan={7} className="text-center py-12 text-muted-foreground">
              No usage data found for this period
            </td>
          </tr>
        ) : (
          data.map(record => (
            <tr key={record.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-6 py-4">
                <div className="text-sm font-medium text-foreground">
                  {formatDate(record.periodStart)}
                </div>
                <div className="text-xs text-muted-foreground">
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
                <AgentsList agentIds={record.agentIds} />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
  
  {/* Pagination */}
  <div className="bg-muted/30 px-6 py-3 flex items-center justify-between border-t border-border">
    <div className="text-sm text-muted-foreground">
      Showing {((currentPage - 1) * PER_PAGE) + 1} - {Math.min(currentPage * PER_PAGE, totalRecords)} of {totalRecords}
    </div>
    <div className="flex gap-2">
      <button 
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="pagination-button"
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </button>
      <button 
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= Math.ceil(totalRecords / PER_PAGE)}
        className="pagination-button"
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  </div>
</div>
```

**File Location**: `src/components/admin/TokenUsageTable.tsx`

---

### 7. `AgentsList.tsx`

**Purpose**: Display agent names/avatars in table cell

**Props**:
```typescript
interface AgentsListProps {
  agentIds: string[];
  maxDisplay?: number; // Default: 3
}
```

**Layout**:
```tsx
<div className="flex items-center gap-1">
  {agentIds.slice(0, maxDisplay).map(agentId => (
    <AgentAvatar key={agentId} agentId={agentId} size="sm" />
  ))}
  {agentIds.length > maxDisplay && (
    <span className="text-xs text-muted-foreground ml-1">
      +{agentIds.length - maxDisplay} more
    </span>
  )}
</div>
```

**File Location**: `src/components/admin/AgentsList.tsx`

---

### 8. `TokenUsageFooter.tsx`

**Purpose**: Action buttons at bottom of modal

**Props**:
```typescript
interface TokenUsageFooterProps {
  onExportCSV: () => void;
  onRefresh: () => void;
  onClose: () => void;
  isExporting: boolean;
  isRefreshing: boolean;
}
```

**Layout**:
```tsx
<div className="flex justify-between items-center">
  <div className="flex gap-2">
    <button 
      onClick={onExportCSV}
      disabled={isExporting}
      className="btn-secondary"
    >
      {isExporting ? (
        <>
          <Loader className="h-4 w-4 animate-spin mr-2" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </>
      )}
    </button>
    
    <button 
      onClick={onRefresh}
      disabled={isRefreshing}
      className="btn-secondary"
    >
      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
    </button>
  </div>
  
  <button onClick={onClose} className="btn-primary">
    Close
  </button>
</div>
```

**File Location**: `src/components/admin/TokenUsageFooter.tsx`

---

## Custom Hooks

### `useTokenUsage.ts`

**Purpose**: Centralize all token usage data fetching and state management

```typescript
interface UseTokenUsageOptions {
  userId: string;
  dateRange: { start: string; end: string };
  periodType: 'daily' | 'weekly' | 'monthly';
  sortBy: 'period_start' | 'total_tokens' | 'message_count';
  sortOrder: 'asc' | 'desc';
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
  exportCSV: () => Promise<void>;
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
      
      setUsage(data.data.usage);
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
  }, [options]);
  
  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);
  
  const exportCSV = async () => {
    // Implementation for CSV export
  };
  
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
```

**File Location**: `src/hooks/useTokenUsage.ts`

---

## State Management Flow

```
User Opens Modal
       ↓
TokenUsageModal Component Mounts
       ↓
useTokenUsage Hook Initializes
       ↓
Fetch Data from Edge Function (get-user-token-usage)
       ↓
       ├─→ Success: Update usage, summary, totalRecords
       │       ↓
       │   Render Charts & Tables
       │
       └─→ Error: Display error message with retry button
       
User Changes Filters (Date Range, Period Type)
       ↓
Update State
       ↓
useTokenUsage Refetches (triggered by useEffect dependencies)
       ↓
UI Updates with New Data
```

---

## Integration with AdminUserManagement.tsx

### Add "View Usage" Button to Table

```tsx
// In AdminUserManagement.tsx
import { TokenUsageModal } from '../components/modals/TokenUsageModal';
import { Zap } from 'lucide-react';

// Add state
const [isTokenUsageModalOpen, setIsTokenUsageModalOpen] = useState(false);
const [selectedUserForUsage, setSelectedUserForUsage] = useState<AdminUser | null>(null);

// Add button handler
const handleViewUsage = (user: AdminUser) => {
  setSelectedUserForUsage(user);
  setIsTokenUsageModalOpen(true);
};

const handleCloseTokenUsageModal = () => {
  setIsTokenUsageModalOpen(false);
  setSelectedUserForUsage(null);
};

// Add button to table actions column (around line 280)
<td className="px-6 py-4 text-sm">
  <div className="flex items-center gap-2">
    {/* Existing Edit button */}
    <button onClick={() => handleEditClick(user)} ...>
      <Edit className="w-4 h-4" />
      Edit Roles
    </button>
    
    {/* NEW: View Usage button */}
    <button 
      onClick={() => handleViewUsage(user)}
      className="text-blue-500 hover:text-blue-600 transition-colors flex items-center gap-1"
    >
      <Zap className="w-4 h-4" />
      View Usage
    </button>
    
    {/* Existing Suspend/Reactivate buttons */}
  </div>
</td>

// Render modal at bottom (around line 350)
{selectedUserForUsage && (
  <TokenUsageModal
    isOpen={isTokenUsageModalOpen}
    onClose={handleCloseTokenUsageModal}
    userId={selectedUserForUsage.id}
    userEmail={selectedUserForUsage.email}
    userName={selectedUserForUsage.full_name}
  />
)}
```

---

## Styling Guidelines

### Color Palette (Matches Existing Theme)

```typescript
// Token Usage Theme
const colors = {
  // Input tokens
  input: '#3B82F6',      // blue-500
  inputLight: '#93C5FD', // blue-300
  
  // Output tokens
  output: '#10B981',     // green-500
  outputLight: '#6EE7B7',// green-300
  
  // Total tokens
  total: '#8B5CF6',      // purple-500
  totalLight: '#C4B5FD', // purple-300
  
  // Background
  cardBg: 'bg-card',
  modalBg: 'bg-background',
  
  // Borders
  border: 'border-border',
  
  // Text
  foreground: 'text-foreground',
  muted: 'text-muted-foreground',
};
```

### Tailwind Classes

```css
/* Modal */
.token-usage-modal {
  @apply max-w-6xl max-h-[90vh] overflow-hidden bg-background;
}

/* Cards */
.stat-card {
  @apply bg-card border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow;
}

/* Chart Container */
.chart-container {
  @apply bg-card border border-border rounded-lg p-4 shadow-sm;
}

/* Table */
.token-usage-table {
  @apply min-w-full divide-y divide-border;
}

.token-usage-table th {
  @apply px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider;
}

.token-usage-table td {
  @apply px-6 py-4 whitespace-nowrap text-sm;
}

/* Buttons */
.btn-primary {
  @apply px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors;
}

.btn-secondary {
  @apply px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/70 transition-colors;
}

/* Pagination */
.pagination-button {
  @apply px-3 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}
```

---

## Responsive Design Breakpoints

```typescript
// Breakpoints
const breakpoints = {
  sm: '640px',   // Mobile
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large Desktop
};

// Responsive adjustments
// - Mobile: Stack summary cards vertically, hide chart, show simplified table
// - Tablet: 2-column summary, show chart, full table
// - Desktop: 4-column summary, show chart, full table with all columns
```

**Mobile Layout**:
```tsx
<div className="flex flex-col gap-4">
  <TokenUsageSummary /> {/* Stacked vertically */}
  <div className="lg:block hidden">
    <TokenUsageChart /> {/* Hidden on mobile */}
  </div>
  <TokenUsageTable /> {/* Simplified on mobile */}
</div>
```

---

## Error States

### Error Display

```tsx
{error && (
  <div className="bg-destructive/10 border border-destructive/50 text-destructive p-4 rounded-lg flex items-center justify-between">
    <div className="flex items-center gap-2">
      <AlertCircle className="h-5 w-5 flex-shrink-0" />
      <span>{error}</span>
    </div>
    <button onClick={refetch} className="btn-secondary">
      Retry
    </button>
  </div>
)}
```

### Loading States

```tsx
// Summary Cards
{loading && (
  <div className="h-20 bg-muted/50 animate-pulse rounded-lg" />
)}

// Chart
{loading && (
  <div className="h-[300px] flex items-center justify-center">
    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
  </div>
)}

// Table
{loading && (
  <tr>
    <td colSpan={7} className="text-center py-12">
      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
      <p className="mt-4 text-muted-foreground">Loading usage data...</p>
    </td>
  </tr>
)}
```

### Empty States

```tsx
{!loading && usage.length === 0 && (
  <div className="text-center py-12">
    <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
    <p className="text-foreground font-medium mb-2">No Usage Data Found</p>
    <p className="text-muted-foreground text-sm">
      This user hasn't generated any token usage in the selected period.
    </p>
  </div>
)}
```

---

## CSV Export Functionality

```typescript
async function exportToCSV(usage: TokenUsageRecord[], userEmail: string) {
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
    formatDate(record.periodStart),
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
  a.download = `token-usage-${userEmail}-${Date.now()}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}
```

---

## Testing Strategy

### Unit Tests

- Test `useTokenUsage` hook with mocked API responses
- Test date range calculations
- Test sort functionality
- Test pagination logic

### Integration Tests

- Test modal open/close flow
- Test filter changes triggering refetch
- Test error handling and retry
- Test CSV export

### Visual Tests

- Test responsive layout on mobile/tablet/desktop
- Test dark mode compatibility
- Test loading states
- Test empty states

---

## Accessibility (a11y)

- Modal has `role="dialog"` and `aria-labelledby`
- All buttons have clear labels
- Table has proper `<th>` headers
- Color is not the only way to convey information (use icons + text)
- Keyboard navigation works (Tab, Enter, Escape)
- Focus trap in modal
- Screen reader friendly

---

**Frontend Design Complete**: ✅  
**Component Hierarchy**: Defined  
**Data Flow**: Mapped  
**UI Patterns**: Consistent with existing design

