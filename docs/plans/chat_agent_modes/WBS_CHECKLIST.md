# Chat Mode vs Agent Mode - Work Breakdown Structure (WBS)

**Project:** Agent Mode with To-Do List Management via MCP Server  
**Estimated Duration:** 11-14 Working Days  
**Created:** October 10, 2025  
**Status:** Ready to Execute

---

## 📊 Project Overview

### Goal
Implement Chat Mode and Agent Mode with autonomous to-do list management using a dedicated MCP server deployed through existing DTMA infrastructure.

### Success Criteria
- [ ] Agents can switch between Chat Mode and Agent Mode
- [ ] Agent Mode agents create to-do lists automatically for complex tasks
- [ ] To-do lists visible in real-time in the UI
- [ ] Agents autonomously execute and update tasks
- [ ] System scales to multiple agents and users
- [ ] Zero breaking changes to existing functionality

---

## 🏗️ PHASE 1: Database Schema (1 Day)

### 1.1 Create Migration Files
- [ ] Create migration file: `YYYYMMDD_create_agent_todo_lists.sql`
- [ ] Create migration file: `YYYYMMDD_create_agent_todo_items.sql`
- [ ] Add proper timestamps and UUID generation

**Deliverable:** Two migration files ready to deploy

### 1.2 Define `agent_todo_lists` Table
- [ ] Add `id` (UUID, primary key)
- [ ] Add `agent_id` (UUID, FK to agents)
- [ ] Add `user_id` (UUID, FK to auth.users)
- [ ] Add `conversation_id` (UUID, FK to chat_conversations, nullable)
- [ ] Add `title` (TEXT, required)
- [ ] Add `description` (TEXT, nullable)
- [ ] Add `goal` (TEXT, required)
- [ ] Add `status` (TEXT, default 'active', CHECK constraint)
- [ ] Add `priority` (TEXT, default 'medium')
- [ ] Add `created_at` (TIMESTAMPTZ, default NOW())
- [ ] Add `updated_at` (TIMESTAMPTZ, default NOW())
- [ ] Add `completed_at` (TIMESTAMPTZ, nullable)

**Deliverable:** Complete table definition with constraints

### 1.3 Define `agent_todo_items` Table
- [ ] Add `id` (UUID, primary key)
- [ ] Add `list_id` (UUID, FK to agent_todo_lists)
- [ ] Add `title` (TEXT, required)
- [ ] Add `description` (TEXT, nullable)
- [ ] Add `task_type` (TEXT, default 'action', CHECK constraint)
- [ ] Add `order_index` (INTEGER, default 0)
- [ ] Add `parent_item_id` (UUID, FK to agent_todo_items, nullable)
- [ ] Add `status` (TEXT, default 'pending', CHECK constraint)
- [ ] Add `blocking_reason` (TEXT, nullable)
- [ ] Add `assigned_tool` (TEXT, nullable)
- [ ] Add `execution_result` (JSONB, nullable)
- [ ] Add `retry_count` (INTEGER, default 0)
- [ ] Add `max_retries` (INTEGER, default 3)
- [ ] Add timestamps (created_at, updated_at, started_at, completed_at)

**Deliverable:** Complete table definition with constraints

### 1.4 Create Indexes
- [ ] Index on `agent_todo_lists(agent_id)`
- [ ] Index on `agent_todo_lists(status)`
- [ ] Index on `agent_todo_lists(conversation_id)`
- [ ] Index on `agent_todo_items(list_id)`
- [ ] Index on `agent_todo_items(status)`
- [ ] Index on `agent_todo_items(order_index)`

**Deliverable:** Six indexes for performance optimization

### 1.5 Configure Row Level Security (RLS)
- [ ] Enable RLS on `agent_todo_lists`
- [ ] Enable RLS on `agent_todo_items`
- [ ] Create policy: Service role full access (for MCP server)
- [ ] Create policy: Users can view their own lists
- [ ] Create policy: Users can view items from their lists

**Deliverable:** Five RLS policies configured

### 1.6 Test Database Schema
- [ ] Run migrations on local Supabase instance
- [ ] Insert sample data
- [ ] Test all constraints
- [ ] Verify RLS policies work correctly
- [ ] Test queries with indexes

**Deliverable:** Verified schema ready for production

