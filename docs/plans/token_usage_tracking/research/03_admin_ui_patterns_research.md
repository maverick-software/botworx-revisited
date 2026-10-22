# Admin UI Patterns Research - Token Usage Tracking

**Research Date**: October 22, 2025  
**Researcher**: AI Assistant  
**Status**: Complete

---

## Objective

Study existing admin UI patterns to ensure the Token Usage Modal maintains consistency with established design patterns, component usage, and user experience.

---

## Reference Components Analyzed

### 1. EditUserRolesModal (`src/components/modals/EditUserRolesModal.tsx`)
### 2. LLMDebugModal (`src/components/modals/LLMDebugModal.tsx`)
### 3. AdminUserManagement Page (`src/pages/AdminUserManagement.tsx`)

---

## Design Patterns and Standards

### A. Modal Structure Pattern

**Common Structure** (from EditUserRolesModal):

```tsx
function TokenUsageModal({ isOpen, onClose, userId, userEmail }: Props) {
  // 1. State declarations
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TokenUsageData | null>(null);
  
  // 2. useEffect for data fetching
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, userId]);
  
  // 3. Helper functions
  const fetchData = async () => { /* ... */ };
  const handleAction = () => { /* ... */ };
  
  // 4. Early return if not open
  if (!isOpen) return null;
  
  // 5. Render modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-[SIZE] border border-gray-700">
        {/* Header */}
        {/* Content */}
        {/* Footer (optional) */}
      </div>
    </div>
  );
}
```

---

### B. Color Scheme & Styling

**Background Colors**:
- Modal overlay: `bg-black bg-opacity-60 backdrop-blur-sm`
- Modal container: `bg-gray-800` or `bg-background`
- Border: `border-gray-700` or `border-border`
- Section separators: `border-b border-gray-700`

**Text Colors**:
- Primary text: `text-white` or `text-foreground`
- Secondary text: `text-gray-400` or `text-muted-foreground`
- Error text: `text-red-400` or `text-destructive`
- Success text: `text-green-400`

**Interactive Elements**:
- Primary button: `bg-indigo-600 hover:bg-indigo-700`
- Secondary button: `bg-gray-600 hover:bg-gray-500`
- Hover states: `hover:bg-gray-700/50`
- Disabled: `disabled:opacity-50 disabled:cursor-not-allowed`

**Modern Approach** (from LLMDebugModal):
```tsx
className="bg-background border border-border rounded-xl shadow-xl"
```
This uses CSS variables from Tailwind config, ensuring theme consistency.

---

### C. Header Pattern

**Standard Header** (from EditUserRolesModal):

```tsx
<div className="flex justify-between items-center p-4 border-b border-gray-700">
  <h2 className="text-xl font-semibold text-white">
    Modal Title with {contextualInfo}
  </h2>
  <button onClick={onClose} className="text-gray-400 hover:text-white">
    <X size={24} />
  </button>
</div>
```

**Enhanced Header** (from LLMDebugModal):

```tsx
<div className="flex items-center justify-between p-6 border-b border-border bg-background">
  <div>
    <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
      <IconComponent className="h-5 w-5 text-primary" />
      Modal Title
    </h2>
    <p className="text-sm text-muted-foreground mt-1">
      Subtitle or description
    </p>
  </div>
  <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
    <X className="h-5 w-5 text-muted-foreground" />
  </button>
</div>
```

**Recommended for Token Usage**: Enhanced header with icon and subtitle

---

### D. Loading States

**Pattern 1**: Simple spinner (EditUserRolesModal)
```tsx
{loading ? (
  <div className="text-center text-gray-400 py-4">
    Loading available roles...
  </div>
) : (
  // content
)}
```

**Pattern 2**: Spinner with animation (EditUserRolesModal - Save button)
```tsx
{isSaving ? (
  <>
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Saving...
  </>
) : (
  'Save Changes'
)}
```

**Pattern 3**: Dedicated loading component (AdminUserManagement)
```tsx
<div className="flex flex-col items-center justify-center">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
  <span>Loading users...</span>
</div>
```

**Recommended**: Pattern 3 for initial load, Pattern 2 for actions

---

### E. Error Handling

**Standard Error Display** (EditUserRolesModal):

```tsx
{error && (
  <div className="mb-4 bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-md flex items-center text-sm">
    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
    <span>{error}</span>
  </div>
)}
```

**Modern Error Display** (AdminUserManagement):

```tsx
{error && (
  <div className="mb-6 bg-destructive/10 border border-destructive/50 text-destructive p-4 rounded-lg flex items-center">
    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
    <span>Error loading users: {error}</span>
  </div>
)}
```

**Key Elements**:
- Semi-transparent background (`bg-red-500/10` or `bg-destructive/10`)
- Colored border
- Alert icon (AlertCircle from lucide-react)
- Flex layout for icon + text

**Recommended**: Modern approach with `destructive` theme colors

---

### F. Data Display Patterns

