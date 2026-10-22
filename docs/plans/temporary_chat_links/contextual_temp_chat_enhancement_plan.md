# Contextual Temporary Chat Links Enhancement Plan

**Date:** January 10, 2025  
**Status:** Planning - Ready for Implementation  
**Priority:** High - Core Feature Enhancement

---

## 📋 Executive Summary

This document outlines the comprehensive plan to enhance the Temporary Chat Links feature to support **contextual information gathering**. The enhancement transforms temporary chats from isolated support sessions into intelligent extensions of the original conversation, enabling agents to gather information from external participants and automatically bring that context back into the source conversation.

### Key Objectives

1. **Context Preservation**: Temporary chat messages appear in the original conversation where the link was created
2. **Intent-Driven Chats**: Each link has a specific purpose that guides agent behavior
3. **Automatic Engagement**: Agent proactively sends the first message when users open the link
4. **Seamless Integration**: Agent naturally accesses and references temporary chat contents

---

## 🎯 Problem Analysis

### Current State Issues

#### ❌ **Issue 1: Conversation Isolation**
- Temporary chats create **NEW** `conversation_id` - completely isolated from original conversation
- Agent in original conversation cannot see temporary chat messages
- No way to retrieve or reference information gathered via temporary chats
- Breaks the intended use case of information gathering

#### ❌ **Issue 2: No Intent Specification**
- Cannot customize agent behavior for specific temporary chats
- No way to tell agent what information to gather
- Agent uses default personality without context-specific goals

#### ❌ **Issue 3: Passive User Experience**
- User opens link and sees empty chat
- Must initiate conversation themselves
- No guidance on the purpose of the chat
- Reduces engagement and completion rates

#### ❌ **Issue 4: Manual Context Transfer**
- User must manually relay temporary chat contents to agent
- Time-consuming and error-prone
- Defeats the purpose of automated information gathering

### Desired Behavior

#### ✅ **Goal 1: Unified Conversation Context**
```
Original Conversation (ID: conv-123)
├── User: "Get feedback from John on the new feature"
├── Agent: Creates temp link with intent
├── [Temp Chat with John happens]
│   ├── Agent: "Hi John! What do you think of the new feature?"
│   ├── John: "I love the design but the performance is slow"
│   └── Agent: "Thanks for the feedback!"
└── Agent: "John provided feedback. He likes the design but noted performance issues."
```

#### ✅ **Goal 2: Intent-Driven Agent Behavior**
```javascript
{
  chat_intent: "Ask John about new feature feedback - focus on usability and performance",
  system_prompt_override: "Be encouraging and ask follow-up questions about specific pain points"
}
```

#### ✅ **Goal 3: Proactive Engagement**
```
User clicks link → Chat opens → Agent greeting appears immediately
"Hi John! 👋 I'd love to hear your thoughts on the new dashboard we launched. 
What's working well for you?"
```

---

## 🏗️ Solution Architecture

### Design Philosophy

**Core Principle**: Temporary chats are **extensions** of the original conversation, not standalone chats.

### Architectural Approach

Instead of creating a new `conversation_id`, temporary chat sessions should:

1. **Link to Original Conversation**: Reference the `source_conversation_id` where the link was created
2. **Preserve Context**: All messages share the same conversation timeline
3. **Tag Messages**: Use metadata to distinguish temporary chat messages
4. **Guide Behavior**: Store custom intent and system prompt overrides
5. **Auto-Engage**: Send initial agent message when session is created

### High-Level Data Flow

```
[Agent in Original Conversation conv-123]
    ↓
[Agent: "create_temporary_chat_link" with intent]
    ↓
[System: Creates link referencing conv-123]
    ↓
[External User clicks link]
    ↓
[System: Creates session using conv-123 as conversation_id]
    ↓
[System: Auto-sends initial agent message to conv-123]
    ↓
[User & Agent chat - all messages in conv-123]
    ↓
[Agent in Original Conversation sees all messages]
    ↓
[Agent: Uses information gathered in conversation]
```

---

## 🗄️ Database Schema Changes

### Migration 1: Add Context Fields to `temporary_chat_links`

**File:** `supabase/migrations/20250110000001_add_temp_chat_context_fields.sql`

```sql
-- Migration: Add Contextual Fields to Temporary Chat Links
-- Description: Enables intent-driven temporary chats linked to source conversations
-- Date: 2025-01-10

ALTER TABLE temporary_chat_links
  -- Link to the original conversation where this link was created
  ADD COLUMN source_conversation_id UUID REFERENCES conversation_sessions(conversation_id),
  
  -- Custom intent/purpose for this temporary chat
  ADD COLUMN chat_intent TEXT CHECK (LENGTH(chat_intent) <= 2000),
  
  -- Custom system prompt additions (agent behavior modification)
  ADD COLUMN system_prompt_override TEXT CHECK (LENGTH(system_prompt_override) <= 4000),
  
  -- Automatic first message from agent
  ADD COLUMN initial_agent_message TEXT CHECK (LENGTH(initial_agent_message) <= 2000),
  
  -- Whether to auto-send the first message
  ADD COLUMN send_initial_message BOOLEAN NOT NULL DEFAULT TRUE;

-- Create index for source conversation lookups
CREATE INDEX idx_temp_links_source_conversation 
  ON temporary_chat_links(source_conversation_id) 
  WHERE source_conversation_id IS NOT NULL;

-- Add table comments
COMMENT ON COLUMN temporary_chat_links.source_conversation_id IS 
  'Original conversation ID where this temporary chat link was created - messages will be linked back to this conversation for context preservation';

COMMENT ON COLUMN temporary_chat_links.chat_intent IS 
  'The purpose/intent of this temporary chat (e.g., "Gather feedback on project X", "Ask about availability for meeting"). Guides agent behavior and provides context.';

COMMENT ON COLUMN temporary_chat_links.system_prompt_override IS 
  'Additional system prompt instructions to guide agent behavior specifically for this temporary chat session. Appended to agent''s base instructions.';

COMMENT ON COLUMN temporary_chat_links.initial_agent_message IS 
  'First message the agent automatically sends when a user opens the temporary chat link. Should introduce the purpose and ask the first question.';

COMMENT ON COLUMN temporary_chat_links.send_initial_message IS 
  'Whether to automatically send the initial_agent_message when a new session is created. Default: true for proactive engagement.';

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Added contextual fields to temporary_chat_links table';
  RAISE NOTICE '  - source_conversation_id: Links temp chats to original conversation';
  RAISE NOTICE '  - chat_intent: Defines purpose of the temporary chat';
  RAISE NOTICE '  - system_prompt_override: Custom agent behavior';
  RAISE NOTICE '  - initial_agent_message: Auto-sent greeting';
  RAISE NOTICE '  - send_initial_message: Controls auto-greeting behavior';
END $$;
```

### Migration 2: Update Session Creation Documentation

**File:** `supabase/migrations/20250110000002_update_temp_chat_session_docs.sql`

