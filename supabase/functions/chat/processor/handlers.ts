/**
 * REFACTORED Message Handlers - Clean, modular architecture
 */

import type { AdvancedChatMessage } from '../types/message.types.ts';
import type { ProcessingContext, ProcessingMetrics } from './types.ts';
import { FunctionCallingManager } from '../function_calling/manager.ts';
import { MemoryManager } from '../core/memory/memory_manager.ts';
import { PromptBuilder } from './utils/prompt-builder.ts';
import { MarkdownFormatter } from './utils/markdown-formatter.ts';
import { ToolExecutor } from './utils/tool-executor.ts';
import { IntentClassifier } from './utils/intent-classifier.ts';
import { MessagePreparation } from './handlers/message-preparation.ts';
import { LLMCaller } from './handlers/llm-caller.ts';
import { MCPRetryLoop } from './handlers/mcp-retry-loop.ts';
import { generateMessageId, generateTimestamp } from '../types/utils.ts';

export interface MessageHandler {
  canHandle(message: AdvancedChatMessage): boolean;
  handle(message: AdvancedChatMessage, context: ProcessingContext): Promise<{
    message: AdvancedChatMessage;
    context: ProcessingContext;
    metrics: ProcessingMetrics;
  }>;
}

export class TextMessageHandler implements MessageHandler {
  private promptBuilder: PromptBuilder;
  private messagePrep: MessagePreparation;

  constructor(private openai: any, private supabase: any, private memoryManager?: MemoryManager | null) {
    this.promptBuilder = new PromptBuilder(supabase);
    this.messagePrep = new MessagePreparation(supabase);
  }

  canHandle(message: AdvancedChatMessage): boolean {
    return (message as any).content?.type === 'text';
  }

  /** Normalize tool definitions and drop malformed ones */
  private normalizeTools(tools: any[]): Array<{ name: string; description?: string; parameters: any }> {
    return MarkdownFormatter.normalizeTools(tools);
  }
  
  private ensureProperMarkdownFormatting(text: string): string {
    return MarkdownFormatter.ensureProperFormatting(text);
  }

