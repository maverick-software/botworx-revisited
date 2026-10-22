# Chat Mode vs Agent Mode Investigation Report

**Date:** October 10, 2025  
**Purpose:** Investigate implementation of Chat Mode and Agent Mode with to-do list capabilities  
**Status:** Investigation Complete - Ready for Implementation

---

## 📋 Executive Summary

This report analyzes how to implement **Chat Mode** and **Agent Mode** in Agentopia, similar to Cursor's interface modes. The investigation reveals that the current architecture fully supports this functionality through:

1. **System Prompt Modification** - Dynamic behavior control via prompt engineering
2. **MCP Tool Infrastructure** - Proven pattern for creating to-do list management tools
3. **Existing Task System** - Database schema and execution infrastructure already in place
4. **Agent Settings Framework** - UI patterns for mode selection and configuration

**Key Finding:** We can implement this feature with **minimal code changes** by leveraging existing infrastructure and creating a new set of MCP tools for to-do list management.

---

## 🎯 Requirements Analysis

### Chat Mode
- **Behavior:** Agent responds conversationally, asks for clarification
- **Autonomy:** Low - requires user approval for actions
- **Tool Usage:** Reactive - uses tools when explicitly requested
- **To-Do Lists:** Not applicable (conversational only)

### Agent Mode
- **Behavior:** Agent works autonomously toward goals
- **Autonomy:** High - executes tasks without constant approval
- **Tool Usage:** Proactive - uses tools as needed to complete objectives
- **To-Do Lists:** Creates, manages, and executes task lists independently

---

## 🏗️ Current Architecture Assessment

### 1. System Prompt Control Mechanism

**Location:** `supabase/functions/chat/processor/utils/prompt-builder.ts`

The `PromptBuilder` class constructs comprehensive system prompts that control agent behavior:

```typescript
buildSystemPromptString(agent: any): string {
  const sections: string[] = [];
  
  // Agent Identity
  sections.push(`=== AGENT IDENTITY ===
Your name is "${agent?.name || 'Assistant'}".
${agent?.description ? `Your description/role: ${agent.description}` : ''}
${agent?.personality ? `Your personality traits: ${agent.personality}` : ''}
=== END AGENT IDENTITY ===`);
  
  // System Instructions
  if (agent?.system_instructions) {
    sections.push(`=== SYSTEM INSTRUCTIONS ===
${agent.system_instructions}
=== END SYSTEM INSTRUCTIONS ===`);
  }
  
  // ... additional sections
  
  return sections.join('\n\n');
}
```

**Key Insight:** The system already supports dynamic prompt injection via `sessionContext.system_prompt_override`, which we can use to inject mode-specific instructions.

### 2. MCP Tool Infrastructure

**Proven Pattern:** `supabase/functions/contact-mcp-tools/index.ts`

Existing MCP tools follow this structure:

```typescript
interface MCPToolResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    execution_time_ms: number;
    tool_name: string;
    agent_id?: string;
    user_id?: string;
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { action, agent_id, user_id, params } = await req.json();
  
  switch (action) {
    case 'search_contacts':
      return await handleSearchContacts(supabase, { agent_id, user_id, ...params });
    case 'get_contact_details':
      return await handleGetContactDetails(supabase, { agent_id, user_id, ...params });
    // ... more cases
  }
});
```

**Key Insight:** We can create `todo-list-mcp` tools following this exact pattern.

### 3. Existing Task Management System

**Database Schema:** `agent_tasks` table with comprehensive task tracking

```sql
CREATE TABLE agent_tasks (
    id UUID PRIMARY KEY,
    agent_id UUID NOT NULL,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    task_type task_type_enum NOT NULL DEFAULT 'scheduled',
    status task_status_enum NOT NULL DEFAULT 'active',
    instructions TEXT NOT NULL,
    selected_tools JSONB DEFAULT '[]'::jsonb,
    cron_expression TEXT,
    timezone TEXT DEFAULT 'UTC',
    next_run_at TIMESTAMPTZ,
    -- ... more fields
);
```

**However:** The existing `agent_tasks` is focused on **scheduled/automated tasks** with cron expressions, not conversational to-do lists.

