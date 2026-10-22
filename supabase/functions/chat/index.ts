// Chat Function Entry Point (Advanced JSON System)
// Main handler for the advanced JSON-based chat system

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import OpenAI from 'npm:openai@6.1.0';

// Import components
import { MessageProcessor } from './processor/index.ts';
import { MemoryManager } from './core/memory/memory_manager.ts';
import { ContextEngine } from './core/context/context_engine.ts';
import { StateManager } from './core/state/state_manager.ts';
// Removed: MonitoringSystem - feature archived (unused, empty tables)
import { MessageAdapter, getFeatureFlags, isFeatureEnabled, DualWriteService } from './adapters/index.ts';
import { FunctionCallingManager } from './function_calling/manager.ts';
import { SchemaValidator } from './validation/index.ts';

// Import API handlers
import { 
  handleError,
  withErrorHandling,
  CORS_HEADERS,
  handleCORS,
  createResponseHeaders,
  StreamResponse,
} from './api/v2/index.ts';
import { logger, createLogger, metrics } from './utils/index.ts';

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
// Pinecone keys are NEVER read from env. They are stored per-user in Vault via integrations

// Initialize services
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const pinecone = null; // Do not initialize a global Pinecone client

// Initialize core components
const memoryManager = new MemoryManager(supabase, pinecone, openai, {
  index_name: 'agentopia',
  namespace: 'memories',
  embedding_model: 'text-embedding-3-small',
  max_memories_per_agent: 1000,
});

const stateManager = new StateManager(supabase, {
  auto_checkpoint: true,
  checkpoint_interval: 3600000, // 1 hour
  max_checkpoints: 10,
  validation_enabled: true,
});

const contextEngine = new ContextEngine(supabase, {
  default_token_budget: 4096,
  max_candidates: 100,
  relevance_threshold: 0.3,
  compression_enabled: true,
  caching_enabled: true,
  monitoring_enabled: true,
});

// Removed: MonitoringSystem initialization - feature archived (unused, empty tables)

const messageProcessor = new MessageProcessor(
  memoryManager,
  contextEngine,
  openai,
  supabase
);

// Initialize API components
const validator = new SchemaValidator();