**Stats Bar** (from LLMDebugModal):

```tsx
<div className="flex items-center gap-6 px-6 py-3 bg-muted/30 border-b border-border text-sm">
  <div className="flex items-center gap-2">
    <Sparkles className="h-4 w-4 text-yellow-500" />
    <span className="text-muted-foreground">Total Stages:</span>
    <span className="font-semibold text-foreground">{displayCalls.length}</span>
  </div>
  <div className="flex items-center gap-2">
    <Zap className="h-4 w-4 text-blue-500" />
    <span className="text-muted-foreground">Total Tokens:</span>
    <span className="font-semibold text-foreground">{totalTokens.toLocaleString()}</span>
    <span className="text-xs text-muted-foreground">
      (<span className="text-blue-400">↓{totalInputTokens}</span> / <span className="text-green-400">↑{totalOutputTokens}</span>)
    </span>
  </div>
  <div className="flex items-center gap-2">
    <Brain className="h-4 w-4 text-green-500" />
    <span className="text-muted-foreground">Total Time:</span>
    <span className="font-semibold text-foreground">{totalDuration}ms</span>
  </div>
</div>
```

**Key Features**:
- Icon + Label + Value pattern
- Color-coded icons for visual distinction
- Number formatting (`toLocaleString()` for large numbers)
- Secondary info in smaller, muted text

---

### G. Expandable Sections

**Pattern** (from LLMDebugModal):

```tsx
const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());

const toggleStage = (stage: string) => {
  setExpandedStages(prev => {
    const newSet = new Set(prev);
    if (newSet.has(stage)) {
      newSet.delete(stage);
    } else {
      newSet.add(stage);
    }
    return newSet;
  });
};

// Render:
<button
  onClick={() => toggleStage(call.stage)}
  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
>
  <div className="flex items-center gap-3">
    {isExpanded ? (
      <ChevronDown className="h-5 w-5 text-muted-foreground" />
    ) : (
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    )}
    <span className="font-semibold text-foreground">Stage Title</span>
  </div>
  <div className="flex items-center gap-4 text-sm">
    {/* Summary info */}
  </div>
</button>

{isExpanded && (
  <div className="border-t border-border">
    {/* Expanded content */}
  </div>
)}
```

**Benefits**:
- Clean, collapsible UI for large datasets
- Preserves vertical space
- Clear visual indicators (chevrons)
- Hover effects for interactivity

---

### H. Modal Sizing

**Size Guidelines**:
- **Small**: `max-w-md` (448px) - Simple forms, confirmations
- **Medium**: `max-w-2xl` (672px) - EditUserRolesModal
- **Large**: `max-w-5xl` (1024px) - Token Usage Modal (recommended)
- **Extra Large**: `max-w-7xl` (1280px) - LLMDebugModal (data-heavy)

**Height Constraint**:
```tsx
className="max-h-[90vh] overflow-hidden flex flex-col"
```

**Scrollable Content**:
```tsx
<div className="flex-1 overflow-y-auto p-6">
  {/* Content */}
</div>
```

---

### I. Icon Usage

**Icons from lucide-react**:

Common icons for admin modals:
- `X` - Close button
- `AlertCircle` - Errors
- `Users` - User-related
- `BarChart3` or `TrendingUp` - Analytics, stats (recommended for Token Usage)
- `Activity` - Usage/activity metrics
- `Zap` - Token/performance metrics
- `Calendar` - Time periods

**Pattern**:
```tsx
import { BarChart3, Activity, TrendingUp, X, AlertCircle } from 'lucide-react';

<BarChart3 className="h-5 w-5 text-primary" />
```

---

### J. Button Patterns

**Primary Action** (Save, Confirm):
```tsx
<button
  onClick={handleAction}
  disabled={isLoading || hasError}
  className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait flex items-center"
>
  {isLoading ? (
    <>
      <Loader className="animate-spin -ml-1 mr-3 h-5 w-5" />
      Loading...
    </>
  ) : (
    'Action Label'
  )}
</button>
```

**Secondary Action** (Cancel, Close):
```tsx
<button
  onClick={onClose}
  disabled={isLoading}
  className="px-4 py-2 rounded-md bg-gray-600 text-gray-200 hover:bg-gray-500 disabled:opacity-50"
>
  Cancel
</button>
```

**Icon Button** (Actions in table):
```tsx
<button
  onClick={() => handleEdit(item)}
  className="text-primary hover:text-primary/80 p-1.5 rounded-md hover:bg-muted transition-colors"
  title="View Token Usage"
>
  <BarChart3 size={16} />
</button>
```

---

### K. Table Action Integration

**Pattern** (from AdminUserManagement):