**Recommendation:** Create a new `agent_todo_lists` and `agent_todo_items` schema specifically for Agent Mode work tracking.

### 4. Tool Registration & Discovery

**Location:** `supabase/functions/get-agent-tools/index.ts`

Tools are dynamically discovered based on permissions:

```typescript
// Check for contact tools (always available if agent has contact permissions)
if (hasContactPermissions) {
  const contactTools = ['search_contacts', 'get_contact_details'];
  
  for (const toolName of contactTools) {
    const parameters = generateParametersForCapability(toolName);
    
    tools.push({
      name: toolName,
      description: `${toolName} - Contact Management`,
      parameters,
      status: 'active',
      provider_name: 'Contact Management',
      connection_name: 'Internal'
    });
  }
}
```

**Key Insight:** We can add to-do list tools to this discovery system with a new permission check.

---

## 💡 Proposed Implementation

### Phase 1: Database Schema

Create dedicated tables for Agent Mode to-do lists:

```sql
-- Agent to-do lists (collections of tasks for a specific goal/session)
CREATE TABLE agent_todo_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
    
    -- List metadata
    title TEXT NOT NULL,
    description TEXT,
    goal TEXT NOT NULL, -- The objective the agent is working toward
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'active', -- active, completed, cancelled
    priority TEXT DEFAULT 'medium', -- low, medium, high
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Individual to-do items within a list
CREATE TABLE agent_todo_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES agent_todo_lists(id) ON DELETE CASCADE,
    
    -- Item details
    title TEXT NOT NULL,
    description TEXT,
    task_type TEXT DEFAULT 'action', -- action, decision, question
    
    -- Order and hierarchy
    order_index INTEGER NOT NULL DEFAULT 0,
    parent_item_id UUID REFERENCES agent_todo_items(id) ON DELETE SET NULL,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, blocked, cancelled
    blocking_reason TEXT, -- Why blocked (if applicable)
    
    -- Execution tracking
    assigned_tool TEXT, -- Which tool will execute this
    execution_result JSONB, -- Result from tool execution
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_agent_todo_lists_agent_id ON agent_todo_lists(agent_id);
CREATE INDEX idx_agent_todo_lists_status ON agent_todo_lists(status);
CREATE INDEX idx_agent_todo_items_list_id ON agent_todo_items(list_id);
CREATE INDEX idx_agent_todo_items_status ON agent_todo_items(status);
```

### Phase 2: MCP Tools Implementation

Create `supabase/functions/todo-list-mcp/index.ts` with these tools:

#### Tool: `plan_tasks`
**Purpose:** Agent creates a to-do list for a given goal

```typescript
Parameters:
{
  goal: string,           // "Update the contact database with new entries"
  title?: string,         // Optional custom title
  description?: string,   // Optional description
  initial_tasks?: Array<{ // Optional initial task list
    title: string,
    description?: string,
    order_index: number
  }>
}

Response:
{
  success: true,
  data: {
    list_id: "uuid",
    title: "Update Contact Database",
    goal: "...",
    tasks_created: 5
  }
}
```

#### Tool: `create_task`
**Purpose:** Add a new task to an existing to-do list

```typescript
Parameters:
{
  list_id: string,
  title: string,
  description?: string,
  parent_item_id?: string,  // For sub-tasks
  order_index?: number,
  task_type?: 'action' | 'decision' | 'question'
}

Response:
{
  success: true,
  data: {
    item_id: "uuid",
    title: "...",
    order_index: 3
  }
}
```

#### Tool: `update_task`
**Purpose:** Update task status, details, or execution results

```typescript
Parameters:
{
  item_id: string,
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled',
  title?: string,
  description?: string,
  execution_result?: object,
  blocking_reason?: string
}

Response:
{
  success: true,
  data: {
    item_id: "uuid",
    status: "completed",
    updated_fields: ["status", "completed_at"]
  }
}
```

#### Tool: `get_todo_list`
**Purpose:** Retrieve current to-do list with all tasks