// Utility: Generate a short conversation title from initial user text
async function generateConversationTitleFromText(text: string, agentId?: string): Promise<string> {
  try {
    // Resolve model - use fast model for title generation
    let model = 'gpt-4o-mini'; // Default
    if (agentId) {
      try {
        const { ModelResolver } = await import('./processor/utils/model-resolver.ts');
        const resolver = new ModelResolver(supabase);
        const resolved = await resolver.getAgentModel(agentId, 'fast');
        model = resolved.model;
      } catch (_) {
        // Fallback to default if resolution fails
      }
    }
    
    const prompt = `Create a concise 3-6 word title for a chat based on the user's first message. 
Rules: Title Case, no quotes, no trailing punctuation.
User message: "${text.slice(0, 500)}"`;

    // Import model adapter for proper API formatting
    const { adaptLLMParams } = await import('./processor/utils/model-api-adapter.ts');
    
    const adaptedParams = adaptLLMParams({
      model,
      messages: [
        { role: 'system', content: 'You generate short, informative chat titles.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 24
    });

    const resp = await openai.chat.completions.create(adaptedParams);
    const out = (resp.choices?.[0]?.message?.content || '').trim();
    // Basic sanitation fallback
    return out.replace(/^"|"$/g, '').replace(/[.!?\s]+$/g, '').slice(0, 80) ||
      text.trim().split(/\s+/).slice(0, 6).join(' ').replace(/(^.|\s+.)/g, s => s.toUpperCase());
  } catch (_e) {
    // Fallback to truncated text if OpenAI fails
    const base = text.trim().split(/\s+/).slice(0, 6).join(' ');
    // Title Case simple fallback
    const titled = base.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    return titled || 'New Conversation';
  }
}

// Utility: Generate an improved conversation title from first 3 messages with better context
async function generateImprovedConversationTitle(messages: Array<{role: string, content: string}>, agentId?: string): Promise<string> {
  try {
    // Resolve model - use fast model for title generation
    let model = 'gpt-4o-mini'; // Default
    if (agentId) {
      try {
        const { ModelResolver } = await import('./processor/utils/model-resolver.ts');
        const resolver = new ModelResolver(supabase);
        const resolved = await resolver.getAgentModel(agentId, 'fast');
        model = resolved.model;
      } catch (_) {
        // Fallback to default if resolution fails
      }
    }
    
    // Build a concise summary of the conversation
    const conversationSummary = messages
      .map((msg, idx) => `${idx + 1}. ${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.slice(0, 200)}`)
      .join('\n');
    
    const prompt = `Based on this conversation, create a concise 3-7 word title that captures the main topic or purpose.
Rules: Title Case, no quotes, no trailing punctuation.

Conversation:
${conversationSummary}`;
    
    // Import model adapter for proper API formatting
    const { adaptLLMParams } = await import('./processor/utils/model-api-adapter.ts');
    
    const adaptedParams = adaptLLMParams({
      model,
      messages: [
        { role: 'system', content: 'You generate accurate, informative chat titles based on conversation context.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 30
    });

    const resp = await openai.chat.completions.create(adaptedParams);
    const out = (resp.choices?.[0]?.message?.content || '').trim();
    // Basic sanitation
    return out.replace(/^"|"$/g, '').replace(/[.!?\s]+$/g, '').slice(0, 80) || 'Conversation';
  } catch (_e) {
    // If LLM fails, keep the existing title
    return 'Conversation';
  }
}

// Ensure a conversation_sessions row exists and has a title
async function ensureConversationSession(convId: string, agentId: string, userId: string, firstUserText?: string) {
  try {
    const { data: existing } = await supabase
      .from('conversation_sessions')
      .select('conversation_id, title')
      .eq('conversation_id', convId)
      .maybeSingle();
    // Update rules:
    // - If no row: insert with AI title
    // - If title is empty or a generic placeholder ('New Conversation', 'Conversation', 'Untitled'): replace with AI title
    const isGeneric = (t?: string | null) => {
      if (!t) return true;
      const s = t.trim().toLowerCase();
      return s === 'new conversation' || s === 'conversation' || s === 'untitled' || s.length < 3;
    };

    if (!existing || isGeneric(existing.title)) {
      const title = firstUserText ? await generateConversationTitleFromText(firstUserText, agentId) : 'New Conversation';
      await supabase
        .from('conversation_sessions')
        .upsert({
          conversation_id: convId,
          agent_id: agentId,
          user_id: userId,
          title,
          status: 'active',
          last_active: new Date().toISOString(),
        }, { onConflict: 'conversation_id' });
    }
  } catch (err) {
    // Non-fatal; proceed without title
    logger.warn('ensureConversationSession failed', err as any);
  }
}

// Update conversation title after 3rd message for better context
async function updateConversationTitleAfterThirdMessage(convId: string, agentId?: string) {
  try {
    // Count total user messages in this conversation
    const { data: messages, error: countError } = await supabase
      .from('chat_messages_v2')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    
    if (countError || !messages) {
      logger.warn('Failed to count messages for title update', countError);
      return;
    }
    
    // Count only user messages (excluding system and assistant messages)
    const userMessages = messages.filter(m => m.role === 'user');
    
    // Update title after exactly 3 user messages
    if (userMessages.length === 3) {
      logger.info(`Updating conversation title after 3rd message for conversation: ${convId}`);
      
      // Get first 3 exchanges (up to 6 messages total - 3 user + 3 assistant responses)
      const firstExchanges = messages.slice(0, Math.min(6, messages.length)).map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : (m.content?.text ?? '')
      }));
      
      // Generate improved title with conversation context
      const improvedTitle = await generateImprovedConversationTitle(firstExchanges, agentId);
      
      // Update the conversation session with the new title
      const { error: updateError } = await supabase
        .from('conversation_sessions')
        .update({ 
          title: improvedTitle,
          last_active: new Date().toISOString()
        })
        .eq('conversation_id', convId);
      
      if (updateError) {
        logger.warn('Failed to update conversation title', updateError);
      } else {
        logger.info(`Successfully updated conversation title to: "${improvedTitle}"`);
      }
    }
  } catch (err) {
    // Non-fatal; just log and continue
    logger.warn('updateConversationTitleAfterThirdMessage failed', err as any);
  }
}

// Feature flags are configured via environment variables
// Advanced JSON chat system is controlled by getFeatureFlags()

// Main handler
async function handler(req: Request): Promise<Response> {
  const timer = metrics.startTimer('request_handling');
  const requestId = crypto.randomUUID();
  
  // Set up logging context
      const log = createLogger({ request_id: requestId });
  
  try {
    // Handle CORS
    const corsResponse = handleCORS(req);
    if (corsResponse) return corsResponse;
    
    // Validate Authorization for non-preflight requests
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    const serviceHeader = req.headers.get('X-Agentopia-Service') || req.headers.get('x-agentopia-service');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
    }
    
    // Verify the JWT token unless invoked by approved service
    let token: string | undefined;
    let authenticatedUserId: string | undefined;
    const isServiceCall = !!serviceHeader && serviceHeader === 'task-executor';
    if (!isServiceCall) {
      try {
        token = authHeader.split(' ')[1];
        const { data: { user }, error: userError } = await (supabase as any).auth.getUser(token);
        if (userError || !user) {
          return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...CORS_HEADERS,
            },
          });
        }
        authenticatedUserId = user.id;
      } catch (_authErr) {
        return new Response(JSON.stringify({ error: 'Authentication failed' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        });
      }
    }
    
    // Parse request body
    const body = await req.json();
    // Inject auth token for downstream tool execution (FunctionCallingManager)
    try {
      const opts = (body.options ||= {});
      const auth = (opts.auth ||= {});
      if (token) auth.token = token;
    } catch (_) { /* non-fatal */ }
    // Sanitize optional string fields that may arrive as null from legacy clients
    if (body?.context) {
      for (const key of ['channel_id','workspace_id','agent_id','user_id','conversation_id','session_id']) {
        if (body.context[key] === null) delete body.context[key];
      }
    }
    
    // V2 Chat System (V1 deprecated and removed)
    const acceptHeader = req.headers.get('Accept');
    const wantsStream = acceptHeader?.includes('text/event-stream');
    const requestType = wantsStream && body.options?.response?.stream ? 'streaming' : 'standard';
    
    // Request processing happens silently - context load will log
    
    // Validate chat request
    const validation = validator.validateChatRequest(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: validation.errors }),
        { status: 400, headers: createResponseHeaders() }
      );
    }
    
    if (wantsStream && body.options?.response?.stream) {
      return handleStreamingRequest(body, requestId);
    }
    
    // Ensure user_id is set from authenticated user
    if (!body.context) body.context = {};
    if (!body.context.user_id && authenticatedUserId) {
      body.context.user_id = authenticatedUserId;
    }
      
    // Ensure conversation record + AI title (only for first user message flows)
    let conversationId: string | null = null;
    try {
      const convId = body?.context?.conversation_id;
      const agentId = body?.context?.agent_id || body?.message?.context?.agent_id;
      const userId = body?.context?.user_id || authenticatedUserId;
      const userText = (body?.message?.content?.text ?? '') as string;
      if (convId && agentId && userId && userText) {
        conversationId = convId; // Store for later title update
        await ensureConversationSession(convId, agentId, userId, userText);
      }
    } catch (_e) {}
    
    // Robust overflow handling: retry up to 3 times trimming history via max_messages
    let response: any = null;
    const originalMax = Number((body?.options?.context?.max_messages ?? 0)) || undefined;
    let attempt = 0;
    let currentMax = originalMax;
    while (attempt < 3) {
      try {
        response = await messageProcessor.process(body, { validate: true, timeout: 30000 });
        break;
      } catch (err: any) {
        const msg = String(err?.message || '');
        const code = String((err as any)?.code || '');
        const looksLikeOverflow =
          code === 'context_length_exceeded' ||
          /context[_\s-]?length|maximum context|token limit|too many tokens/i.test(msg);
        if (!looksLikeOverflow) throw err;
        // Reduce max_messages aggressively but safely
        const prev = currentMax ?? 20;
        const next = Math.max(1, prev > 10 ? Math.floor(prev * 0.5) : prev - 1);
        currentMax = next;
        body.options = body.options || {};
        body.options.context = { ...(body.options.context || {}), max_messages: next };
        attempt += 1;
        if (attempt >= 3) {
          const headers = createResponseHeaders({ requestId });
          return new Response(
            JSON.stringify({
              success: false,
              error: 'context_window_exceeded',
              error_type: 'CONTEXT_WINDOW_EXCEEDED',
              title: 'Document Too Large for Context Window',
              message: 'I apologize, but the document you\'re asking about is too large to process in our current conversation context. The document contains a lot of content that would exceed my context window limits.',
              agent_instructions: 'Please inform the user that the document is too large for the current conversation context. Suggest they either: 1) Ask specific questions about particular topics in the document, 2) Request a search within the document using search_document_content tool, or 3) Start a new conversation to discuss the document.',
              technical_details: {
                reason: 'Request exceeds context window limits after multiple optimization attempts',
                attempts_made: 'Tried trimming conversation history three times',
                suggestion: 'Use targeted document search or start fresh conversation'
              },
              tips: [
                'Ask specific questions about the document content',
                'Use document search to find specific information',
                'Start a new conversation to discuss this document',
                'Break your question into smaller, more focused parts'
              ]
            }),
            { status: 413, headers: { ...headers, ...CORS_HEADERS } }
          );
        }
        // Continue loop with reduced history
        continue;
      }
    }
    
    // Persist assistant message so the UI can load it later
    try {
      const dual = new DualWriteService(supabase as any);
      await dual.saveMessage(response.data.message, {
        context: {
          channel_id: body?.context?.channel_id ?? null,
          sender_user_id: response.data.message?.context?.user_id,
          sender_agent_id: response.data.message?.context?.agent_id,
        },
      });
    } catch (persistErr) {
      log.warn('Assistant message persistence failed (non-fatal)', persistErr as Error);
    }
    
    // Update conversation title after 3rd message (non-blocking)
    if (conversationId) {
      // Extract agent_id for title generation
      const agentId = body?.context?.agent_id || body?.message?.context?.agent_id;
      // Run asynchronously without waiting
      updateConversationTitleAfterThirdMessage(conversationId, agentId).catch(err => {
        log.warn('Title update after 3rd message failed (non-fatal)', err as Error);
      });
    }
    
    // Create response headers
    const headers = createResponseHeaders({
      requestId,
      processingTime: response.metrics?.processing_time_ms,
    });
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...headers,
        ...CORS_HEADERS,
      },
    });
    
  } catch (error) {
    log.error('Request handling failed', error as Error);
    const errResp = await handleError(error, requestId);
    const hdrs = new Headers(errResp.headers);
    Object.entries(CORS_HEADERS).forEach(([k,v])=>hdrs.set(k as string, v as string));
    return new Response(errResp.body, { status: errResp.status, headers: hdrs });
  } finally {
    timer.stop();
  }
}