### 1.7 Deploy to Production
- [ ] Review migration files
- [ ] Run `supabase db push --include-all`
- [ ] Verify tables created
- [ ] Verify indexes created
- [ ] Verify RLS policies active

**Deliverable:** Schema deployed to production database

---

## 🐳 PHASE 2: MCP Server Development (3-5 Days)

### 2.1 Project Setup (0.5 Day)

#### 2.1.1 Initialize Project Structure
- [ ] Create directory: `services/todo-list-mcp-server/`
- [ ] Initialize Node.js project: `npm init -y`
- [ ] Install dependencies: `@modelcontextprotocol/sdk`, `@supabase/supabase-js`
- [ ] Install dev dependencies: `typescript`, `@types/node`, `tsx`
- [ ] Create `tsconfig.json` with proper settings
- [ ] Create `.env.example` file

**Deliverable:** Initialized project with dependencies

#### 2.1.2 Create Directory Structure
- [ ] Create `src/` directory
- [ ] Create `src/tools/` directory
- [ ] Create `src/database/` directory
- [ ] Create `src/types/` directory
- [ ] Create `src/utils/` directory
- [ ] Create `tests/` directory

**Deliverable:** Complete directory structure

### 2.2 Database Client Setup (0.5 Day)

#### 2.2.1 Create Supabase Client
- [ ] Create `src/database/client.ts`
- [ ] Implement `createSupabaseClient()` function
- [ ] Add environment variable validation
- [ ] Add connection error handling
- [ ] Export configured client

**Deliverable:** `src/database/client.ts` (50-75 lines)

#### 2.2.2 Create Database Query Functions
- [ ] Create `src/database/queries.ts`
- [ ] Implement `createTodoList()` query
- [ ] Implement `createTodoItem()` query
- [ ] Implement `updateTodoItem()` query
- [ ] Implement `getTodoList()` query
- [ ] Implement `getTodoItems()` query
- [ ] Implement `closeTodoList()` query
- [ ] Add proper TypeScript types for all queries

**Deliverable:** `src/database/queries.ts` (200-250 lines)

### 2.3 Type Definitions (0.5 Day)

#### 2.3.1 Define Core Types
- [ ] Create `src/types/index.ts`
- [ ] Define `TodoList` interface
- [ ] Define `TodoItem` interface
- [ ] Define `TodoListStatus` enum
- [ ] Define `TodoItemStatus` enum
- [ ] Define `TaskType` enum
- [ ] Define request/response types for each tool

**Deliverable:** `src/types/index.ts` (100-150 lines)

### 2.4 Tool Implementation (2 Days)

#### 2.4.1 Implement `plan_tasks` Tool
- [ ] Create `src/tools/plan_tasks.ts`
- [ ] Define tool schema with MCP SDK
- [ ] Implement `handlePlanTasks()` function
- [ ] Validate input parameters
- [ ] Create to-do list in database
- [ ] Create initial tasks if provided
- [ ] Return structured response
- [ ] Add error handling
- [ ] Add logging

**Deliverable:** `src/tools/plan_tasks.ts` (150-200 lines)

#### 2.4.2 Implement `create_task` Tool
- [ ] Create `src/tools/create_task.ts`
- [ ] Define tool schema with MCP SDK
- [ ] Implement `handleCreateTask()` function
- [ ] Validate list exists and belongs to agent
- [ ] Insert task into database
- [ ] Handle parent_item_id for sub-tasks
- [ ] Return structured response
- [ ] Add error handling

**Deliverable:** `src/tools/create_task.ts` (100-150 lines)

#### 2.4.3 Implement `update_task` Tool
- [ ] Create `src/tools/update_task.ts`
- [ ] Define tool schema with MCP SDK
- [ ] Implement `handleUpdateTask()` function
- [ ] Validate task exists
- [ ] Handle status transitions (pending → in_progress → completed)
- [ ] Update timestamps based on status
- [ ] Store execution results
- [ ] Return updated task data

**Deliverable:** `src/tools/update_task.ts` (125-175 lines)

#### 2.4.4 Implement `get_todo_list` Tool
- [ ] Create `src/tools/get_todo_list.ts`
- [ ] Define tool schema with MCP SDK
- [ ] Implement `handleGetTodoList()` function
- [ ] Fetch list by ID or conversation_id
- [ ] Fetch all associated items
- [ ] Calculate statistics (total, completed, in_progress, pending)
- [ ] Sort items by order_index
- [ ] Handle parent-child relationships