```tsx
<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
  <div className="flex items-center gap-2">
    <button 
      onClick={() => handleEditClick(user)} 
      className="text-primary hover:text-primary/80 p-1.5 rounded-md hover:bg-muted transition-colors"
      title="Edit Roles"
    >
      <Edit size={16} />
    </button>
    <button 
      onClick={() => handleTokenUsageClick(user)} 
      className="text-blue-500 hover:text-blue-400 p-1.5 rounded-md hover:bg-muted transition-colors"
      title="View Token Usage"
    >
      <BarChart3 size={16} />
    </button>
    <button 
      onClick={() => handleStatusActionClick(user, 'suspend')} 
      className="text-destructive hover:text-destructive/80 p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
      title="Suspend User"
    >
      <Ban size={16} />
    </button>
  </div>
</td>
```

**Key Features**:
- Icon-only buttons (compact)
- Tooltips via `title` attribute
- Color coding by action type
- Hover effects for clarity
- Gap spacing between buttons

---

## Recommended Token Usage Modal Design

### Component Structure

```tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, BarChart3, Activity, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';

interface TokenUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
}

interface TokenUsageData {
  currentPeriod: {
    daily: { tokens: number; messages: number; conversations: number };
    weekly: { tokens: number; messages: number; conversations: number };
    monthly: { tokens: number; messages: number; conversations: number };
  };
  historicalData: Array<{
    date: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  }>;
  breakdown: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

export function TokenUsageModal({ isOpen, onClose, userId, userEmail }: TokenUsageModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TokenUsageData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  
  useEffect(() => {
    if (isOpen) {
      fetchTokenUsage();
    }
  }, [isOpen, userId]);
  
  const fetchTokenUsage = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: usageData, error: fetchError } = await supabase.functions.invoke(
        'admin-get-user-token-usage',
        { body: { userId, period: 'all' } }
      );
      
      if (fetchError) throw fetchError;
      setData(usageData);
    } catch (err: any) {
      console.error('Error fetching token usage:', err);
      setError(err.message || 'Failed to load token usage data');
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Token Usage - {userEmail}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              View LLM token consumption and usage analytics
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        
        {/* Stats Bar */}
        {!loading && data && (
          <div className="flex items-center gap-6 px-6 py-3 bg-muted/30 border-b border-border text-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <span className="text-muted-foreground">Total Tokens:</span>
              <span className="font-semibold text-foreground">
                {data.breakdown.total_tokens.toLocaleString()}
              </span>
            </div>
            {/* ... more stats */}
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 bg-destructive/10 border border-destructive/50 text-destructive p-4 rounded-lg flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span>Error: {error}</span>
            </div>
          )}
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="animate-spin h-8 w-8 text-primary mb-2" />
              <span className="text-muted-foreground">Loading token usage data...</span>
            </div>
          ) : data ? (
            <>
              {/* Period Selector */}
              {/* Chart */}
              {/* Detailed Breakdown */}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No token usage data available
            </div>
          )}
        </div>
        
        {/* Footer (optional) */}
        <div className="flex justify-end p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-600 text-gray-200 hover:bg-gray-500"
          >
            Close
          </button>
        </div>
        
      </div>
    </div>
  );
}
```

---

## Key Takeaways for Implementation

### ✅ Use Modern CSS Variables
- `bg-background`, `text-foreground`, `border-border`
- `text-muted-foreground`, `bg-muted`
- `text-primary`, `bg-primary`
- `text-destructive`, `bg-destructive`

### ✅ Consistent Spacing
- Padding: `p-4` (16px) or `p-6` (24px)
- Gaps: `gap-2` (8px), `gap-4` (16px), `gap-6` (24px)
- Margins: `mb-4`, `mt-2`, etc.

### ✅ Interactive States
- Always include hover states
- Disable states with opacity and cursor changes
- Loading states with spinners
- Transitions for smooth UX

### ✅ Accessibility
- Icon buttons need `title` attributes (tooltips)
- Proper semantic HTML
- Keyboard navigation support (buttons, not divs)
- ARIA labels where appropriate

### ✅ Responsive Design
- Use `max-w-*` for modal sizing
- `max-h-[90vh]` for height constraint
- `overflow-y-auto` for scrollable content
- Flex layouts for adaptability

---

## Files to Reference During Implementation

1. **Modal Pattern**: `src/components/modals/EditUserRolesModal.tsx`
2. **Data Display**: `src/components/modals/LLMDebugModal.tsx`
3. **Table Integration**: `src/pages/AdminUserManagement.tsx`
4. **UI Components**: `src/components/ui/*` (Shadcn/UI library)

---

## Next Steps for UI Implementation

1. Create `TokenUsageModal.tsx` following the recommended structure
2. Add button to `AdminUserManagement.tsx` table actions
3. Implement modal state management in parent component
4. Integrate chart library (Research Phase 1.6)
5. Connect to Edge Function for data fetching (Research Phase 1.4)

---

**Research Complete**: ✅  
**Recommended Modal Size**: `max-w-5xl` (1024px width)  
**Recommended Icon**: `<BarChart3>` or `<Activity>` from lucide-react  
**Recommended Color**: `text-blue-500` for token metrics