// Streaming request handler
async function handleStreamingRequest(body: any, requestId: string): Promise<Response> {
        const log = createLogger({ request_id: requestId, streaming: true });
  const stream = new StreamResponse();
  
  // Process in background
  (async () => {
    try {
      log.info('Starting stream');
      
      for await (const event of messageProcessor.processStream(body)) {
        stream.send(event);
      }
      
      log.info('Stream completed');
      stream.close();
      
    } catch (error) {
      log.error('Stream error', error as Error);
      
      stream.send({
        event: 'error',
        error: {
          message: error instanceof Error ? error.message : 'Stream error',
          code: 'stream_error',
        },
        recoverable: false,
      });
      
      stream.close();
    }
  })();
  
  const resp = stream.getResponse();
  const hdrs = new Headers(resp.headers);
  Object.entries(CORS_HEADERS).forEach(([k,v])=>hdrs.set(k as string, v as string));
  return new Response(resp.body, { status: resp.status, headers: hdrs });
}

// Health check endpoint
async function handleHealthCheck(): Promise<Response> {
  // Removed: monitoringSystem.checkHealth() - feature archived
  const health = { status: 'healthy', timestamp: new Date().toISOString() };
  
  return new Response(JSON.stringify(health), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...CORS_HEADERS,
    },
  });
}