**Deliverable:** `src/tools/get_todo_list.ts` (150-200 lines)

#### 2.4.5 Implement `close_list` Tool
- [ ] Create `src/tools/close_list.ts`
- [ ] Define tool schema with MCP SDK
- [ ] Implement `handleCloseList()` function
- [ ] Validate list exists
- [ ] Check all tasks are completed (if status=completed)
- [ ] Update list status
- [ ] Set completed_at timestamp
- [ ] Return final statistics

**Deliverable:** `src/tools/close_list.ts` (100-125 lines)

#### 2.4.6 Create Tool Registry
- [ ] Create `src/tools/index.ts`
- [ ] Import all tool handlers
- [ ] Create `registerTools()` function
- [ ] Register each tool with MCP server
- [ ] Map tool names to handlers
- [ ] Export tool registry

**Deliverable:** `src/tools/index.ts` (75-100 lines)

### 2.5 MCP Server Implementation (1 Day)

#### 2.5.1 Create Main Server File
- [ ] Create `src/index.ts`
- [ ] Import MCP SDK
- [ ] Import Supabase client
- [ ] Import tool registry
- [ ] Initialize MCP server with capabilities
- [ ] Configure server metadata (name, version)
- [ ] Set up transport (HTTP+SSE)
- [ ] Configure port and host

**Deliverable:** `src/index.ts` (100-150 lines)

#### 2.5.2 Implement Tool Request Handler
- [ ] Create request validation middleware
- [ ] Parse incoming tool requests
- [ ] Extract agent_id, user_id, conversation_id
- [ ] Route to appropriate tool handler
- [ ] Catch and format errors
- [ ] Return MCP-compliant responses

**Deliverable:** Request handling logic

#### 2.5.3 Add Health Check Endpoint
- [ ] Create `/health` endpoint
- [ ] Check Supabase connection
- [ ] Return server status
- [ ] Include version information
- [ ] Add uptime tracking

**Deliverable:** Health check endpoint

#### 2.5.4 Add Logging and Monitoring
- [ ] Set up structured logging
- [ ] Log all tool executions
- [ ] Log errors with stack traces
- [ ] Add performance metrics
- [ ] Configure log levels

**Deliverable:** Comprehensive logging system

### 2.6 Docker Configuration (0.5 Day)

#### 2.6.1 Create Dockerfile
- [ ] Create `Dockerfile` in project root
- [ ] Use Node.js 20 Alpine base image
- [ ] Set working directory
- [ ] Copy package files
- [ ] Run `npm ci --only=production`
- [ ] Copy source code
- [ ] Build TypeScript (`npm run build`)
- [ ] Expose port 8080
- [ ] Add HEALTHCHECK instruction
- [ ] Set CMD to run server

**Deliverable:** Production-ready Dockerfile

#### 2.6.2 Create Docker Compose (for testing)
- [ ] Create `docker-compose.yml`
- [ ] Define todo-list-mcp service
- [ ] Set environment variables
- [ ] Configure port mapping
- [ ] Add restart policy

**Deliverable:** `docker-compose.yml` for local testing

#### 2.6.3 Create .dockerignore
- [ ] Add `node_modules/`
- [ ] Add `.git/`
- [ ] Add `tests/`
- [ ] Add `.env`
- [ ] Add development files

**Deliverable:** `.dockerignore` file

### 2.7 Testing (1 Day)

#### 2.7.1 Create Unit Tests
- [ ] Create `tests/tools/` directory
- [ ] Write tests for `plan_tasks` handler
- [ ] Write tests for `create_task` handler
- [ ] Write tests for `update_task` handler
- [ ] Write tests for `get_todo_list` handler
- [ ] Write tests for `close_list` handler
- [ ] Mock Supabase client
- [ ] Achieve 80%+ code coverage

**Deliverable:** Comprehensive unit tests

#### 2.7.2 Create Integration Tests
- [ ] Set up test Supabase instance
- [ ] Test full workflow: plan → create → update → close
- [ ] Test error scenarios
- [ ] Test concurrent requests
- [ ] Test with multiple agents
- [ ] Clean up test data after each test