```sql
-- Migration: Update Temporary Chat Session Documentation
-- Description: Clarify conversation_id usage for context preservation
-- Date: 2025-01-10

-- Update the conversation_id column comment to clarify new usage
COMMENT ON COLUMN temporary_chat_sessions.conversation_id IS 
  'Conversation ID from the source conversation (via temporary_chat_links.source_conversation_id). This allows temporary chat messages to appear in the original conversation context where the link was created, enabling the agent to see and reference the gathered information.';

-- Update table comment
COMMENT ON TABLE temporary_chat_sessions IS 
  'Individual chat sessions created through temporary chat links. Sessions now link back to the source conversation for context preservation, allowing agents to access information gathered through temporary chats.';

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Updated temporary_chat_sessions documentation';
  RAISE NOTICE '  - Clarified conversation_id usage for context linking';
END $$;
```

### Migration 3: Update `create_temp_chat_session` Function

**File:** `supabase/migrations/20250110000003_update_create_temp_chat_session_function.sql`

```sql
-- Migration: Update create_temp_chat_session for Context Preservation
-- Description: Modifies session creation to use source conversation and send initial message
-- Date: 2025-01-10

-- Drop existing function
DROP FUNCTION IF EXISTS create_temp_chat_session(TEXT, TEXT, TEXT, INET, TEXT, TEXT);

-- Recreate with enhanced functionality
CREATE OR REPLACE FUNCTION create_temp_chat_session(
  p_link_token TEXT,
  p_participant_identifier TEXT DEFAULT NULL,
  p_participant_name TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL
) RETURNS TABLE (
  session_id UUID,
  session_token TEXT,
  conversation_id UUID,
  agent_id UUID,
  agent_name TEXT,
  is_valid BOOLEAN,
  error_message TEXT,
  initial_agent_message TEXT,  -- ✅ NEW: Return initial message to frontend
  should_send_initial BOOLEAN   -- ✅ NEW: Whether initial message was sent
)
SECURITY DEFINER
AS $$
DECLARE
  v_link_id UUID;
  v_agent_id UUID;
  v_agent_name TEXT;
  v_new_session_id UUID;
  v_new_session_token TEXT;
  v_vault_session_token_id UUID;
  v_source_conversation_id UUID;  -- ✅ NEW: Use existing conversation
  v_conversation_session_id UUID;
  v_current_sessions INTEGER;
  v_max_sessions INTEGER;
  v_is_active BOOLEAN;
  v_expires_at TIMESTAMPTZ;
  v_initial_agent_message TEXT;   -- ✅ NEW: Initial greeting
  v_send_initial BOOLEAN;          -- ✅ NEW: Auto-send flag
  v_chat_intent TEXT;              -- ✅ NEW: Purpose of chat
BEGIN
  -- Find and validate link token using Vault
  SELECT 
    tcl.id, 
    tcl.agent_id, 
    a.name, 
    tcl.max_sessions, 
    tcl.is_active, 
    tcl.expires_at,
    tcl.source_conversation_id,  -- ✅ NEW: Get source conversation
    tcl.initial_agent_message,   -- ✅ NEW: Get initial message
    tcl.send_initial_message,    -- ✅ NEW: Get auto-send flag
    tcl.chat_intent              -- ✅ NEW: Get intent
  INTO 
    v_link_id, 
    v_agent_id, 
    v_agent_name, 
    v_max_sessions, 
    v_is_active, 
    v_expires_at,
    v_source_conversation_id,
    v_initial_agent_message,
    v_send_initial,
    v_chat_intent
  FROM temporary_chat_links tcl
  JOIN agents a ON tcl.agent_id = a.id
  WHERE vault.decrypt_secret(tcl.vault_link_token_id) = p_link_token;
  
  -- Check if link exists
  IF v_link_id IS NULL THEN
    RETURN QUERY SELECT 
      NULL::UUID, ''::TEXT, NULL::UUID, NULL::UUID, ''::TEXT, 
      FALSE, 'Invalid chat link'::TEXT, NULL::TEXT, FALSE;
    RETURN;
  END IF;
  
  -- Check if link is active and not expired
  IF NOT v_is_active OR v_expires_at <= NOW() THEN
    RETURN QUERY SELECT 
      NULL::UUID, ''::TEXT, NULL::UUID, NULL::UUID, ''::TEXT, 
      FALSE, 'Chat link has expired'::TEXT, NULL::TEXT, FALSE;
    RETURN;
  END IF;
  
  -- Check current active sessions count
  SELECT COUNT(*) INTO v_current_sessions
  FROM temporary_chat_sessions
  WHERE link_id = v_link_id AND status = 'active';
  
  -- Check session limit
  IF v_current_sessions >= v_max_sessions THEN
    RETURN QUERY SELECT 
      NULL::UUID, ''::TEXT, NULL::UUID, NULL::UUID, ''::TEXT, 
      FALSE, 'Maximum sessions reached'::TEXT, NULL::TEXT, FALSE;
    RETURN;
  END IF;
  
  -- Generate new session components
  v_new_session_id := gen_random_uuid();
  v_vault_session_token_id := generate_session_token();
  
  -- ✅ CHANGED: Use source_conversation_id instead of generating new one
  -- If no source conversation exists, create a new one (backward compatibility)
  IF v_source_conversation_id IS NULL THEN
    v_source_conversation_id := gen_random_uuid();
    RAISE NOTICE 'No source_conversation_id found for link %. Creating new conversation: %', 
      v_link_id, v_source_conversation_id;
  ELSE
    RAISE NOTICE 'Using existing source_conversation_id: % for link %', 
      v_source_conversation_id, v_link_id;
  END IF;
  
  -- Get the actual session token for return (decrypt from vault)
  v_new_session_token := vault.decrypt_secret(v_vault_session_token_id);
  
  -- Create conversation session in existing table
  INSERT INTO conversation_sessions (
    id, 
    conversation_id,      -- ✅ CHANGED: Use source conversation
    agent_id, 
    status, 
    started_at
  ) VALUES (
    gen_random_uuid(), 
    v_source_conversation_id,  -- ✅ CHANGED: Links to original conversation
    v_agent_id, 
    'active', 
    NOW()
  ) RETURNING id INTO v_conversation_session_id;
  
  RAISE NOTICE 'Created conversation_session % for conversation %', 
    v_conversation_session_id, v_source_conversation_id;
  
  -- Create temporary chat session
  INSERT INTO temporary_chat_sessions (
    id, 
    link_id, 
    vault_session_token_id, 
    conversation_id,              -- ✅ CHANGED: Source conversation
    conversation_session_id,
    participant_identifier, 
    participant_name, 
    ip_address, 
    user_agent, 
    referrer
  ) VALUES (
    v_new_session_id, 
    v_link_id, 
    v_vault_session_token_id, 
    v_source_conversation_id,  -- ✅ CHANGED: Links back to original
    v_conversation_session_id,
    p_participant_identifier, 
    p_participant_name, 
    p_ip_address, 
    p_user_agent, 
    p_referrer
  );
  
  RAISE NOTICE 'Created temporary_chat_session %', v_new_session_id;
  
  -- ✅ NEW: If should_send_initial is true and message exists, insert initial agent message
  IF v_send_initial AND v_initial_agent_message IS NOT NULL THEN
    RAISE NOTICE 'Sending initial agent message to conversation %', v_source_conversation_id;
    
    INSERT INTO chat_messages_v2 (
      conversation_id,
      session_id,
      role,
      content,
      sender_user_id,
      sender_agent_id
    ) VALUES (
      v_source_conversation_id,
      v_conversation_session_id,
      'assistant',
      jsonb_build_object(
        'text', v_initial_agent_message,
        'type', 'text',
        'metadata', jsonb_build_object(
          'temporary_chat', true,
          'temp_session_id', v_new_session_id,
          'temp_link_id', v_link_id,
          'is_initial_greeting', true,
          'chat_intent', v_chat_intent,
          'participant_name', p_participant_name
        )
      ),
      NULL,      -- No user_id (sent by system)
      v_agent_id -- Sent by agent
    );
    
    RAISE NOTICE 'Initial agent message inserted successfully';
  ELSE
    RAISE NOTICE 'No initial message to send (send_initial: %, message: %)', 
      v_send_initial, v_initial_agent_message IS NOT NULL;
  END IF;
  
  -- Return success with initial message info
  RETURN QUERY SELECT 
    v_new_session_id, 
    v_new_session_token, 
    v_source_conversation_id,  -- ✅ CHANGED: Returns source conversation
    v_agent_id, 
    v_agent_name, 
    TRUE, 
    ''::TEXT,
    v_initial_agent_message,  -- ✅ NEW: Initial message for frontend
    v_send_initial            -- ✅ NEW: Whether it was sent
  ;
  
  RAISE NOTICE 'Session creation completed successfully';
END;
$$ LANGUAGE plpgsql;

-- Update function comment
COMMENT ON FUNCTION create_temp_chat_session IS 
  'Creates a new temporary chat session linked to the source conversation. Automatically sends initial agent message if configured. Returns session details including initial message for frontend display.';

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Updated create_temp_chat_session function';
  RAISE NOTICE '  - Now uses source_conversation_id for context preservation';
  RAISE NOTICE '  - Automatically sends initial agent message when configured';
  RAISE NOTICE '  - Returns initial message info to frontend';
  RAISE NOTICE '  - Maintains backward compatibility for links without source conversation';
END $$;
```

