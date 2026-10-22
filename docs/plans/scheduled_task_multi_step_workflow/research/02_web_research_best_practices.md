# Multi-Step Workflow Database Design Best Practices

## Research Date: August 29, 2025

## Web Research Summary

### Key Findings from Industry Best Practices

#### 1. Database Schema Patterns

**Parent-Child Relationship Pattern**
- Primary table: `agent_tasks` (existing)
- Child table: `task_steps` (new)
- Foreign key relationship with cascade options
- Sequential ordering via `sequence_number` or `step_order` field

**Recommended Schema Structure**:
```sql
CREATE TABLE task_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  instructions TEXT NOT NULL,
  include_previous_context BOOLEAN DEFAULT false,
  context_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  execution_result JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, step_order)
);
```

#### 2. Context Management Patterns

**Context Passing Strategies**:
1. **Full Context**: Pass entire previous step result
2. **Selective Context**: User-defined context extraction
3. **Metadata Context**: Only execution metadata (success/failure, timing)
4. **Custom Context**: User-specified context template

**Recommended Approach**: Hybrid model with user toggle for context inclusion and optional custom context templates.

#### 3. Step Execution Orchestration

**Sequential Execution Models**:
- **Synchronous**: Execute all steps in sequence, stop on failure
- **Asynchronous**: Queue-based execution with retry mechanisms
- **Conditional**: Skip steps based on previous results
- **Parallel**: Execute independent steps simultaneously

**For Agentopia**: Synchronous model with error handling and optional step skipping.

#### 4. UI/UX Best Practices

**Step Management Interface**:
- Drag-and-drop reordering
- Inline editing capabilities
- Visual step flow representation
- Context preview functionality
- Execution status indicators

**Wizard Enhancement**:
- Progressive disclosure for complex features
- Step validation before proceeding
- Save draft functionality
- Preview mode for entire workflow

## Implementation Recommendations

### 1. Database Design
- Use JSONB for flexible context storage
- Implement soft deletes for audit trails
- Add execution timing and result tracking
- Include step-level retry configuration

### 2. API Design
- RESTful endpoints for step CRUD operations
- Bulk operations for step reordering
- Validation endpoints for step sequences
- Context preview endpoints

### 3. UI Architecture
- Modular step components (≤200 lines each)
- Shared state management for step data
- Real-time validation feedback
- Responsive design for mobile access

### 4. Error Handling
- Step-level error recovery
- Context validation before execution
- Rollback mechanisms for failed workflows
- Detailed error logging and reporting

## Technical Considerations

### Performance
- Index on (task_id, step_order) for fast retrieval
- Pagination for tasks with many steps
- Caching of frequently accessed step data
- Efficient context serialization/deserialization

### Security
- Row-level security for step access
- Context data sanitization
- User permission validation per step
- Audit logging for step modifications

### Scalability
- Support for 1-50 steps per task (reasonable limit)
- Efficient step reordering algorithms
- Bulk operations for performance
- Background processing for long-running steps

## Integration with Existing System

### Backward Compatibility
- Treat single-instruction tasks as single-step workflows
- Migrate existing tasks to step-based model
- Maintain existing API contracts where possible
- Gradual rollout with feature flags

### Edge Function Updates
- Enhance task-executor for step orchestration
- Add step-specific execution logic
- Implement context passing mechanisms
- Update error handling for step failures

## References
- Industry workflow management patterns
- PostgreSQL JSONB best practices
- React component architecture guidelines
- Supabase Edge Function optimization techniques
