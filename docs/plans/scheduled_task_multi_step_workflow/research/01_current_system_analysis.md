# Current Scheduled Task System Analysis

## Research Date: August 29, 2025

## Overview
This document analyzes the existing scheduled task system in Agentopia to understand the current architecture, UI workflow, and database schema before implementing multi-step task functionality.

## Current System Architecture

### 1. UI Components Structure
```
TaskManagerModal.tsx (61 lines) - Main orchestrator
├── TaskListModal.tsx (240 lines) - Task display and management
└── TaskWizardModal.tsx (534 lines) - Step-by-step task creation wizard
```

### 2. User Access Flow
- **Entry Point**: AgentChatPage.tsx - Clock icon button in toolbar
- **Modal Trigger**: `setShowTasksModal(true)` opens TaskManagerModal
- **Workflow**: TaskManagerModal → TaskListModal (default) → TaskWizardModal (for creation)

### 3. Task Wizard Steps (Current)
1. **Step 1 - Type Selection**: One-time vs recurring task
2. **Step 2 - Schedule**: Date, time, timezone selection
3. **Step 3 - Recurrence**: Interval configuration (if recurring)
4. **Step 4 - Instructions**: Single task description field
5. **Step 5 - Title**: Task name
6. **Step 6 - Conversation**: Target conversation selection

## Database Schema (Current)

### agent_tasks Table Structure
```typescript
interface AgentTask {
  id: string
  agent_id: string
  user_id: string
  name: string
  description: string | null
  task_type: 'scheduled' | 'event_based'
  status: 'active' | 'paused' | 'completed' | 'failed' | 'cancelled'
  instructions: string                    // SINGLE instruction field
  selected_tools: any[]
  cron_expression: string | null
  timezone: string
  next_run_at: string | null
  last_run_at: string | null
  event_trigger_type: string | null
  event_trigger_config: any
  total_executions: number
  successful_executions: number
  failed_executions: number
  max_executions: number | null
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  conversation_id: UUID                   // Added in recent migration
}
```

### Related Tables
- `agent_task_executions`: Execution history and results
- `conversation_sessions`: Target conversations for task results

## Current Limitations

### 1. Single Instruction Model
- Only one `instructions` field per task
- No ability to break down complex workflows
- No sequential step execution
- No context passing between steps

### 2. UI Constraints
- TaskWizardModal Step 4 only has one textarea for instructions
- No UI for managing multiple steps
- No step-by-step execution visualization

### 3. Execution Model
- task-executor Edge Function executes single instruction
- No step orchestration logic
- No inter-step context management

## Key Files to Modify

### Frontend Components
- `src/components/modals/TaskWizardModal.tsx` - Add step management UI
- `src/types/tasks.ts` - Add step-related interfaces
- `src/lib/utils/taskUtils.ts` - Add step validation utilities

### Backend Components  
- `supabase/functions/agent-tasks/index.ts` - Handle step CRUD operations
- `supabase/functions/task-executor/index.ts` - Add step orchestration
- New migration file for task_steps table

### Database Schema Changes Needed
- New `task_steps` table
- Foreign key relationships
- Step ordering and context management

## Multi-Step Requirements Analysis

### User Story
"As a user, I want to create a scheduled task with multiple sequential steps, where each step has its own instructions and can optionally receive context from the previous step."

### Required Features
1. **Step CRUD Operations** - Add, edit, delete, reorder steps
2. **Context Passing** - Option to include previous step results
3. **Step Execution Orchestration** - Sequential execution with error handling
4. **UI Step Management** - Visual step builder in TaskWizardModal
5. **Database Schema** - Separate task_steps table with relationships

## Technical Constraints

### File Size Limits (Philosophy #1)
- All components must remain ≤500 lines
- TaskWizardModal is already 534 lines (needs refactoring)
- New step management components must be modular

### Existing Patterns
- Modal-based workflows with step-by-step wizards
- Database-driven capabilities via integration_capabilities pattern
- Edge Function routing with parameter validation
- Supabase RLS policies for security

## Next Steps for Implementation
1. Design task_steps database schema
2. Refactor TaskWizardModal for modularity
3. Create step management UI components
4. Implement step orchestration logic
5. Add step execution tracking
6. Update task executor for multi-step handling

## References
- README.md Task Scheduling System section (lines 1922-2168)
- Current TaskWizardModal implementation
- agent-tasks Edge Function schema definition
- Task execution flow in task-executor Edge Function