```typescript
Parameters:
{
  list_id?: string,          // Specific list
  conversation_id?: string,  // Get list for current conversation
  include_completed?: boolean
}

Response:
{
  success: true,
  data: {
    list: {
      id: "uuid",
      title: "...",
      goal: "...",
      status: "active"
    },
    items: [
      {
        id: "uuid",
        title: "Task 1",
        status: "completed",
        order_index: 0
      },
      {
        id: "uuid",
        title: "Task 2",
        status: "in_progress",
        order_index: 1
      }
    ],
    stats: {
      total: 5,
      completed: 1,
      in_progress: 1,
      pending: 3
    }
  }
}
```

#### Tool: `close_list`
**Purpose:** Mark a to-do list as completed or cancelled

```typescript
Parameters:
{
  list_id: string,
  status: 'completed' | 'cancelled',
  completion_summary?: string
}

Response:
{
  success: true,
  data: {
    list_id: "uuid",
    status: "completed",
    tasks_completed: 8,
    tasks_pending: 0
  }
}
```

### Phase 3: Mode Selection UI

Add mode selector to Agent Settings modal:

**Location:** `src/components/modals/agent-settings/BehaviorTab.tsx`

```typescript
// Add to agent metadata
interface AgentModeConfig {
  mode: 'chat' | 'agent';
  auto_create_todos: boolean;
  require_approval: boolean;
  max_autonomous_actions: number;
}

// UI Component
<div className="space-y-4">
  <h3>Interaction Mode</h3>
  
  <div className="grid grid-cols-2 gap-4">
    <div className={`mode-card ${mode === 'chat' ? 'selected' : ''}`}
         onClick={() => setMode('chat')}>
      <MessageSquare className="w-6 h-6" />
      <h4>Chat Mode</h4>
      <p>Conversational responses, asks for approval</p>
    </div>
    
    <div className={`mode-card ${mode === 'agent' ? 'selected' : ''}`}
         onClick={() => setMode('agent')}>
      <Bot className="w-6 h-6" />
      <h4>Agent Mode</h4>
      <p>Autonomous task execution with to-do lists</p>
    </div>
  </div>
  
  {mode === 'agent' && (
    <div className="space-y-2">
      <Checkbox 
        checked={autoCreateTodos}
        onChange={setAutoCreateTodos}
        label="Automatically create to-do lists for complex requests"
      />
      <Checkbox 
        checked={requireApproval}
        onChange={setRequireApproval}
        label="Require approval before executing tool calls"
      />
    </div>
  )}
</div>
```

### Phase 4: Mode-Specific System Prompts

Add mode-specific instructions to the system prompt:

**Location:** `supabase/functions/chat/processor/utils/prompt-builder.ts`

```typescript
buildSystemPromptString(agent: any): string {
  const sections: string[] = [];
  
  // ... existing sections ...
  
  // Add mode-specific instructions
  const mode = agent?.metadata?.mode_config?.mode || 'chat';
  
  if (mode === 'agent') {
    sections.push(`=== AGENT MODE INSTRUCTIONS ===
You are operating in AGENT MODE. This means:

1. **Autonomous Execution**: You work toward goals independently without constant user approval
2. **To-Do List Management**: For complex requests, create a to-do list using the 'plan_tasks' tool
3. **Task Tracking**: Update task status as you complete each item using 'update_task'
4. **Proactive Tool Usage**: Use available tools as needed to accomplish tasks
5. **Progress Reporting**: Keep the user informed of your progress through regular updates

**Workflow for Complex Requests:**
1. Analyze the request and break it into discrete tasks
2. Call 'plan_tasks' to create a to-do list with all required steps
3. Execute tasks sequentially, marking each as 'in_progress' then 'completed'
4. If a task is blocked, mark it as 'blocked' with a reason and ask for help
5. When all tasks are complete, call 'close_list' with a summary

**Examples:**
- User: "Update all contacts from the CSV file"
  → Create to-do list: [Parse CSV, Validate data, Update each contact, Generate report]
  
- User: "Research competitors and create a comparison report"
  → Create to-do list: [Search for competitors, Analyze features, Compare pricing, Create document]

You have access to these to-do list tools:
- plan_tasks: Create a new to-do list
- create_task: Add a task to the list
- update_task: Update task status or details
- get_todo_list: View current to-do list
- close_list: Mark list as completed

=== END AGENT MODE INSTRUCTIONS ===`);
  } else {
    sections.push(`=== CHAT MODE INSTRUCTIONS ===