**Deliverable:** Integration test suite

#### 2.7.3 Manual Testing
- [ ] Test with MCP CLI tools
- [ ] Test each tool individually
- [ ] Test edge cases
- [ ] Test error responses
- [ ] Verify response formats match MCP spec

**Deliverable:** Manual test results documented

### 2.8 Build and Push Docker Image (0.5 Day)

#### 2.8.1 Build Docker Image Locally
- [ ] Run `docker build -t todo-list-mcp-server:1.0.0 .`
- [ ] Verify image builds successfully
- [ ] Test image runs locally
- [ ] Test health check endpoint
- [ ] Verify all tools work

**Deliverable:** Working Docker image

#### 2.8.2 Push to Container Registry
- [ ] Tag image for DigitalOcean registry
- [ ] Authenticate with registry
- [ ] Push image: `docker push registry.digitalocean.com/agentopia/todo-list-mcp-server:1.0.0`
- [ ] Verify image in registry
- [ ] Tag as `latest`

**Deliverable:** Image available in registry

---

## 🏪 PHASE 3: Marketplace Integration (1 Day)

### 3.1 Add Server Template to Database (0.5 Day)

#### 3.1.1 Create Marketplace Entry
- [ ] Write SQL to insert into `mcp_server_templates`
- [ ] Set `name` = 'todo-list-server'
- [ ] Set `display_name` = 'To-Do List Manager'
- [ ] Write comprehensive description
- [ ] Set `category` = 'productivity'
- [ ] Set Docker image URL
- [ ] Configure default_config JSON
- [ ] Set `is_official` = true
- [ ] Run SQL on production database

**Deliverable:** Server template in database

#### 3.1.2 Prepare Server Documentation
- [ ] Create server README
- [ ] Document all available tools
- [ ] Document required environment variables
- [ ] Add usage examples
- [ ] Include troubleshooting guide

**Deliverable:** Server documentation

### 3.2 Update Marketplace UI (0.5 Day)

#### 3.2.1 Verify Server Appears in Marketplace
- [ ] Navigate to MCP Marketplace page
- [ ] Verify "To-Do List Manager" card appears
- [ ] Check icon displays correctly
- [ ] Verify description is readable
- [ ] Test "Deploy" button exists

**Deliverable:** Server visible in marketplace

#### 3.2.2 Test Deployment Flow
- [ ] Click "Deploy to Toolbox"
- [ ] Select target toolbox
- [ ] Verify deployment configuration UI
- [ ] Submit deployment
- [ ] Monitor deployment status
- [ ] Verify deployment success

**Deliverable:** Working deployment flow

---

## ⚙️ PHASE 4: Mode Configuration (2 Days)

### 4.1 Agent Metadata Schema (0.5 Day)

#### 4.1.1 Define Mode Configuration Type
- [ ] Create TypeScript interface `AgentModeConfig`
- [ ] Add `mode: 'chat' | 'agent'` field
- [ ] Add `auto_create_todos: boolean` field
- [ ] Add `todo_mcp_server_id?: string` field
- [ ] Add `require_approval: boolean` field
- [ ] Add `max_autonomous_actions: number` field

**Deliverable:** Type definition in `src/types/agent.ts`

#### 4.1.2 Update Agent Metadata Structure
- [ ] Document metadata structure in comments
- [ ] Create migration to update existing agents (if needed)
- [ ] Add validation for mode_config

**Deliverable:** Documented metadata schema

### 4.2 Mode Selector UI (1 Day)

#### 4.2.1 Update BehaviorTab Component
- [ ] Open `src/components/modals/agent-settings/BehaviorTab.tsx`
- [ ] Add state for mode selection
- [ ] Add state for mode configuration options
- [ ] Import necessary icons (MessageSquare, Bot, AlertCircle)

**Deliverable:** State management in place

#### 4.2.2 Create Mode Selection UI
- [ ] Add section header "Interaction Mode"
- [ ] Create RadioGroup with two cards
- [ ] Chat Mode card with icon and description
- [ ] Agent Mode card with icon and description
- [ ] Add ring styling for selected mode
- [ ] Make cards clickable

**Deliverable:** Mode selector cards