  async handle(message: AdvancedChatMessage, context: ProcessingContext) {
    const startTime = Date.now();

    // CRITICAL FIX: Ensure context.agent_id is never an empty string
    if (context.agent_id === '') {
      console.error('[TextMessageHandler] CRITICAL: context.agent_id is empty string, setting to undefined');
      context.agent_id = undefined as any;
    }

    // LLM Call Tracker - stores all LLM requests/responses for debug modal
    const llmCalls: Array<{
      stage: string;
      description: string;
      request: any;
      response: any;
      timestamp: string;
      duration_ms: number;
    }> = [];

    // STEP 1: Prepare messages (system prompt, context, working memory, history)
    const { messages: msgs, recentMessages, summaryInfo } = await this.messagePrep.prepare(message, context);

    // STEP 1.5: CONTEXTUAL AWARENESS - Understand what the user is ACTUALLY asking for
    const userText = (message as any).content?.text || (message as any).content || '';
    const conversationId = context.conversation_id || (message as any).conversation_id;
    
    console.log('[TextMessageHandler] 🧠 Running Contextual Awareness Analysis...');
    const { ContextualAwarenessAnalyzer } = await import('./utils/contextual-awareness.ts');
    const contextAnalyzer = new ContextualAwarenessAnalyzer(this.openai, this.supabase);
    
    const contextStartTime = Date.now();
    const contextualInterpretation = await contextAnalyzer.analyzeContext(
      userText,
      conversationId,
      context.agent_id,
      recentMessages
    );
    const contextDuration = Date.now() - contextStartTime;
    
    // Capture contextual awareness LLM call for debug modal
    console.log('[TextMessageHandler] 📊 Capturing contextual awareness LLM call');
    llmCalls.push({
      stage: 'contextual_awareness',
      description: '🧠 Contextual Awareness Analysis',
      request: {
        model: 'gpt-4o-mini',
        user_message: userText,
        conversation_id: conversationId,
        recent_messages: recentMessages?.length || 0,
        temperature: 0.3,
        max_tokens: 500,
      },
      response: {
        interpreted_meaning: contextualInterpretation.interpretedMeaning,
        user_intent: contextualInterpretation.userIntent,
        confidence: contextualInterpretation.confidence,
        resolved_references: contextualInterpretation.resolvedReferences,
        contextual_factors: contextualInterpretation.contextualFactors,
        usage: contextualInterpretation.usage, // ✨ Add token usage
      },
      timestamp: new Date().toISOString(),
      duration_ms: contextDuration,
    });
    
    console.log('[TextMessageHandler] ✅ Contextual Awareness:', {
      originalMessage: userText.substring(0, 50) + '...',
      interpretedMeaning: contextualInterpretation.interpretedMeaning.substring(0, 80) + '...',
      userIntent: contextualInterpretation.userIntent,
      confidence: contextualInterpretation.confidence,
      resolvedReferences: Object.keys(contextualInterpretation.resolvedReferences || {}).length,
      analysisTimeMs: contextualInterpretation.analysisTimeMs
    });

    // STEP 2: Intent classification (determine if tools are needed) - NOW WITH CONTEXTUAL AWARENESS
    const classifier = new IntentClassifier(this.openai, this.supabase);
    const classificationStartTime = Date.now();
    const classification = await classifier.classifyIntent(
      userText, 
      context.agent_id || 'default', 
      recentMessages,
      contextualInterpretation // ✨ Pass contextual understanding to classifier!
    );
    const classificationDuration = Date.now() - classificationStartTime;
    
    // Capture intent classification LLM call for debug modal
    llmCalls.push({
      stage: 'intent_classification',
      description: '🎯 Intent Classification',
      request: {
        model: 'gpt-4o-mini',
        user_message: userText,
        contextual_interpretation: contextualInterpretation,
        recent_messages: recentMessages?.length || 0,
        temperature: 0.3,
        max_tokens: 150,
      },
      response: {
        requires_tools: classification.requiresTools,
        confidence: classification.confidence,
        detected_intent: classification.detectedIntent,
        reasoning: classification.reasoning,
        usage: classification.usage, // ✨ Add token usage
      },
      timestamp: new Date().toISOString(),
      duration_ms: classificationDuration,
    });
    
    console.log(`[IntentClassifier] Classification result:`, classification);

    // STEP 3: Conditionally load tools only if needed (OPTIMIZATION)
    const authToken = (context as any)?.request_options?.auth?.token || '';
    let availableTools: any[] = [];
    let fcm: FunctionCallingManager | null = null;

    if (classification.requiresTools) {
      console.log(`[IntentClassifier] Loading tools...`);
      fcm = new FunctionCallingManager(this.supabase as any, authToken);
      availableTools = (context.agent_id && context.user_id)
        ? await fcm.getAvailableTools(context.agent_id, context.user_id)
        : [];
      console.log(`[IntentClassifier] ✅ Loaded ${availableTools.length} tools`);
    } else {
      console.log(`[IntentClassifier] ⚡ Skipped tool loading (~750ms saved)`);
    }

    // STEP 3.5: ALWAYS Inject contextual awareness into conversation
    // Build contextual guidance message
    let guidanceParts: string[] = [];
    
    // Always include the user's message and interpreted meaning
    guidanceParts.push(`🧠 CONTEXTUAL UNDERSTANDING:`);
    guidanceParts.push(`User said: "${userText}"`);
    
    if (contextualInterpretation.interpretedMeaning !== userText) {
      guidanceParts.push(`Interpreted meaning: "${contextualInterpretation.interpretedMeaning}"`);
    }
    
    // Add resolved references if any
    if (Object.keys(contextualInterpretation.resolvedReferences || {}).length > 0) {
      guidanceParts.push(`\nResolved references:`);
      Object.entries(contextualInterpretation.resolvedReferences || {}).forEach(([ref, meaning]) => {
        guidanceParts.push(`  - "${ref}" refers to: ${meaning}`);
      });
    }
    
    // Always include user intent
    guidanceParts.push(`\nUser's actual intent: ${contextualInterpretation.userIntent}`);
    guidanceParts.push(`Confidence: ${contextualInterpretation.confidence}`);
    
    // Add contextual factors
    if (contextualInterpretation.contextualFactors && contextualInterpretation.contextualFactors.length > 0) {
      guidanceParts.push(`\nContextual factors:`);
      contextualInterpretation.contextualFactors.forEach(factor => {
        guidanceParts.push(`  - ${factor}`);
      });
    }
    
    // Add clarifications if any
    if (contextualInterpretation.suggestedClarifications && contextualInterpretation.suggestedClarifications.length > 0) {
      guidanceParts.push(`\n⚠️ Ambiguous request - consider asking:`);
      contextualInterpretation.suggestedClarifications.forEach(clarification => {
        guidanceParts.push(`  - ${clarification}`);
      });
    }
    
    guidanceParts.push(`\nRespond to their ACTUAL INTENT (${contextualInterpretation.userIntent}), not just the literal message text.`);
    
    const contextualGuidance = guidanceParts.join('\n');
    msgs.push({ role: 'system', content: contextualGuidance });
    
    console.log('[TextMessageHandler] 💡 Injected contextual guidance:', {
      userIntent: contextualInterpretation.userIntent,
      confidence: contextualInterpretation.confidence,
      resolvedRefsCount: Object.keys(contextualInterpretation.resolvedReferences || {}).length,
      contextualFactorsCount: contextualInterpretation.contextualFactors?.length || 0
    });

    // STEP 4: Add tool guidance if tools are available
    if (availableTools.length > 0) {
      const toolNames = availableTools.map((t) => t.name).join(', ');
      const guidance = this.promptBuilder.buildToolGuidance(toolNames);
      msgs.push({ role: 'system', content: guidance });

      // Add explicit instruction for action requests
      msgs.push({
        role: 'system',
        content: `CRITICAL: If the user's message is a REQUEST or COMMAND (send, create, search, get, find, etc.), you MUST call the appropriate tool function. DO NOT just respond with text saying you will do it - actually call the function. This is MANDATORY for all action requests.`,
      });
    }

    // STEP 5: Setup LLM router/caller
    const useRouter =
      typeof (globalThis as any).Deno !== 'undefined'
        ? (globalThis as any).Deno.env.get('USE_LLM_ROUTER')?.toLowerCase() === 'true'
      : false;

    let router: any = null;
    let effectiveModel = 'gpt-4';

    if (useRouter && context.agent_id) {
      try {
        const mod = await import('../../shared/llm/router.ts');
        const LLMRouter = (mod as any).LLMRouter;
        router = LLMRouter ? new LLMRouter() : null;
        if (router) {
          const resolved = await router.resolveAgent(context.agent_id).catch(() => null);
          effectiveModel = resolved?.prefs?.model || effectiveModel;
          console.log('[TextMessageHandler] Resolved model:', effectiveModel);
        }
      } catch (_) {
        router = null;
      }
    }

    // Create LLM caller
    const llmCaller = new LLMCaller(this.openai, router, context.agent_id, this.supabase);

    // STEP 6: Initial LLM call
    const normalizedTools = this.normalizeTools(availableTools).map(t => ({
      name: t.name,
      description: t.description || '',
      parameters: t.parameters
    }));
    
    const mainLLMStartTime = Date.now();
    const llmResult = await llmCaller.call({
      messages: msgs,
      tools: normalizedTools,
      temperature: 0.7,
      maxTokens: 1200,
      userMessage: userText,
    });
    const mainLLMDuration = Date.now() - mainLLMStartTime;

    let promptTokens = llmResult.usage?.prompt || 0;
    let completionTokens = llmResult.usage?.completion || 0;
    
    // Capture main LLM call for debug modal
    llmCalls.push({
      stage: 'main_llm_call',
      description: '💬 Main LLM Call',
      request: {
        model: effectiveModel,
        messages: msgs,
        tools: normalizedTools.map(t => ({ name: t.name, description: t.description })),
        temperature: 0.7,
        max_tokens: 1200,
      },
      response: {
        text: llmResult.text,
        tool_calls: llmResult.toolCalls?.map(tc => ({
          id: tc.id,
          name: tc.function?.name,
          arguments: tc.function?.arguments,
        })) || [],
        usage: llmResult.usage,
      },
      timestamp: new Date().toISOString(),
      duration_ms: mainLLMDuration,
    });

    // STEP 7: Handle tool calls + MCP retry loop
    let toolCalls = llmResult.toolCalls || [];
    let toolDetails: any[] = [];

    if (toolCalls.length > 0 && fcm) {
      console.log(`[TextMessageHandler] Executing ${toolCalls.length} tool calls`);

      // Add assistant message with tool calls
      msgs.push({
        role: 'assistant',
        content: llmResult.text || '',
        tool_calls: toolCalls,
      });

      // Execute tools with intelligent retry
      const toolExecResult = await ToolExecutor.executeToolCalls(
        toolCalls,
        msgs,
        fcm,
        {
          agent_id: context.agent_id,
          user_id: context.user_id,
          originalUserMessage: userText,
          availableTools: normalizedTools,
        },
        normalizedTools,
        this.openai,
        router,
        useRouter,
        this.normalizeTools.bind(this)
      );

      toolDetails = toolExecResult.toolDetails;
      promptTokens += toolExecResult.tokensUsed.prompt;
      completionTokens += toolExecResult.tokensUsed.completion;

      // MCP Retry Loop if needed
      if (toolExecResult.requiresLLMRetry) {
        console.log(`[TextMessageHandler] 🔄 Entering MCP retry loop`);

        const mcpResult = await MCPRetryLoop.execute({
          initialToolCalls: toolCalls,
          initialToolExecResult: toolExecResult,
          messages: msgs,
          context,
          availableTools: normalizedTools,
          fcm,
          llmCaller,
          openai: this.openai,
          router,
          useRouter,
          normalizeTools: this.normalizeTools.bind(this),
          userMessage: userText,
        });

        toolDetails = mcpResult.toolDetails;
        promptTokens += mcpResult.promptTokens;
        completionTokens += mcpResult.completionTokens;

        console.log(`[TextMessageHandler] ✅ MCP retry completed after ${mcpResult.retryAttempts} attempts`);
      }

      // Get final LLM response after tool execution
      console.log(`[TextMessageHandler] Preparing messages for final synthesis (original: ${msgs.length} messages)`);
      
      // Add reflection guidance to ensure clean, results-focused response
        msgs.push({
          role: 'system',
        content: this.promptBuilder.buildReflectionGuidance()
        } as any);
        
      // CRITICAL: Clean messages for synthesis
      // OpenAI requirement: tool messages MUST follow assistant messages with tool_calls
      // Since we're passing tools: [] (no more tool calls allowed), we must convert tool messages to user messages
      // This way the LLM can still see the results but we don't violate OpenAI's API constraints
      const synthesisMessages = msgs.map((msg: any, index: number) => {
        // Keep system and user messages as-is
        if (msg.role === 'system' || msg.role === 'user') {
          return msg;
        }
        
        // Convert tool messages to user messages with clear labeling
        // This preserves the tool results for LLM synthesis while avoiding API errors
        if (msg.role === 'tool') {
          return {
            role: 'user',
            content: `[Tool Result]\n${msg.content}`
          };
        }
        
        // For assistant messages, remove tool_calls property to avoid orphaned tool_calls error
        if (msg.role === 'assistant') {
          const { tool_calls, ...rest } = msg;
          return {
            ...rest,
            content: rest.content || '' // Ensure content is not undefined
          };
        }
        
        return msg;
      });
      
      console.log(`[TextMessageHandler] Prepared ${synthesisMessages.length} messages for synthesis (converted ${msgs.filter((m: any) => m.role === 'tool').length} tool messages to user messages)`);
      
      // CRITICAL: Use empty tools array to force text synthesis (no more tool calls)
      const finalLLMResult = await llmCaller.call({
        messages: synthesisMessages, // Include tool results as user messages for proper synthesis
        tools: [], // Empty tools = model MUST synthesize with text
        temperature: 0.5,
        maxTokens: 1200,
        toolChoice: undefined, // Explicitly undefined
        userMessage: undefined, // Don't detect tool intent for synthesis
      });

      promptTokens += finalLLMResult.usage?.prompt || 0;
      completionTokens += finalLLMResult.usage?.completion || 0;

      llmResult.text = finalLLMResult.text || llmResult.text;
    }

    // STEP 8: Finalize response
    if (!llmResult.text) {
      console.error('[TextMessageHandler] ❌ EMPTY RESPONSE from LLM!');
      llmResult.text = 'Sorry, I could not generate a response.';
    }

    let text = this.ensureProperMarkdownFormatting(llmResult.text);

    // Extract artifacts from tool execution results
    const artifacts = toolDetails
      .filter((td: any) => td.artifact)
      .map((td: any) => ({
        name: td.name,
        artifact: td.artifact,
        execution_time_ms: td.execution_time_ms,
      }));

    // Check if any tool requires user input
    const toolRequiringInput = toolDetails.find((td: any) => td.requires_user_input);
    const requiresUserInput = !!toolRequiringInput;
    const userInputRequest = toolRequiringInput?.user_input_request;

    // Build metrics
    const endTime = Date.now();
    console.log('[TextMessageHandler] 📊 Building metrics with llmCalls:', {
      llmCallsCount: llmCalls.length,
      stages: llmCalls.map(c => c.stage),
    });
    const metrics: ProcessingMetrics = {
      start_time: startTime,
      end_time: endTime,
      tokens_used: promptTokens + completionTokens,
      memory_searches: summaryInfo ? 1 : 0,
      tool_executions: toolDetails.length,
      stages: {
        message_prep: 100, // Estimate
        contextual_awareness: contextualInterpretation.analysisTimeMs || 0,
        intent_classification: classification.classificationTimeMs || 0,
        tool_loading: availableTools.length > 0 ? 750 : 0,
        llm_calls: endTime - startTime,
      },
      discovered_tools: availableTools.map((t) => ({ name: t.name, description: t.description })), // Tools that were available
      tool_details: toolDetails, // Tools that were actually executed
      // Contextual awareness results for debugging
      contextual_awareness: {
        original_message: userText,
        interpreted_meaning: contextualInterpretation.interpretedMeaning,
        user_intent: contextualInterpretation.userIntent,
        confidence: contextualInterpretation.confidence,
        resolved_references: contextualInterpretation.resolvedReferences || {},
        contextual_factors: contextualInterpretation.contextualFactors || [],
        suggested_clarifications: contextualInterpretation.suggestedClarifications || [],
        analysis_time_ms: contextualInterpretation.analysisTimeMs,
        from_cache: contextualInterpretation.fromCache || false,
      } as any,
      // Intent classification results for debugging
      intent_classification: {
        requires_tools: classification.requiresTools,
        confidence: classification.confidence,
        detected_intent: classification.detectedIntent || 'unknown',
        reasoning: classification.reasoning || '',
        classification_time_ms: classification.classificationTimeMs || 0,
        from_cache: classification.fromCache || false,
      } as any,
      // LLM call tracking for debug modal (temporary, in-memory only)
      llm_calls: llmCalls,
    };

    // Return final response - CRITICAL: Create proper V2 message with all required fields
    const timestamp = generateTimestamp();
    console.log('[TextMessageHandler] 📊 Final metrics object:', {
      hasLlmCalls: !!metrics.llm_calls,
      llmCallsCount: metrics.llm_calls?.length || 0,
      metricsKeys: Object.keys(metrics),
    });
    const responseMessage: AdvancedChatMessage = {
      id: generateMessageId(),
      version: '2.0.0',
      role: 'assistant',
      content: { type: 'text', text },
      timestamp: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
      metadata: { 
        tokens: promptTokens + completionTokens,
        processing_time_ms: endTime - startTime,
        tool_execution_count: toolDetails.length,
        memory_searches: summaryInfo ? 1 : 0,
        requires_user_input: requiresUserInput,
        user_input_request: userInputRequest,
        tool_call_id: toolRequiringInput?.id,
        processingDetails: metrics, // ✨ Add full metrics including llm_calls for Debug Modal
      },
      context: {
        conversation_id: context.conversation_id!,
        session_id: context.session_id!,
        agent_id: context.agent_id,
        user_id: context.user_id,
        channel_id: context.channel_id,
      },
      artifacts: artifacts.length > 0 ? artifacts : undefined,
      tool_details: toolDetails.length > 0 ? toolDetails : undefined,
    } as any;

          return {
      message: responseMessage,
            context,
      metrics,
    };
  }
}