You are operating in CHAT MODE. This means:

1. **Conversational**: Respond naturally and conversationally to user requests
2. **Ask for Clarification**: If a request is ambiguous, ask clarifying questions
3. **Seek Approval**: Before executing tool calls, explain what you'll do and why
4. **Reactive**: Only use tools when explicitly requested or clearly needed
5. **Explanatory**: Explain your reasoning and the results of any actions

**Interaction Style:**
- Be helpful and friendly
- Provide clear explanations
- Ask permission for significant actions
- Offer suggestions but let the user decide

=== END CHAT MODE INSTRUCTIONS ===`);
  }
  
  return sections.join('\n\n');
}
```

### Phase 5: Tool Registration

Add to-do list tools to the discovery system:

**Location:** `supabase/functions/get-agent-tools/index.ts`

```typescript
// Check if agent is in Agent Mode
const agentMode = agent?.metadata?.mode_config?.mode || 'chat';

if (agentMode === 'agent') {
  const todoTools = [
    'plan_tasks',
    'create_task',
    'update_task',
    'get_todo_list',
    'close_list'
  ];
  
  for (const toolName of todoTools) {
    const parameters = generateParametersForCapability(toolName);
    
    tools.push({
      name: toolName,
      description: getToolDescription(toolName),
      parameters,
      status: 'active',
      provider_name: 'Agent Mode',
      connection_name: 'Internal'
    });
  }
}

function getToolDescription(toolName: string): string {
  const descriptions = {
    'plan_tasks': 'Create a new to-do list for accomplishing a goal',
    'create_task': 'Add a new task to an existing to-do list',
    'update_task': 'Update the status or details of a task',
    'get_todo_list': 'Retrieve the current to-do list with all tasks',
    'close_list': 'Mark a to-do list as completed or cancelled'
  };
  return descriptions[toolName] || toolName;
}
```

### Phase 6: Parameter Generation

Add parameter schemas for to-do list tools:

**Location:** `supabase/functions/get-agent-tools/tool-generator.ts`

```typescript
export function generateParametersForCapability(toolName: string): any {
  const baseSchema = {
    type: 'object',
    properties: {},
    required: []
  };

  // ... existing tool parameters ...

  // To-Do List Tools
  if (toolName === 'plan_tasks') {
    return {
      ...baseSchema,
      properties: {
        goal: {
          type: 'string',
          description: 'The overall goal or objective to accomplish'
        },
        title: {
          type: 'string',
          description: 'Optional custom title for the to-do list'
        },
        description: {
          type: 'string',
          description: 'Optional description of the work to be done'
        },
        initial_tasks: {
          type: 'array',
          description: 'Optional array of initial tasks to add to the list',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              order_index: { type: 'number' }
            },
            required: ['title', 'order_index']
          }
        }
      },
      required: ['goal']
    };
  }

  if (toolName === 'create_task') {
    return {
      ...baseSchema,
      properties: {
        list_id: {
          type: 'string',
          description: 'UUID of the to-do list to add the task to'
        },
        title: {
          type: 'string',
          description: 'Title of the new task'
        },
        description: {
          type: 'string',
          description: 'Detailed description of what needs to be done'
        },
        parent_item_id: {
          type: 'string',
          description: 'Optional UUID of parent task (for sub-tasks)'
        },
        order_index: {
          type: 'number',
          description: 'Position in the task list (0-based)'
        },
        task_type: {
          type: 'string',
          enum: ['action', 'decision', 'question'],
          description: 'Type of task: action (do something), decision (make a choice), question (need information)'
        }
      },
      required: ['list_id', 'title']
    };
  }

  if (toolName === 'update_task') {
    return {
      ...baseSchema,
      properties: {
        item_id: {
          type: 'string',
          description: 'UUID of the task to update'
        },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'blocked', 'cancelled'],
          description: 'New status for the task'
        },
        title: {
          type: 'string',
          description: 'Updated task title'
        },
        description: {
          type: 'string',
          description: 'Updated task description'
        },
        execution_result: {
          type: 'object',
          description: 'Result data from task execution'
        },
        blocking_reason: {
          type: 'string',
          description: 'Reason why task is blocked (if status is blocked)'
        }
      },
      required: ['item_id']
    };
  }

  if (toolName === 'get_todo_list') {
    return {
      ...baseSchema,
      properties: {
        list_id: {
          type: 'string',
          description: 'Optional specific list UUID to retrieve'
        },
        conversation_id: {
          type: 'string',
          description: 'Get the to-do list for a specific conversation'
        },
        include_completed: {
          type: 'boolean',
          description: 'Whether to include completed tasks (default: false)',
          default: false
        }
      },
      required: []
    };
  }

  if (toolName === 'close_list') {
    return {
      ...baseSchema,
      properties: {
        list_id: {
          type: 'string',
          description: 'UUID of the to-do list to close'
        },
        status: {
          type: 'string',
          enum: ['completed', 'cancelled'],
          description: 'Whether the list was completed or cancelled'
        },
        completion_summary: {
          type: 'string',
          description: 'Optional summary of what was accomplished'
        }
      },
      required: ['list_id', 'status']
    };
  }

  // ... rest of function
}
```