#### 4.2.3 Add Agent Mode Configuration Options
- [ ] Add conditional rendering for Agent Mode
- [ ] Add checkbox: "Automatically create to-do lists"
- [ ] Add checkbox: "Require approval before tool execution"
- [ ] Add Alert component explaining MCP connection requirement
- [ ] Style options section

**Deliverable:** Agent Mode configuration UI

#### 4.2.4 Implement Save Functionality
- [ ] Update `handleSave()` function
- [ ] Save mode to `agent.metadata.mode_config.mode`
- [ ] Save configuration options
- [ ] Show success toast
- [ ] Handle errors

**Deliverable:** Working save functionality

#### 4.2.5 Implement Load Functionality
- [ ] Update component initialization
- [ ] Load mode from `agentData.metadata.mode_config`
- [ ] Load configuration options
- [ ] Set default to 'chat' if not specified

**Deliverable:** Working load functionality

### 4.3 System Prompt Updates (0.5 Day)

#### 4.3.1 Update PromptBuilder Class
- [ ] Open `supabase/functions/chat/processor/utils/prompt-builder.ts`
- [ ] Add logic to read `agent.metadata.mode_config.mode`
- [ ] Create Agent Mode prompt section
- [ ] Create Chat Mode prompt section

**Deliverable:** Mode detection in place

#### 4.3.2 Create Agent Mode Prompt
- [ ] Write comprehensive Agent Mode instructions
- [ ] Explain autonomous execution
- [ ] Document to-do list workflow
- [ ] Include tool usage examples
- [ ] List all 5 tools with descriptions
- [ ] Add workflow steps (analyze → plan → execute → update → close)

**Deliverable:** Agent Mode system prompt (200-300 lines)

#### 4.3.3 Create Chat Mode Prompt
- [ ] Write Chat Mode instructions
- [ ] Explain conversational approach
- [ ] Document approval requirements
- [ ] Emphasize asking clarifying questions
- [ ] Define interaction style

**Deliverable:** Chat Mode system prompt (100-150 lines)

#### 4.3.4 Test Prompt Injection
- [ ] Create test agent in Chat Mode
- [ ] Verify Chat Mode prompt appears
- [ ] Create test agent in Agent Mode
- [ ] Verify Agent Mode prompt appears
- [ ] Test mode switching updates prompts

**Deliverable:** Verified prompt injection

---

## 🎨 PHASE 5: UI Components (2-3 Days)

### 5.1 Chat Header Updates (0.5 Day)

#### 5.1.1 Add Mode Badge Component
- [ ] Create `src/components/chat/ModeBadge.tsx`
- [ ] Add props for mode type
- [ ] Style Chat Mode badge (secondary variant)
- [ ] Style Agent Mode badge (primary variant)
- [ ] Add icons (MessageSquare, Bot)
- [ ] Export component

**Deliverable:** `ModeBadge.tsx` component

#### 5.1.2 Update ChatHeader Component
- [ ] Open `src/components/chat/ChatHeader.tsx`
- [ ] Import ModeBadge component
- [ ] Add mode to component state
- [ ] Fetch mode from agent metadata
- [ ] Render ModeBadge in header
- [ ] Position badge appropriately

**Deliverable:** Mode badge visible in chat header

### 5.2 To-Do List Sidebar (1.5 Days)

#### 5.2.1 Create TodoListSidebar Component
- [ ] Create `src/components/chat/TodoListSidebar.tsx`
- [ ] Define component props (agentId, conversationId)
- [ ] Set up state for todoList and items
- [ ] Create component structure
- [ ] Export component

**Deliverable:** Basic component structure

#### 5.2.2 Implement Data Fetching
- [ ] Create function to fetch current to-do list
- [ ] Call MCP tool `get_todo_list` via Supabase function
- [ ] Parse response and set state
- [ ] Handle no active list case
- [ ] Add loading state

**Deliverable:** Data fetching logic

#### 5.2.3 Implement Real-Time Subscriptions
- [ ] Set up Supabase real-time channel
- [ ] Subscribe to `agent_todo_items` changes
- [ ] Filter by current list_id
- [ ] Handle INSERT, UPDATE, DELETE events
- [ ] Update items state in real-time
- [ ] Clean up subscription on unmount

**Deliverable:** Real-time updates working