// Metrics endpoint
async function handleMetrics(): Promise<Response> {
  // Removed: monitoringSystem.exportMetrics() - feature archived
  const allMetrics = { message: 'Monitoring system disabled' };
  
  return new Response(JSON.stringify(allMetrics), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...CORS_HEADERS,
    },
  });
}

// Route handler
async function routeHandler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
  // Handle CORS preflight at top-level as well
  const preflight = handleCORS(req);
  if (preflight) return preflight;
  
  // Special endpoints
  if (url.pathname === '/health') {
    return handleHealthCheck();
  }
  
  if (url.pathname === '/metrics') {
    return handleMetrics();
  }

  // Diagnostics: list discovered tools for an agent+user
  if (url.pathname === '/tools/diagnostics') {
    try {
      const agentId = url.searchParams.get('agent_id') || '';
      const userId = url.searchParams.get('user_id') || '';
      const fcm = new FunctionCallingManager(supabase as any);
      const tools = await fcm.getAvailableTools(agentId, userId);
      return new Response(JSON.stringify({ agent_id: agentId, user_id: userId, tools }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err?.message || 'diagnostics_error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  }
  
  // API routes (treat root path as chat entrypoint)
  if (url.pathname === '/' || url.pathname === '' || url.pathname.startsWith('/v2/') || url.pathname === '/chat') {
    return handler(req);
  }
  
  // 404 for unknown routes
  return new Response(JSON.stringify({
    error: 'Not found',
    path: url.pathname,
  }), {
    status: 404,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

// Start server (suppress default logging)
serve(withErrorHandling(routeHandler), { 
  onListen: () => console.log('[Chat] Ready') 
});