export class StructuredMessageHandler implements MessageHandler {
  canHandle(message: AdvancedChatMessage): boolean {
    return (message as any).content?.type === 'structured';
  }
  async handle(message: AdvancedChatMessage, context: ProcessingContext) {
    return {
      message: { ...message, role: 'assistant' } as any,
      context,
      metrics: { start_time: Date.now(), end_time: Date.now(), stages: {}, tokens_used: 0, memory_searches: 0, tool_executions: 0 },
    } as any;
  }
}

export class ToolCallHandler implements MessageHandler {
  canHandle(message: AdvancedChatMessage): boolean {
    return (message as any).tools?.length > 0;
  }
  async handle(message: AdvancedChatMessage, context: ProcessingContext) {
    const start = Date.now();
    const toolCalls = ((message as any).tools || []) as any[];
    const details: any[] = [];
    for (const t of toolCalls) {
      const execStart = Date.now();
      try {
        details.push({
          name: t.function?.name || t.id || 'tool',
          execution_time_ms: 1 + (Date.now() - execStart),
          success: true,
          input_params: t.function?.arguments || {},
          output_result: { executed: true },
        });
      } catch (err: any) {
        details.push({
          name: t.function?.name || t.id || 'tool',
          execution_time_ms: Date.now() - execStart,
          success: false,
          input_params: t.function?.arguments || {},
          output_result: null,
          error: err?.message || 'Unknown error',
        });
      }
    }
    return {
      message: { ...message, role: 'assistant', tool_details: details } as any,
      context,
      metrics: {
        start_time: start,
        end_time: Date.now(),
        tokens_used: 0,
        memory_searches: 0,
        tool_executions: details.length,
        stages: {},
      },
    } as any;
  }
}