#### 5.2.4 Create TodoItem Sub-Component
- [ ] Create `src/components/chat/TodoItem.tsx`
- [ ] Display item title and description
- [ ] Show status with colored icon
- [ ] Display timestamps (started_at, completed_at)
- [ ] Show blocking_reason if status is blocked
- [ ] Add hover effects
- [ ] Make expandable for details

**Deliverable:** `TodoItem.tsx` component

#### 5.2.5 Build Sidebar Layout
- [ ] Add sidebar header with list title
- [ ] Add status badge for list
- [ ] Add goal description
- [ ] Add progress bar with percentage
- [ ] Add task count summary (X of Y completed)
- [ ] Add scrollable items container
- [ ] Render TodoItem components
- [ ] Add expand/collapse functionality

**Deliverable:** Complete sidebar layout

#### 5.2.6 Style Sidebar
- [ ] Match Agentopia design system
- [ ] Use proper spacing and padding
- [ ] Add border and shadow
- [ ] Style progress bar
- [ ] Add smooth animations
- [ ] Ensure mobile responsiveness
- [ ] Test in light and dark modes

**Deliverable:** Styled sidebar component

### 5.3 Task Progress Indicators (0.5 Day)

#### 5.3.1 Update Message Component
- [ ] Open message rendering component
- [ ] Detect tool calls related to to-do list
- [ ] Parse tool call results

**Deliverable:** Tool call detection

#### 5.3.2 Create Task Update Indicator
- [ ] Create inline component for task updates
- [ ] Show checkmark icon for completed tasks
- [ ] Display task title
- [ ] Add timestamp
- [ ] Style appropriately

**Deliverable:** Task update indicator

#### 5.3.3 Create List Creation Indicator
- [ ] Create component for list creation message
- [ ] Show list icon
- [ ] Display list title and goal
- [ ] Show number of tasks created
- [ ] Add link to open sidebar (if collapsed)

**Deliverable:** List creation indicator

### 5.4 Integration with AgentChatPage (0.5 Day)

#### 5.4.1 Update AgentChatPage Component
- [ ] Open `src/pages/AgentChatPage.tsx`
- [ ] Import TodoListSidebar component
- [ ] Add state for sidebar visibility
- [ ] Check if agent is in Agent Mode
- [ ] Check if active to-do list exists

**Deliverable:** Component imports and state

#### 5.4.2 Add Sidebar to Layout
- [ ] Add conditional rendering for TodoListSidebar
- [ ] Only show if mode === 'agent' && hasTodoList
- [ ] Position sidebar (right side or collapsible)
- [ ] Add toggle button for sidebar
- [ ] Ensure responsive layout
- [ ] Test with and without sidebar

**Deliverable:** Integrated sidebar in chat layout

---

## 🧪 PHASE 6: Integration Testing (2 Days)

### 6.1 End-to-End Testing (1 Day)

#### 6.1.1 Test Admin Deployment Flow
- [ ] Log in as admin user
- [ ] Navigate to MCP Marketplace
- [ ] Find To-Do List Manager
- [ ] Deploy to test toolbox
- [ ] Wait for deployment completion
- [ ] Verify server status is "running"
- [ ] Check DTMA logs for deployment

**Deliverable:** Admin deployment verified

#### 6.1.2 Test User Connection Flow
- [ ] Log in as regular user
- [ ] Navigate to agent settings
- [ ] Switch agent to Agent Mode
- [ ] Go to MCP tab
- [ ] Find To-Do List Manager in available servers
- [ ] Click Connect
- [ ] Wait for connection success
- [ ] Verify tools appear in agent tools list

**Deliverable:** User connection verified

#### 6.1.3 Test Agent Autonomous Usage
- [ ] Start chat with Agent Mode agent
- [ ] Send complex request: "Research top 5 competitors and create a comparison spreadsheet"
- [ ] Verify agent calls `plan_tasks`
- [ ] Verify to-do list appears in sidebar
- [ ] Watch agent execute tasks sequentially
- [ ] Verify status updates in real-time
- [ ] Verify agent calls `close_list` when done
- [ ] Check final output

**Deliverable:** Full autonomous workflow working

#### 6.1.4 Test with Multiple Agents
- [ ] Create 3 different agents in Agent Mode
- [ ] Connect all to same MCP server
- [ ] Have each agent work on different task
- [ ] Verify lists don't interfere with each other
- [ ] Check database isolation
- [ ] Verify concurrent execution works

