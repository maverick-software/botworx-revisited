decryption system# Multi-Step Scheduled Task Workflow Implementation Plan

## Project Overview

**Goal**: Enhance the existing Scheduled Tasks system in Agentopia to support multi-step workflows where users can add sequential steps with individual instructions and optional context passing between steps.

**Current System**: Single-instruction scheduled tasks with basic wizard interface
**Target System**: Multi-step workflow with full CRUD operations for steps and context management

## Proposed File Structure

### 1. Database Schema Changes

**New Files to Create:**
```
supabase/migrations/
├── 20250829_120000_create_task_steps_table.sql          (~150 lines)
├── 20250829_120001_migrate_existing_tasks_to_steps.sql  (~100 lines)
└── 20250829_120002_add_task_steps_functions.sql         (~200 lines)
```

**Files to Update:**
```
src/types/database.types.ts                              (+50 lines for task_steps)
```

### 2. Frontend Component Structure

**New Components to Create:**
```
src/components/modals/task-steps/
├── StepManager.tsx                                      (~280 lines)
├── StepEditor.tsx                                       (~250 lines)
├── StepList.tsx                                         (~200 lines)
├── StepCard.tsx                                         (~180 lines)
├── ContextToggle.tsx                                    (~120 lines)
├── StepReorderControls.tsx                             (~150 lines)
└── types/
    └── step-types.ts                                    (~100 lines)
```

**Files to Refactor/Update:**
```
src/components/modals/TaskWizardModal.tsx               (534→300 lines, extract step logic)
src/components/modals/TaskListModal.tsx                 (+50 lines for step display)
src/types/tasks.ts                                      (+80 lines for step interfaces)
```

### 3. Backend Edge Function Updates

**Files to Update:**
```
supabase/functions/agent-tasks/index.ts                 (+200 lines for step CRUD)
supabase/functions/task-executor/index.ts               (+300 lines for step orchestration)
```

**New Files to Create:**
```
supabase/functions/task-steps/
├── index.ts                                            (~250 lines)
└── step-executor.ts                                    (~200 lines)
```

### 4. Utility and Hook Files

**New Files to Create:**
```
src/hooks/
├── useTaskSteps.ts                                     (~200 lines)
└── useStepValidation.ts                                (~150 lines)

src/lib/utils/
├── stepUtils.ts                                        (~180 lines)
└── contextUtils.ts                                     (~120 lines)
```

## Architecture Design

### 1. Database Schema

**Core Tables:**
- `agent_tasks` (existing) - Parent task container
- `task_steps` (new) - Individual workflow steps
- `task_step_executions` (new) - Step execution history

**Key Relationships:**
- One-to-many: agent_tasks → task_steps
- One-to-many: task_steps → task_step_executions
- Foreign key cascading for data integrity

### 2. Component Hierarchy

```
TaskWizardModal (refactored)
├── [Existing Steps 1-3: Type, Schedule, Recurrence]
├── StepManager (new Step 4)
│   ├── StepList
│   │   └── StepCard (per step)
│   │       ├── StepEditor
│   │       ├── ContextToggle
│   │       └── StepReorderControls
│   └── [Add Step Button]
├── [Existing Steps 5-6: Title, Conversation]
```

### 3. Data Flow

**Step Creation Flow:**
1. User creates task in wizard
2. Step 4 opens StepManager
3. User adds/edits steps via StepEditor
4. Context options set via ContextToggle
5. Steps validated and saved to database

**Step Execution Flow:**
1. task-executor triggers scheduled task
2. Retrieves all steps for task in order
3. Executes steps sequentially
4. Passes context between steps if enabled
5. Records step-level results and status

### 4. API Endpoints

**New Endpoints:**
- `POST /task-steps` - Create new step
- `GET /task-steps/:taskId` - Get all steps for task
- `PUT /task-steps/:stepId` - Update step
- `DELETE /task-steps/:stepId` - Delete step
- `PUT /task-steps/:taskId/reorder` - Reorder steps

## UI/UX Design Specifications

### 1. Step Manager Interface
- **Layout**: Vertical step list with drag-and-drop reordering
- **Step Cards**: Collapsible cards showing step name and instructions
- **Add Button**: Prominent "Add Step" button at bottom of list
- **Validation**: Real-time validation feedback for step requirements

### 2. Step Editor Modal
- **Fields**: Step name, instructions (textarea), context toggle
- **Validation**: Required field indicators, character limits
- **Actions**: Save, Cancel, Delete buttons
- **Preview**: Context preview showing what data will be passed

### 3. Context Management
- **Toggle Switch**: Enable/disable context from previous step
- **Preview Panel**: Show sample context data structure
- **Custom Context**: Advanced option for context filtering (future)

## Technical Constraints

### 1. File Size Limits (Philosophy #1)
- All new components must be ≤300 lines
- TaskWizardModal requires refactoring to stay under 500 lines
- Modular design with single responsibility per component

### 2. Database Performance
- Efficient indexing on (task_id, step_order)
- JSONB for flexible context storage
- Pagination for tasks with many steps

### 3. Security Requirements
- Row-level security for step access
- User permission validation
- Context data sanitization
- Audit logging for step modifications

## Implementation Phases

### Phase 1: Database Foundation
1. Create task_steps table and relationships
2. Migrate existing single-instruction tasks
3. Add database functions for step operations
4. Update type definitions

### Phase 2: Core UI Components
1. Create step management components
2. Refactor TaskWizardModal for modularity
3. Implement step CRUD operations
4. Add validation and error handling

### Phase 3: Backend Integration
1. Update agent-tasks Edge Function
2. Enhance task-executor for step orchestration
3. Implement context passing mechanisms
4. Add step execution tracking

### Phase 4: Testing & Refinement
1. Unit tests for all components
2. Integration tests for step workflows
3. Performance optimization
4. User acceptance testing

## Success Criteria

### 1. Functional Requirements
- ✅ Users can add/edit/delete/reorder steps in tasks
- ✅ Steps execute sequentially with proper error handling
- ✅ Context passing works between steps when enabled
- ✅ Full CRUD operations available via UI
- ✅ Backward compatibility with existing tasks

### 2. Technical Requirements
- ✅ All components under 300 lines (Philosophy #1)
- ✅ Database queries optimized for performance
- ✅ Proper error handling and user feedback
- ✅ Security policies enforced at all levels
- ✅ Mobile-responsive design

### 3. User Experience
- ✅ Intuitive step management interface
- ✅ Clear visual feedback for step status
- ✅ Smooth drag-and-drop reordering
- ✅ Helpful validation messages
- ✅ Context preview functionality

## Risk Mitigation

### 1. Technical Risks
- **TaskWizardModal complexity**: Refactor into smaller components
- **Database migration**: Careful testing with backup procedures
- **Performance impact**: Efficient queries and caching strategies

### 2. User Experience Risks
- **Overwhelming interface**: Progressive disclosure of advanced features
- **Data loss**: Auto-save and draft functionality
- **Confusion**: Clear documentation and tooltips

### 3. Compatibility Risks
- **Existing tasks**: Seamless migration to step-based model
- **API changes**: Maintain backward compatibility where possible
- **Mobile usability**: Responsive design testing

## File Size Compliance Summary

All proposed files adhere to the 200-300 line maximum:
- Database migrations: 100-200 lines each
- React components: 120-280 lines each
- Edge functions: 200-300 lines each
- Utility files: 120-200 lines each
- Type definitions: 50-100 lines each

Total estimated lines: ~3,500 new lines across 25 files
Refactored lines: ~300 lines in existing files