### Phase 7: Universal Tool Executor Routing

Add routing for to-do list tools:

**Location:** `supabase/functions/chat/function_calling/universal-tool-executor.ts`

```typescript
const TOOL_ROUTING_MAP: Record<string, {
  edgeFunction: string;
  actionMapping: (toolName: string) => string;
  parameterMapping?: (params: Record<string, any>, context?: any) => Record<string, any>;
}> = {
  // ... existing routes ...
  
  // To-Do List Tools
  'plan_tasks': {
    edgeFunction: 'todo-list-mcp',
    actionMapping: () => 'plan_tasks',
    parameterMapping: (params, context) => ({
      action: 'plan_tasks',
      agent_id: context.agentId,
      user_id: context.userId,
      conversation_id: context.conversationId,
      params: params
    })
  },
  'create_task': {
    edgeFunction: 'todo-list-mcp',
    actionMapping: () => 'create_task'
  },
  'update_task': {
    edgeFunction: 'todo-list-mcp',
    actionMapping: () => 'update_task'
  },
  'get_todo_list': {
    edgeFunction: 'todo-list-mcp',
    actionMapping: () => 'get_todo_list'
  },
  'close_list': {
    edgeFunction: 'todo-list-mcp',
    actionMapping: () => 'close_list'
  }
};
```

---

## 🎨 UI/UX Enhancements

### 1. Mode Indicator in Chat Header

Add a visual indicator showing which mode the agent is in:

```tsx
<div className="chat-header">
  <AgentAvatar agent={agent} />
  <div className="agent-info">
    <h2>{agent.name}</h2>
    <div className="mode-badge">
      {mode === 'agent' ? (
        <Badge variant="primary">
          <Bot className="w-3 h-3" />
          Agent Mode
        </Badge>
      ) : (
        <Badge variant="secondary">
          <MessageSquare className="w-3 h-3" />
          Chat Mode
        </Badge>
      )}
    </div>
  </div>
</div>
```

### 2. To-Do List Sidebar (Agent Mode Only)

When in Agent Mode, show an expandable to-do list sidebar:

```tsx
{mode === 'agent' && currentTodoList && (
  <div className="todo-sidebar">
    <div className="todo-header">
      <h3>{currentTodoList.title}</h3>
      <p className="text-sm text-muted">{currentTodoList.goal}</p>
    </div>
    
    <div className="todo-progress">
      <Progress 
        value={(completedTasks / totalTasks) * 100} 
        className="h-2"
      />
      <span className="text-sm">
        {completedTasks} of {totalTasks} completed
      </span>
    </div>
    
    <div className="todo-items">
      {todoItems.map(item => (
        <TodoItem 
          key={item.id}
          item={item}
          onStatusChange={handleStatusChange}
        />
      ))}
    </div>
  </div>
)}
```

### 3. Task Progress in Message Stream

Show real-time task progress in the AI's response:

```tsx
{message.tool_calls?.map(call => {
  if (call.function.name.startsWith('update_task')) {
    const result = call.result;
    return (
      <div className="task-update">
        <CheckCircle className="w-4 h-4 text-green-500" />
        <span>Completed: {result.data.title}</span>
      </div>
    );
  }
})}
```