**Deliverable:** Multi-agent testing complete

#### 6.1.5 Test Mode Switching
- [ ] Create agent in Chat Mode
- [ ] Test normal conversation
- [ ] Switch to Agent Mode
- [ ] Verify prompt changes
- [ ] Verify to-do list tools available
- [ ] Test autonomous task execution
- [ ] Switch back to Chat Mode
- [ ] Verify tools no longer available

**Deliverable:** Mode switching verified

### 6.2 Error Scenario Testing (0.5 Day)

#### 6.2.1 Test Network Failures
- [ ] Stop MCP server container
- [ ] Attempt tool call
- [ ] Verify graceful error handling
- [ ] Verify error message to user
- [ ] Restart container
- [ ] Verify recovery

**Deliverable:** Network failure handling verified

#### 6.2.2 Test Invalid Parameters
- [ ] Call tools with missing required parameters
- [ ] Call tools with invalid UUIDs
- [ ] Call tools with malformed data
- [ ] Verify error responses
- [ ] Verify no database corruption

**Deliverable:** Parameter validation working

#### 6.2.3 Test Permission Violations
- [ ] Attempt to access another user's to-do list
- [ ] Verify RLS blocks access
- [ ] Attempt tool call without connection
- [ ] Verify proper error message

**Deliverable:** Security verified

### 6.3 Performance Testing (0.5 Day)

#### 6.3.1 Load Testing
- [ ] Create 10 concurrent agents
- [ ] Each agent creates a to-do list
- [ ] Each executes 10 tasks
- [ ] Monitor server CPU/memory
- [ ] Monitor database connections
- [ ] Check response times
- [ ] Verify no timeouts

**Deliverable:** Performance metrics documented

#### 6.3.2 Real-Time Update Testing
- [ ] Create to-do list in one browser
- [ ] Open same conversation in another browser
- [ ] Update tasks in first browser
- [ ] Verify updates appear in second browser immediately
- [ ] Check update latency (should be <1s)

**Deliverable:** Real-time performance verified

---

## 📚 PHASE 7: Documentation (0.5 Day)

### 7.1 User Documentation

#### 7.1.1 Create User Guide
- [ ] Write "Enabling Agent Mode" guide
- [ ] Document how to connect to MCP server
- [ ] Explain how to use Agent Mode
- [ ] Include screenshots
- [ ] Add examples of complex requests
- [ ] Document to-do list sidebar

**Deliverable:** User guide document

#### 7.1.2 Create Video Tutorial (Optional)
- [ ] Record screen capture
- [ ] Show complete workflow
- [ ] Add voiceover or captions
- [ ] Upload to documentation site

**Deliverable:** Video tutorial

### 7.2 Developer Documentation

#### 7.2.1 Update Tool Infrastructure Docs
- [ ] Add To-Do List MCP Server section
- [ ] Document all 5 tools
- [ ] Include API examples
- [ ] Document database schema
- [ ] Add troubleshooting section

**Deliverable:** Updated tool docs

#### 7.2.2 Create MCP Server README
- [ ] Document server architecture
- [ ] Include setup instructions
- [ ] Document environment variables
- [ ] Add development guide
- [ ] Include deployment instructions

**Deliverable:** Server README

---

## 🚀 PHASE 8: Deployment to Production (0.5 Day)

### 8.1 Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Code reviewed
- [ ] Documentation complete
- [ ] Database migration tested
- [ ] Docker image in registry
- [ ] Rollback plan prepared
- [ ] Monitoring configured

**Deliverable:** Deployment readiness confirmed

### 8.2 Database Migration

- [ ] Backup production database
- [ ] Run migration: `supabase db push --include-all`
- [ ] Verify tables created
- [ ] Verify indexes created
- [ ] Verify RLS policies active
- [ ] Test sample queries

**Deliverable:** Database schema deployed

### 8.3 MCP Server Deployment

- [ ] Admin deploys To-Do List Manager from marketplace
- [ ] Verify deployment to production toolbox
- [ ] Test health check endpoint
- [ ] Verify server accessible
- [ ] Test one tool call
- [ ] Monitor logs for errors

**Deliverable:** MCP server running in production