---

## 🔌 Backend API Changes

### Change 1: Update `create_temporary_chat_link` MCP Tool

**File:** `supabase/functions/temporary-chat-mcp/index.ts`

#### Update Interface

```typescript
interface CreateTempChatLinkParams {
  agent_id: string;
  user_id: string;
  source_conversation_id: string;  // ✅ NEW: Required - links to original conversation
  title?: string;
  description?: string;
  welcome_message?: string;
  chat_intent?: string;                  // ✅ NEW: Purpose of the chat
  system_prompt_override?: string;       // ✅ NEW: Custom agent behavior
  initial_agent_message?: string;        // ✅ NEW: Auto-sent first message
  send_initial_message?: boolean;        // ✅ NEW: Whether to auto-send
  expires_in_hours?: number;
  max_sessions?: number;
  max_messages_per_session?: number;
  session_timeout_minutes?: number;
  rate_limit_per_minute?: number;
  allowed_domains?: string[];
  ui_customization?: Record<string, any>;
}
```

#### Update Function Implementation

```typescript
async function createTemporaryChatLink(
  supabase: any,
  req: Request,
  params: CreateTempChatLinkParams
): Promise<MCPToolResponse> {
  console.log(`[createTemporaryChatLink] Starting with params:`, JSON.stringify(params, null, 2));
  
  try {
    // Validate required parameters
    if (!params.agent_id || !params.user_id) {
      return {
        success: false,
        error: 'Missing required parameters: agent_id, user_id'
      };
    }

    // ✅ NEW: Validate source_conversation_id (now required for context linking)
    if (!params.source_conversation_id) {
      return {
        success: false,
        error: 'Missing required parameter: source_conversation_id. Temporary chats must be linked to a source conversation for context preservation.'
      };
    }

    // ✅ NEW: Verify source_conversation_id exists and belongs to user/agent
    console.log(`[createTemporaryChatLink] Validating source conversation: ${params.source_conversation_id}`);
    
    const { data: conversation, error: convError } = await supabase
      .from('conversation_sessions')
      .select('conversation_id, agent_id, user_id')
      .eq('conversation_id', params.source_conversation_id)
      .eq('agent_id', params.agent_id)
      .single();

    if (convError || !conversation) {
      console.error(`[createTemporaryChatLink] Source conversation validation failed:`, convError);
      return {
        success: false,
        error: 'Invalid source_conversation_id. The conversation does not exist or is not owned by this agent/user.'
      };
    }

    console.log(`[createTemporaryChatLink] Source conversation validated successfully`);

    // Verify user owns the agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, user_id')
      .eq('id', params.agent_id)
      .eq('user_id', params.user_id)
      .single();

    if (agentError || !agent) {
      return {
        success: false,
        error: `Agent verification failed: ${agentError?.message || 'Agent not found'}`
      };
    }

    console.log(`[createTemporaryChatLink] Agent verified: ${agent.name} (${agent.id})`);

    // Generate defaults for missing parameters
    const defaults = generateTemporaryChatDefaults(agent.name, params);
    
    // ✅ NEW: Generate intelligent initial_agent_message if not provided
    if (params.send_initial_message !== false && !params.initial_agent_message) {
      if (params.chat_intent) {
        // Use chat_intent to create contextual greeting
        defaults.initial_agent_message = `Hi! ${params.chat_intent}`;
      } else {
        // Fallback to generic greeting
        defaults.initial_agent_message = `Hello! I'm here to help. ${defaults.welcome_message || 'How can I assist you today?'}`;
      }
      console.log(`[createTemporaryChatLink] Generated initial message: ${defaults.initial_agent_message.substring(0, 50)}...`);
    } else if (params.initial_agent_message) {
      defaults.initial_agent_message = params.initial_agent_message;
      console.log(`[createTemporaryChatLink] Using provided initial message`);
    }

    // Generate secure token using database function
    console.log(`[createTemporaryChatLink] Generating secure token`);
    const { data: tokenResult, error: tokenError } = await supabase
      .rpc('generate_temp_chat_token');

    if (tokenError || !tokenResult) {
      return {
        success: false,
        error: `Failed to generate secure token: ${tokenError?.message || 'null result'}`
      };
    }

    console.log(`[createTemporaryChatLink] Token generated successfully: ${tokenResult}`);

    // Calculate expiration time
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (defaults.expires_in_hours * 60 * 60 * 1000));
    
    // Create the temporary chat link with new fields
    const insertData = {
      agent_id: params.agent_id,
      user_id: params.user_id,
      vault_link_token_id: tokenResult,
      source_conversation_id: params.source_conversation_id,  // ✅ NEW: Link to source
      title: defaults.title,
      description: defaults.description,
      welcome_message: defaults.welcome_message,
      chat_intent: params.chat_intent || null,                // ✅ NEW: Purpose
      system_prompt_override: params.system_prompt_override || null,  // ✅ NEW: Custom behavior
      initial_agent_message: defaults.initial_agent_message,  // ✅ NEW: Greeting
      send_initial_message: params.send_initial_message !== false,  // ✅ NEW: Auto-send flag
      expires_at: expiresAt.toISOString(),
      max_sessions: defaults.max_sessions,
      max_messages_per_session: defaults.max_messages_per_session,
      session_timeout_minutes: defaults.session_timeout_minutes,
      rate_limit_per_minute: defaults.rate_limit_per_minute,
      allowed_domains: defaults.allowed_domains,
      ui_customization: defaults.ui_customization
    };
    
    console.log(`[createTemporaryChatLink] Inserting data with new fields:`, {
      ...insertData,
      vault_link_token_id: '***',
      source_conversation_id: insertData.source_conversation_id,
      chat_intent: insertData.chat_intent ? 'PROVIDED' : 'NULL',
      system_prompt_override: insertData.system_prompt_override ? 'PROVIDED' : 'NULL',
      initial_agent_message: insertData.initial_agent_message ? 'PROVIDED' : 'NULL'
    });
    
    const { data: link, error: linkError } = await supabase
      .from('temporary_chat_links')
      .insert(insertData)
      .select('id, title, expires_at, max_sessions, created_at, chat_intent, source_conversation_id')
      .single();

    if (linkError) {
      return {
        success: false,
        error: `Failed to create temporary chat link: ${linkError.message}`
      };
    }

    // Get the actual token for the response (decrypt from vault)
    console.log(`[createTemporaryChatLink] Decrypting token for URL generation`);
    
    let actualToken = null;
    try {
      const { data: decryptedToken, error: decryptError } = await supabase
        .rpc('vault_decrypt', { vault_id: tokenResult });
      
      if (decryptError) {
        console.error(`[createTemporaryChatLink] Vault decrypt error:`, decryptError);
      } else {
        actualToken = decryptedToken?.replace(/[\r\n\s]/g, '');
        console.log(`[createTemporaryChatLink] Token decrypted successfully`);
      }
    } catch (vaultError) {
      console.error(`[createTemporaryChatLink] Vault access error:`, vaultError);
    }

    return {
      success: true,
      data: {
        link_id: link.id,
        title: link.title,
        agent_name: agent.name,
        expires_at: link.expires_at,
        max_sessions: link.max_sessions,
        created_at: link.created_at,
        public_url: actualToken ? `${getBaseUrl(req)}/temp-chat/${actualToken.trim()}` : null,
        token_hint: actualToken ? actualToken.substring(0, 8) + '...' : 'Token created securely',
        // ✅ NEW: Include context information in response
        context: {
          source_conversation_id: link.source_conversation_id,
          chat_intent: link.chat_intent,
          has_custom_behavior: !!params.system_prompt_override,
          will_send_greeting: params.send_initial_message !== false
        }
      },
      metadata: {
        agent_id: params.agent_id,
        user_id: params.user_id,
        vault_token_id: tokenResult,
        source_conversation_id: link.source_conversation_id  // ✅ NEW: For tracking
      }
    };

  } catch (error) {
    console.error(`[createTemporaryChatLink] Error:`, error);
    return {
      success: false,
      error: `Error creating temporary chat link: ${error.message}`
    };
  }
}
```

#### Update Defaults Generator

```typescript
function generateTemporaryChatDefaults(agentName: string, params: any) {
  const randomSequence = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  const defaults = {
    title: params.title || `${agentName} temp_chat ${randomSequence}`,
    description: params.description || 'A temporary chat',
    welcome_message: params.welcome_message || 
      `This is a temporary chat. It will end in ${params.expires_in_hours || 1} hour${(params.expires_in_hours || 1) > 1 ? 's' : ''}.`,
    expires_in_hours: params.expires_in_hours || 1,
    max_sessions: params.max_sessions || 1,
    max_messages_per_session: params.max_messages_per_session || 100,
    session_timeout_minutes: params.session_timeout_minutes || 60,
    rate_limit_per_minute: params.rate_limit_per_minute || 10,
    allowed_domains: params.allowed_domains || null,
    ui_customization: params.ui_customization || {},
    // ✅ NEW: Default initial message (will be overridden if chat_intent exists)
    initial_agent_message: params.initial_agent_message || null
  };
  
  return defaults;
}
```

### Change 2: Update `temporary-chat-api` to Return Initial Message

**File:** `supabase/functions/temporary-chat-api/index.ts`

```typescript
async function handleCreateSession(req: Request, supabase: any): Promise<Response> {
  try {
    const { 
      link_token, 
      participant_identifier, 
      participant_name,
      metadata = {}
    }: CreateSessionRequest = await req.json();
    
    if (!link_token) {
      return new Response(
        JSON.stringify({ error: 'Missing link_token parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[temporary-chat-api] Creating session for token: ${link_token.substring(0, 8)}...`);

    // Get client information for security tracking
    const clientIP = req.headers.get('cf-connecting-ip') || 
                     req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') ||
                     'unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const referrer = req.headers.get('referer') || '';

    // Use database function to create session
    const { data, error } = await supabase.rpc('create_temp_chat_session', {
      p_link_token: link_token,
      p_participant_identifier: participant_identifier,
      p_participant_name: participant_name,
      p_ip_address: clientIP,
      p_user_agent: userAgent,
      p_referrer: referrer
    });

    if (error || !data || data.length === 0) {
      console.error('[temporary-chat-api] Create session error:', error);
      return new Response(
        JSON.stringify({ 
          error: data?.[0]?.error_message || 'Failed to create session',
          details: error?.message
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionData = data[0];
    
    if (!sessionData.is_valid) {
      return new Response(
        JSON.stringify({ 
          error: sessionData.error_message || 'Could not create valid session',
          valid: false
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[temporary-chat-api] Session created successfully: ${sessionData.session_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          session: {
            id: sessionData.session_id,
            session_token: sessionData.session_token,
            conversation_id: sessionData.conversation_id,
            agent_id: sessionData.agent_id,
            agent_name: sessionData.agent_name,
            message_count: 0,
            status: 'active',
            // ✅ NEW: Include initial message info
            initial_agent_message: sessionData.initial_agent_message,
            has_initial_message: sessionData.should_send_initial && !!sessionData.initial_agent_message
          }
        }
      }),
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[temporary-chat-api] Create session error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create session',
        message: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
```

### Change 3: Update `temporary-chat-handler` for Intent

**File:** `supabase/functions/temporary-chat-handler/index.ts`

```typescript
// In the message processing section, fetch link details including intent

// After validating session, get link details
console.log(`[temporary-chat-handler] Fetching link details for intent/system prompt`);

const { data: linkDetails, error: linkError } = await supabase
  .from('temporary_chat_links')
  .select('id, title, chat_intent, system_prompt_override, description')
  .eq('id', session.link_id)
  .single();

if (linkError) {
  console.error(`[temporary-chat-handler] Error fetching link details:`, linkError);
}

console.log(`[temporary-chat-handler] Link details retrieved:`, {
  title: linkDetails?.title,
  has_intent: !!linkDetails?.chat_intent,
  has_override: !!linkDetails?.system_prompt_override
});

// ... existing message saving logic ...

// When calling the chat function, include intent and system prompt override
const chatRequestBody = {
  message: sanitizedMessage,
  conversationId: session.conversation_id,
  agentId: session.agent_id,
  sessionType: 'temporary_chat',
  sessionContext: {
    session_id: session.session_id,
    session_token: session_token,
    participant_name: metadata.participant_name,
    is_temporary_chat: true,
    max_messages: session.max_messages_per_session,
    current_messages: session.current_message_count + 1,
    // ✅ NEW: Add intent and context
    chat_intent: linkDetails?.chat_intent,
    link_title: linkDetails?.title,
    link_description: linkDetails?.description
  },
  // ✅ NEW: Add system prompt override
  systemPromptOverride: linkDetails?.system_prompt_override
};

console.log(`[temporary-chat-handler] Calling chat function with context:`, {
  has_intent: !!chatRequestBody.sessionContext.chat_intent,
  has_override: !!chatRequestBody.systemPromptOverride,
  intent_preview: chatRequestBody.sessionContext.chat_intent?.substring(0, 50)
});
```

### Change 4: Update Main Chat Function

**File:** `supabase/functions/chat/index.ts` or relevant processor

```typescript
// In the chat processing logic, check for systemPromptOverride

// When building system instructions for the agent
let systemInstructions = agent.instructions || '';

// ✅ NEW: Check for system prompt override from temporary chat
if (requestBody.systemPromptOverride) {
  console.log(`[chat] Applying system prompt override from temporary chat link`);
  systemInstructions += `\n\n--- Special Instructions for This Conversation ---\n${requestBody.systemPromptOverride}`;
}

// ✅ NEW: Check for chat intent
if (requestBody.sessionContext?.chat_intent) {
  console.log(`[chat] Applying chat intent: ${requestBody.sessionContext.chat_intent.substring(0, 50)}...`);
  systemInstructions += `\n\n--- Your Goal for This Conversation ---\n${requestBody.sessionContext.chat_intent}\n\nFocus on gathering this information and be conversational and engaging.`;
}

// Log the enhanced system instructions
console.log(`[chat] System instructions length: ${systemInstructions.length} characters`);
console.log(`[chat] Has override: ${!!requestBody.systemPromptOverride}, Has intent: ${!!requestBody.sessionContext?.chat_intent}`);

// Continue with normal chat processing using enhanced systemInstructions
```

---

## 🎨 Frontend Changes

### Change 1: Update TempChatPage for Initial Message

**File:** `src/pages/TempChatPage.tsx`

```typescript
// Update the createChatSession function

const createChatSession = async () => {
  try {
    console.log('Creating chat session for token:', token?.substring(0, 8) + '...');
    
    const response = await fetch(
      `${supabaseUrl.replace('/rest/v1', '')}/functions/v1/temporary-chat-api/create-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ link_token: token })
      }
    );

    const result = await response.json();
    console.log('Session creation result:', result);

    if (result.success) {
      const sessionData = result.data?.session || result.session || result;
      setSession(sessionData);
      console.log('Session set successfully:', sessionData);
      
      // ✅ NEW: Check if there's an initial agent message that was auto-sent
      if (sessionData.initial_agent_message && sessionData.has_initial_message) {
        console.log('Initial agent message detected, displaying immediately');
        
        // Show the initial message that was already sent to the database
        setMessages([{
          id: 'initial-greeting',
          content: sessionData.initial_agent_message,
          role: 'assistant',
          timestamp: new Date().toISOString()
        }]);
        
        // ✅ FUTURE ENHANCEMENT: Could also establish SSE connection here
        // to receive the message via real-time subscription for consistency
        
      } else if (linkData?.welcome_message) {
        // Fallback to welcome_message if no initial message was sent
        // (backward compatibility for links without initial_agent_message)
        console.log('Using welcome_message as fallback');
        setMessages([{
          id: 'welcome',
          content: linkData.welcome_message,
          role: 'assistant',
          timestamp: new Date().toISOString()
        }]);
      } else {
        console.log('No initial message or welcome message to display');
      }
    } else {
      console.error('Session creation failed:', result.error);
      setError(result.error || 'Failed to create chat session');
    }
  } catch (err) {
    console.error('Error creating chat session:', err);
    setError('Failed to create chat session');
  }
};
```

### Change 2: Update Tool Parameter Schema

**File:** `supabase/functions/get-agent-tools/tool-generator.ts`

```typescript
// Update the create_temporary_chat_link tool schema

if (toolName === 'create_temporary_chat_link') {
  return {
    ...baseSchema,
    properties: {
      source_conversation_id: { 
        type: 'string', 
        description: 'ID of the current conversation where this link is being created. This link will be tied to this conversation, and all messages from the temporary chat will appear here. (Automatically provided by the system)'
      },  // ✅ NEW - REQUIRED
      
      chat_intent: { 
        type: 'string', 
        description: 'The specific purpose of this temporary chat. What information do you want to gather? Example: "Ask about their project timeline and any blockers they are facing" or "Gather feedback on the new dashboard feature"'
      },  // ✅ NEW - Highly recommended
      
      initial_agent_message: { 
        type: 'string', 
        description: 'The first message you want to send automatically when the user opens the chat link. This should introduce the purpose and ask the first question. Example: "Hi! Can you share your plans for today and any blockers you\'re facing?"'
      },  // ✅ NEW - Highly recommended
      
      title: { 
        type: 'string', 
        description: 'Title for the temporary chat link (optional - will auto-generate based on chat_intent if not provided)' 
      },
      
      description: { 
        type: 'string', 
        description: 'Brief description shown to users when they open the link (optional)' 
      },
      
      system_prompt_override: { 
        type: 'string', 
        description: 'Additional instructions to modify your behavior specifically for this temporary chat. Use this to adjust your tone, focus, or approach. Example: "Be very encouraging and positive. Focus on solutions rather than problems." (Advanced - optional)'
      },  // ✅ NEW - Advanced/optional
      
      send_initial_message: {
        type: 'boolean',
        description: 'Whether to automatically send the initial_agent_message when user opens the link. Default: true',
        default: true
      },  // ✅ NEW - Optional override
      
      welcome_message: { 
        type: 'string', 
        description: 'Additional welcome text shown in the UI header (optional, different from initial_agent_message)' 
      },
      
      expires_in_hours: { 
        type: 'number', 
        description: 'How many hours until the link expires', 
        default: 1,
        minimum: 1,
        maximum: 168  // 7 days
      },
      
      max_sessions: { 
        type: 'number', 
        description: 'Maximum number of people who can use this link concurrently', 
        default: 1,
        minimum: 1,
        maximum: 50
      },
      
      max_messages_per_session: { 
        type: 'number', 
        description: 'Maximum messages allowed per chat session', 
        default: 100,
        minimum: 1,
        maximum: 1000
      },
      
      session_timeout_minutes: { 
        type: 'number', 
        description: 'Minutes of inactivity before session times out', 
        default: 60,
        minimum: 5,
        maximum: 1440  // 24 hours
      },
      
      rate_limit_per_minute: { 
        type: 'number', 
        description: 'Maximum messages per minute (rate limiting)', 
        default: 10,
        minimum: 1,
        maximum: 100
      },
      
      allowed_domains: { 
        type: 'array', 
        items: { type: 'string' }, 
        description: 'Optional: Restrict link access to specific domains' 
      },
      
      ui_customization: { 
        type: 'object', 
        description: 'Optional: Custom UI styling (advanced)' 
      }
    },
    required: ['source_conversation_id']  // ✅ NEW: Now required for context linking
  };
}
```

### Change 3: Auto-Provide source_conversation_id in Tool Executor

**File:** `supabase/functions/chat/function_calling/universal-tool-executor.ts`

```typescript
// Update the create_temporary_chat_link routing to auto-provide conversation ID

'create_temporary_chat_link': {
  edgeFunction: 'temporary-chat-mcp',
  actionMapping: () => 'create_temporary_chat_link',
  parameterMapping: (params: Record<string, any>, context: any) => {
    console.log(`[UniversalToolExecutor] Mapping create_temporary_chat_link parameters`);
    console.log(`[UniversalToolExecutor] Context conversation ID: ${context.conversationId}`);
    
    return {
      action: 'create_temporary_chat_link',
      agent_id: context.agentId,
      user_id: context.userId,
      tool_name: context.toolName,
      source_conversation_id: context.conversationId,  // ✅ NEW: Auto-provide current conversation
      ...params  // User/agent-provided parameters override if needed
    };
  }
},
```

---

## 📊 Updated MCP Tool Interface

### Example Usage Scenarios

#### Scenario 1: Daily Team Check-ins

**User Request:**
```
"Create check-in links for the team to share their daily plans"
```

**Agent Action:**
```javascript
create_temporary_chat_link({
  source_conversation_id: "conv-123",  // Auto-provided
  title: "Daily Check-in - Sarah",
  chat_intent: "Ask Sarah about her plans for today and if she has any blockers or needs help with anything",
  initial_agent_message: "Good morning Sarah! 👋 What are you planning to work on today? Let me know if you have any blockers I can help with.",
  expires_in_hours: 4,
  max_messages_per_session: 20,
  session_timeout_minutes: 60
})
```

**Result Flow:**
```
1. Link created: https://agentopia.netlify.app/temp-chat/abc123...
2. Sarah clicks link
3. Agent greeting appears immediately: "Good morning Sarah! 👋 ..."
4. Sarah responds: "Working on the API integration. Stuck on authentication."
5. Agent: "I can help with that! What specific authentication method are you using?"
6. Sarah: "OAuth 2.0, but the tokens aren't refreshing properly."
7. Agent: "Thanks for sharing! I'll note this down."

Back in original conversation (conv-123):
8. Agent: "Sarah checked in. She's working on API integration but having issues with OAuth 2.0 token refresh. She needs help with authentication."
9. User can now address Sarah's blocker directly
```

#### Scenario 2: Feature Feedback Collection

**User Request:**
```
"Get detailed feedback from John on the new dashboard"
```

**Agent Action:**
```javascript
create_temporary_chat_link({
  source_conversation_id: "conv-456",  // Auto-provided
  title: "Dashboard Feedback - John",
  chat_intent: "Gather John's detailed feedback on the new dashboard. Focus on: usability, performance, missing features, and overall satisfaction. Ask follow-up questions to get specific details.",
  initial_agent_message: "Hi John! 👋 I'd love to hear your thoughts on the new dashboard we launched last week. What's your first impression?",
  system_prompt_override: "Be very encouraging and positive. When John mentions issues, probe for specific examples and severity. End by asking for a satisfaction rating.",
  expires_in_hours: 48,
  max_messages_per_session: 30
})
```

**Result:**
```
John's feedback automatically appears in conv-456
Agent can summarize and analyze feedback
User gets actionable insights without manual relay
```

#### Scenario 3: Meeting Availability

**User Request:**
```
"Ask the team about their availability for the planning meeting next week"
```

**Agent Action (creates multiple links):**
```javascript
// For each team member:
create_temporary_chat_link({
  source_conversation_id: "conv-789",
  title: "Planning Meeting Availability - [Name]",
  chat_intent: "Ask [Name] about their availability for the planning meeting next week (Oct 14-18). Get specific days and times that work best.",
  initial_agent_message: "Hi! 👋 We're planning a team meeting for next week (Oct 14-18). Which days and times work best for you?",
  expires_in_hours: 72,
  max_messages_per_session: 15
})
```

**Result:**
```
All team members' availability responses appear in conv-789
Agent can analyze and suggest best meeting time
Eliminates back-and-forth scheduling emails
```

---

## 🔍 Context Retrieval for Agent

### Automatic Context (Primary Method)

**How it works:**

Since temporary chat messages share the same `conversation_id` as the original conversation, they automatically appear in the agent's context when the chat function retrieves conversation history.

**No additional code needed** - the existing context builder will include temporary chat messages naturally.

**Example:**
```typescript
// In chat function's context builder
const { data: messages } = await supabase
  .from('chat_messages_v2')
  .select('*')
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: true })
  .limit(50);

// This will include:
// - Original conversation messages
// - Temporary chat messages (tagged with metadata.temporary_chat: true)
// - All in chronological order
```

### Message Identification

Temporary chat messages are identified by metadata:

```json
{
  "content": {
    "text": "I love the new design but performance is slow",
    "type": "text",
    "metadata": {
      "temporary_chat": true,
      "temp_session_id": "session-uuid",
      "temp_link_id": "link-uuid",
      "is_initial_greeting": false,
      "chat_intent": "Gather feedback on dashboard",
      "participant_name": "John Doe"
    }
  }
}
```

### Optional: Explicit Transcript Tool (Enhancement)

For advanced use cases, add a dedicated MCP tool:

**Tool:** `get_temporary_chat_transcript`

```typescript
async function getTemporaryChatTranscript(
  supabase: any,
  params: {
    agent_id: string;
    user_id: string;
    link_id?: string;
    conversation_id?: string;
    include_summary?: boolean;
  }
): Promise<MCPToolResponse> {
  
  // Build query based on parameters
  let query = supabase
    .from('temporary_chat_sessions')
    .select(`
      id,
      started_at,
      ended_at,
      participant_name,
      participant_identifier,
      message_count,
      status,
      temporary_chat_links!inner(
        id,
        title,
        chat_intent,
        description,
        source_conversation_id,
        created_at
      )
    `)
    .eq('temporary_chat_links.user_id', params.user_id)
    .eq('temporary_chat_links.agent_id', params.agent_id);

  // Filter by link_id if provided
  if (params.link_id) {
    query = query.eq('link_id', params.link_id);
  }

  // Filter by conversation_id if provided
  if (params.conversation_id) {
    query = query.eq('temporary_chat_links.source_conversation_id', params.conversation_id);
  }

  const { data: sessions, error: sessionsError } = await query;

  if (sessionsError) {
    return {
      success: false,
      error: `Failed to fetch temporary chat sessions: ${sessionsError.message}`
    };
  }

  // Get messages for these sessions
  const sessionIds = sessions.map(s => s.id);
  
  if (sessionIds.length === 0) {
    return {
      success: true,
      data: {
        sessions: [],
        messages: [],
        summary: 'No temporary chat sessions found'
      }
    };
  }

  const { data: messages, error: messagesError } = await supabase
    .from('chat_messages_v2')
    .select('id, role, content, created_at, sender_agent_id, sender_user_id')
    .in('content->metadata->>temp_session_id', sessionIds)
    .order('created_at', { ascending: true });

  if (messagesError) {
    return {
      success: false,
      error: `Failed to fetch messages: ${messagesError.message}`
    };
  }

  // Format response
  const formattedSessions = sessions.map(session => ({
    session_id: session.id,
    participant: session.participant_name || session.participant_identifier || 'Anonymous',
    link_title: session.temporary_chat_links.title,
    chat_intent: session.temporary_chat_links.chat_intent,
    started_at: session.started_at,
    ended_at: session.ended_at,
    status: session.status,
    message_count: session.message_count,
    messages: messages.filter(m => 
      m.content?.metadata?.temp_session_id === session.id
    ).map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content.text,
      timestamp: m.created_at
    }))
  }));

  // Generate summary if requested
  let summary = null;
  if (params.include_summary) {
    summary = formattedSessions.map(s => {
      const participantMessages = s.messages.filter(m => m.role === 'user');
      return `${s.participant} (${s.link_title}): Shared ${participantMessages.length} responses. Intent: ${s.chat_intent}`;
    }).join('\n');
  }

  return {
    success: true,
    data: {
      sessions: formattedSessions,
      total_sessions: formattedSessions.length,
      total_messages: messages.length,
      summary: summary
    },
    metadata: {
      agent_id: params.agent_id,
      user_id: params.user_id,
      query_conversation_id: params.conversation_id
    }
  };
}
```

---

## ✅ Implementation Checklist

### Phase 1: Database Changes ✅
**Estimated Time:** 1-2 hours

- [ ] Create migration `20250110000001_add_temp_chat_context_fields.sql`
  - [ ] Add `source_conversation_id` column
  - [ ] Add `chat_intent` column
  - [ ] Add `system_prompt_override` column
  - [ ] Add `initial_agent_message` column
  - [ ] Add `send_initial_message` column
  - [ ] Add index on `source_conversation_id`
  - [ ] Add comments for documentation

- [ ] Create migration `20250110000002_update_temp_chat_session_docs.sql`
  - [ ] Update `conversation_id` column comment
  - [ ] Update table comment

- [ ] Create migration `20250110000003_update_create_temp_chat_session_function.sql`
  - [ ] Drop existing function
  - [ ] Recreate with new return columns
  - [ ] Add logic to use `source_conversation_id`
  - [ ] Add logic to insert initial agent message
  - [ ] Add backward compatibility for links without source

- [ ] Test migrations locally
  - [ ] Run `supabase db reset` (in dev environment only)
  - [ ] Verify all columns created
  - [ ] Verify function works
  - [ ] Test backward compatibility

### Phase 2: Backend MCP Tool Changes ✅
**Estimated Time:** 2-3 hours

- [ ] Update `supabase/functions/temporary-chat-mcp/index.ts`
  - [ ] Update `CreateTempChatLinkParams` interface
  - [ ] Add source_conversation_id validation
  - [ ] Update defaults generator for initial message
  - [ ] Update insertData to include new fields
  - [ ] Update response to include context info
  - [ ] Add comprehensive logging

- [ ] Update `supabase/functions/get-agent-tools/tool-generator.ts`
  - [ ] Update `create_temporary_chat_link` schema
  - [ ] Add `source_conversation_id` property (required)
  - [ ] Add `chat_intent` property
  - [ ] Add `system_prompt_override` property
  - [ ] Add `initial_agent_message` property
  - [ ] Add `send_initial_message` property
  - [ ] Update descriptions with examples

- [ ] Update `supabase/functions/chat/function_calling/universal-tool-executor.ts`
  - [ ] Update `create_temporary_chat_link` parameterMapping
  - [ ] Auto-provide `source_conversation_id` from context
  - [ ] Add logging for conversation ID

- [ ] Test MCP tool locally
  - [ ] Create temp link with all new parameters
  - [ ] Verify database record created correctly
  - [ ] Verify response includes context info

### Phase 3: Backend API Changes ✅
**Estimated Time:** 2-3 hours

- [ ] Update `supabase/functions/temporary-chat-api/index.ts`
  - [ ] Update `handleCreateSession` to return initial message
  - [ ] Update response format with new fields
  - [ ] Add logging for initial message info

- [ ] Update `supabase/functions/temporary-chat-handler/index.ts`
  - [ ] Add query to fetch link details (intent, system prompt)
  - [ ] Update chat request body with new context fields
  - [ ] Add `systemPromptOverride` to chat call
  - [ ] Add comprehensive logging

- [ ] Update main chat function (chat/index.ts or processor)
  - [ ] Check for `systemPromptOverride` in request
  - [ ] Append override to agent instructions
  - [ ] Check for `chat_intent` in sessionContext
  - [ ] Append intent to agent instructions
  - [ ] Add logging for enhanced instructions

- [ ] Test API flow
  - [ ] Create session via API
  - [ ] Verify initial message returned
  - [ ] Send message with intent
  - [ ] Verify agent behavior reflects intent

### Phase 4: Frontend Changes ✅
**Estimated Time:** 1-2 hours

- [ ] Update `src/pages/TempChatPage.tsx`
  - [ ] Update `createChatSession` function
  - [ ] Check for `initial_agent_message` in response
  - [ ] Display initial message immediately if present
  - [ ] Maintain backward compatibility for welcome_message
  - [ ] Add logging for message display

- [ ] Test frontend experience
  - [ ] Open temp chat link
  - [ ] Verify initial agent message appears
  - [ ] Verify it appears instantly (not after delay)
  - [ ] Test with and without initial message
  - [ ] Test backward compatibility

### Phase 5: Integration Testing ✅
**Estimated Time:** 2-3 hours

- [ ] End-to-end test: Context preservation
  - [ ] Create temp link from conversation A
  - [ ] Have anonymous user chat via link
  - [ ] Verify messages appear in conversation A
  - [ ] Verify agent can see messages in context
  - [ ] Verify chronological order maintained

- [ ] End-to-end test: Intent-driven behavior
  - [ ] Create link with specific chat_intent
  - [ ] Verify agent follows intent guidance
  - [ ] Test with system_prompt_override
  - [ ] Verify agent behavior changes accordingly

- [ ] End-to-end test: Automatic greeting
  - [ ] Create link with initial_agent_message
  - [ ] Open link in incognito window
  - [ ] Verify greeting appears immediately
  - [ ] Verify greeting is in conversation history
  - [ ] Test with send_initial_message=false

- [ ] Test backward compatibility
  - [ ] Create link without new fields
  - [ ] Verify it still works (creates new conversation)
  - [ ] Verify no errors or breaks

- [ ] Test edge cases
  - [ ] Invalid source_conversation_id
  - [ ] Source conversation from different user
  - [ ] Very long chat_intent (>2000 chars)
  - [ ] Very long system_prompt_override (>4000 chars)
  - [ ] Empty initial_agent_message
  - [ ] Multiple concurrent sessions on same link

### Phase 6: Documentation ✅
**Estimated Time:** 1-2 hours

- [ ] Update `README/temporary-chat-links.md`
  - [ ] Add "Context Preservation" section
  - [ ] Update "Architecture" section
  - [ ] Add examples for new parameters
  - [ ] Update use case examples
  - [ ] Add troubleshooting for new features

- [ ] Create migration guide
  - [ ] Document breaking changes (none expected)
  - [ ] Document new required parameter
  - [ ] Provide upgrade path for existing links
  - [ ] Add FAQ section

- [ ] Update API documentation
  - [ ] Document new MCP tool parameters
  - [ ] Add request/response examples
  - [ ] Document behavior changes
  - [ ] Add best practices

- [ ] Update inline code comments
  - [ ] Add comments for context linking logic
  - [ ] Document intent system
  - [ ] Explain backward compatibility

### Phase 7: Deployment ✅
**Estimated Time:** 1 hour

- [ ] Deploy database migrations
  - [ ] Backup production database
  - [ ] Run migrations: `supabase db push --include-all`
  - [ ] Verify migrations applied
  - [ ] Test with production data

- [ ] Deploy edge functions
  - [ ] Deploy temporary-chat-mcp: `supabase functions deploy temporary-chat-mcp`
  - [ ] Deploy temporary-chat-api: `supabase functions deploy temporary-chat-api`
  - [ ] Deploy temporary-chat-handler: `supabase functions deploy temporary-chat-handler`
  - [ ] Deploy chat function: `supabase functions deploy chat`
  - [ ] Deploy get-agent-tools: `supabase functions deploy get-agent-tools`
  - [ ] Verify all functions deployed

- [ ] Deploy frontend
  - [ ] Build production: `npm run build`
  - [ ] Deploy to Netlify/Vercel
  - [ ] Verify deployment successful
  - [ ] Test in production environment

- [ ] Post-deployment verification
  - [ ] Create test temp link
  - [ ] Test anonymous user flow
  - [ ] Verify context preservation works
  - [ ] Monitor logs for errors
  - [ ] Check performance metrics

---

## 📈 Expected Benefits

### 1. ✅ Context Preservation
**Before:** Temporary chat messages isolated, manual relay required  
**After:** All messages automatically in conversation timeline, agent has full context

### 2. ✅ Agent Memory
**Before:** Agent can't access temp chat contents  
**After:** Agent naturally remembers and references information gathered

### 3. ✅ Intent-Driven Conversations
**Before:** Generic agent behavior for all temp chats  
**After:** Each link has specific purpose, agent behavior customized per intent

### 4. ✅ Better User Experience
**Before:** User sees empty chat, must initiate  
**After:** Agent proactively starts conversation with clear purpose

### 5. ✅ Reduced Manual Work
**Before:** User must summarize temp chat for agent  
**After:** Information automatically available, zero manual transfer

### 6. ✅ Higher Completion Rates
**Before:** Users confused about purpose, abandon chat  
**After:** Clear intent and proactive greeting increases engagement

### 7. ✅ Backward Compatible
**Before:** N/A  
**After:** Existing links continue working, gradual migration possible

### 8. ✅ Flexible & Scalable
**Before:** One-size-fits-all approach  
**After:** Customizable per use case, scales to any number of temp chats

---

## 🎓 Key Implementation Principles

### 1. Backward Compatibility
- Existing links without `source_conversation_id` still work
- System creates new conversation if source not provided
- No breaking changes to existing functionality

### 2. Security Maintained
- All existing security measures preserved
- Validation of conversation ownership
- RLS policies still enforce user isolation

### 3. Performance Optimized
- Indexes added for efficient lookups
- Minimal additional database queries
- No impact on existing chat performance

### 4. Developer Friendly
- Clear parameter descriptions
- Comprehensive logging
- Graceful error handling
- Extensive documentation

### 5. User Experience First
- Automatic greeting creates engagement
- Clear purpose reduces confusion
- Seamless integration feels natural
- Mobile-responsive maintained

---

## 🔮 Future Enhancements

### Short-term (Next Sprint)
- [ ] Visual indicator in original conversation for temp chat messages
- [ ] Summary tool to aggregate multiple temp chat responses
- [ ] Real-time SSE for initial message delivery
- [ ] UI in agent chat to manage active temp chat links

### Medium-term (1-2 Months)
- [ ] Template system for common temp chat patterns
- [ ] Analytics dashboard for temp chat effectiveness
- [ ] Bulk link creation for team-wide distribution
- [ ] Integration with email systems for automatic distribution

### Long-term (3-6 Months)
- [ ] AI-powered intent suggestion based on conversation
- [ ] Automatic summarization of temp chat contents
- [ ] Multi-step temp chat workflows (sequential questions)
- [ ] Integration with calendar for scheduled temp chats

---

## 📞 Support & Questions

### Development Questions
- Review this plan document
- Check inline code comments
- Review API documentation
- Search existing temp chat migrations

### Testing Issues
- Check console logs for detailed error messages
- Verify database migrations applied correctly
- Test with fresh database state
- Review function logs in Supabase Dashboard

### Deployment Issues
- Verify all migrations applied: `supabase db remote list`
- Check function deployment status
- Review edge function logs
- Test in staging environment first

---

## ✅ Success Criteria

### Functional Requirements
✅ Temporary chat messages appear in original conversation  
✅ Agent can reference temp chat contents naturally  
✅ Custom intent guides agent behavior  
✅ Automatic greeting sends on chat open  
✅ Source conversation ID validates correctly  
✅ Backward compatibility maintained  

### Non-Functional Requirements
✅ No performance degradation  
✅ Security standards maintained  
✅ Comprehensive error handling  
✅ Clear logging for debugging  
✅ Mobile-responsive experience  
✅ Graceful failure modes  

### Documentation Requirements
✅ README updated with new features  
✅ API documentation complete  
✅ Migration guide provided  
✅ Inline code comments added  
✅ Examples for common use cases  
✅ Troubleshooting guide included  

---

## 🎯 Conclusion

This enhancement transforms Temporary Chat Links from standalone support chats into **intelligent information-gathering extensions** of the original conversation. By linking temporary chats to their source conversation, storing custom intent, and automatically engaging users with a greeting, the system enables truly contextual AI-driven information gathering.

The implementation maintains backward compatibility, preserves all existing security measures, and provides a clear upgrade path for existing deployments. The phased approach ensures each component can be tested independently, reducing deployment risk.

**Ready for Implementation:** All requirements defined, architecture designed, and implementation steps documented. Proceed with Phase 1 when ready.

---

**Document Version:** 1.0  
**Last Updated:** January 10, 2025  
**Status:** Planning Complete - Ready for Development  
**Estimated Total Implementation Time:** 12-16 hours