---

## ✅ Benefits of This Approach

### 1. **Leverages Existing Infrastructure**
- Uses proven MCP tool patterns
- Reuses database conventions
- Follows established UI patterns

### 2. **Minimal Breaking Changes**
- Fully backward compatible
- Optional feature (agents default to Chat Mode)
- No changes to existing agent functionality

### 3. **Scalable & Maintainable**
- Clean separation of concerns
- Well-documented patterns
- Easy to extend with additional tools

### 4. **User-Friendly**
- Clear visual distinction between modes
- Real-time progress tracking
- Familiar Cursor-like interface

### 5. **Flexible**
- Per-agent configuration
- Conversation-scoped to-do lists
- Support for complex hierarchical tasks

---

## 📊 Implementation Effort Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| **Phase 1:** Database Schema | 2 hours | None |
| **Phase 2:** MCP Tools Implementation | 8 hours | Phase 1 |
| **Phase 3:** Mode Selection UI | 4 hours | None |
| **Phase 4:** Mode-Specific Prompts | 2 hours | Phase 3 |
| **Phase 5:** Tool Registration | 3 hours | Phase 2 |
| **Phase 6:** Parameter Generation | 2 hours | Phase 2 |
| **Phase 7:** Tool Routing | 2 hours | Phase 2 |
| **Phase 8:** UI/UX Enhancements | 6 hours | Phase 2, 3 |
| **Testing & Refinement** | 6 hours | All phases |
| **Total** | **35 hours** | ~5 working days |

---

## 🚀 Recommended Next Steps

1. **Create Database Migration** (Phase 1)
   - Define `agent_todo_lists` and `agent_todo_items` tables
   - Add RLS policies
   - Deploy migration

2. **Implement MCP Tools** (Phase 2)
   - Create `supabase/functions/todo-list-mcp/index.ts`
   - Implement all five tool handlers
   - Add comprehensive error handling

3. **Add Mode Selection UI** (Phase 3)
   - Update `BehaviorTab.tsx` with mode selector
   - Save mode config to agent metadata
   - Add mode badge to chat header

4. **Update System Prompts** (Phase 4)
   - Modify `prompt-builder.ts` with mode-specific instructions
   - Test prompt variations

5. **Register Tools** (Phase 5-7)
   - Add tool discovery logic
   - Create parameter schemas
   - Add routing to universal tool executor

6. **Build UI Components** (Phase 8)
   - Create to-do list sidebar component
   - Add task progress indicators
   - Implement real-time updates

7. **Test End-to-End**
   - Test mode switching
   - Verify to-do list creation and updates
   - Test autonomous task execution

---

## 🎯 Success Criteria

✅ Agents can switch between Chat Mode and Agent Mode  
✅ In Agent Mode, agents automatically create to-do lists for complex requests  
✅ To-do lists are visible in the UI with real-time updates  
✅ Agents autonomously execute tasks and update status  
✅ Users can see progress through completed tasks  
✅ System is backward compatible with existing agents  
✅ Performance impact is minimal (<100ms latency)  

---

## 📚 References

### Existing Code Patterns
- **MCP Tools:** `supabase/functions/contact-mcp-tools/index.ts`
- **System Prompts:** `supabase/functions/chat/processor/utils/prompt-builder.ts`
- **Tool Discovery:** `supabase/functions/get-agent-tools/index.ts`
- **Tool Routing:** `supabase/functions/chat/function_calling/universal-tool-executor.ts`
- **Agent Settings UI:** `src/components/modals/agent-settings/BehaviorTab.tsx`

### Related Documentation
- [Tool Infrastructure Guide](../../README/tool-infrastructure.md)
- [MCP Overview](../../.cursor/rules/premium/sops/tool-architecture/04_mcp/mcp_overview.mdc)
- [Database Schema](../../README/database-schema.md)
- [Scheduled Tasks SOP](../../.cursor/rules/premium/sops/scheduled_tasks/scheduled_tasks_sop.mdc)

---

**Report Prepared By:** AI Analysis System  
**Review Status:** Ready for Implementation  
**Priority:** High - Valuable UX Enhancement  