### 8.4 Frontend Deployment

- [ ] Build frontend with new components
- [ ] Run production build: `npm run build`
- [ ] Test build locally
- [ ] Deploy to Netlify/Vercel
- [ ] Clear CDN cache
- [ ] Verify deployment

**Deliverable:** Frontend deployed

### 8.5 Verification

- [ ] Test complete workflow in production
- [ ] Create test agent in Agent Mode
- [ ] Connect to MCP server
- [ ] Execute complex task
- [ ] Verify to-do list functionality
- [ ] Check real-time updates
- [ ] Monitor error logs

**Deliverable:** Production verification complete

### 8.6 Monitoring Setup

- [ ] Set up alerts for MCP server errors
- [ ] Configure uptime monitoring
- [ ] Set up database query monitoring
- [ ] Configure user activity tracking
- [ ] Set up performance dashboards

**Deliverable:** Monitoring active

---

## 📊 Progress Tracking

### Overall Progress
- **Phase 1 (Database):** ⬜ 0/7 tasks
- **Phase 2 (MCP Server):** ⬜ 0/32 tasks
- **Phase 3 (Marketplace):** ⬜ 0/6 tasks
- **Phase 4 (Mode Config):** ⬜ 0/13 tasks
- **Phase 5 (UI):** ⬜ 0/18 tasks
- **Phase 6 (Testing):** ⬜ 0/12 tasks
- **Phase 7 (Docs):** ⬜ 0/4 tasks
- **Phase 8 (Deployment):** ⬜ 0/6 tasks

**Total:** ⬜ 0/98 tasks completed

---

## 🎯 Critical Path

The following tasks are on the critical path and must be completed in sequence:

1. Phase 1: Database Schema → **Must complete first**
2. Phase 2.1-2.3: MCP Server setup → **Blocks tool implementation**
3. Phase 2.4: Tool implementation → **Blocks testing**
4. Phase 2.8: Docker image → **Blocks marketplace integration**
5. Phase 3: Marketplace integration → **Blocks user testing**
6. Phase 4: Mode configuration → **Blocks autonomous functionality**
7. Phase 5: UI components → **Blocks user experience**

Non-critical path items (can be done in parallel):
- Documentation (Phase 7) can start anytime after Phase 2
- Some UI work (Phase 5.1) can start after Phase 4
- Testing preparation can start during Phase 2

---

## 📝 Notes for Implementation

### Code Quality Standards
- [ ] All files must be ≤500 lines (Philosophy #1)
- [ ] Comprehensive TypeScript typing
- [ ] Unit test coverage ≥80%
- [ ] ESLint passing with no warnings
- [ ] Proper error handling everywhere
- [ ] Structured logging throughout

### Backup Strategy
- [ ] Backup before every deployment
- [ ] Version control all changes
- [ ] Tag releases in Git
- [ ] Document rollback procedures

### Communication Plan
- [ ] Daily standup updates
- [ ] Demo after each phase completion
- [ ] Weekly progress reports
- [ ] Immediate alert for blockers

---

## ✅ Acceptance Criteria

### Functional Requirements
- [ ] Agents can be set to Chat Mode or Agent Mode
- [ ] Agent Mode agents automatically create to-do lists
- [ ] To-do lists are created via MCP server
- [ ] Tasks execute autonomously
- [ ] Status updates in real-time
- [ ] UI shows to-do list progress
- [ ] Multiple agents can use same server
- [ ] No breaking changes to existing features

### Non-Functional Requirements
- [ ] Response time <500ms for tool calls
- [ ] Real-time updates <1s latency
- [ ] Server uptime >99.9%
- [ ] Handles 100+ concurrent agents
- [ ] Zero data loss
- [ ] WCAG AA accessibility compliance

### Security Requirements
- [ ] RLS prevents unauthorized access
- [ ] Service role properly restricted
- [ ] No plain-text secrets
- [ ] All inputs validated
- [ ] SQL injection prevented
- [ ] XSS protection in UI

---

**This WBS provides a complete, actionable checklist for implementing Chat Mode vs Agent Mode with to-do list management. Check off items as you complete them to track progress.**

**Estimated Total Effort:** 11-14 working days  
**Team Size:** 1-2 developers  
**Priority:** High - Valuable UX Enhancement

