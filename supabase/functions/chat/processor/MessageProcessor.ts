// Message Processor
// Core component for processing advanced JSON chat messages

// Avoid importing Supabase types here to prevent Deno/IDE resolution issues
type SupabaseClient = any;
import type { ChatRequestV2 } from '../types/message.types.ts';
import type { MessageResponse } from '../api/v2/schemas/responses.ts';
import { ValidationError } from '../api/v2/errors.ts';
import { MemoryManager } from '../core/memory/memory_manager.ts';
import { ContextEngine } from '../core/context/context_engine.ts';
// Removed: StateManager, MonitoringSystem - features archived (unused)
import { 
  ProcessingStage, 
  ParsingStage, 
  ValidationStage, 
  EnrichmentStage, 
  MainProcessingStage, 
  ResponseStage 
} from './stages.ts';
// Removed: Advanced Reasoning imports - archived 2025-10-17
import { 
  TextMessageHandler, 
  StructuredMessageHandler, 
  ToolCallHandler, 
  MessageHandler 
} from './handlers.ts';
import { getRelevantChatHistory } from '../chat_history.ts';
import { SchemaValidator } from '../validation/SchemaValidator.ts';
import { 
  createMessage, 
  buildSuccessResponse, 
  errorToDetails, 
  chunkText 
} from './builder.ts';
import type { 
  ProcessingContext, 
  ProcessingMetrics, 
  ProcessingOptions, 
  StreamEvent 
} from './types.ts';

// ============================
// Message Processor Implementation
// ============================

export class MessageProcessor {
  private pipeline: ProcessingStage[];
  private handlers: Map<string, MessageHandler>;
  private validator: SchemaValidator;
  
  constructor(
    private _memoryManager: MemoryManager,
    private contextEngine: ContextEngine,
    private openai: any,
    private supabase: SupabaseClient
  ) {
    // Initialize validator
    this.validator = new SchemaValidator();
    
    // Initialize handlers first (needed by pipeline)
    this.handlers = new Map([
      ['text', new TextMessageHandler(this.openai, this.supabase, this._memoryManager)],
      ['structured', new StructuredMessageHandler()],
      ['tool_call', new ToolCallHandler()],
    ]);
    
    // Initialize pipeline with enrichment before reasoning
    this.pipeline = [
      new ParsingStage(),
      new ValidationStage(this.validator),
      new EnrichmentStage(this.contextEngine, this._memoryManager),
      // Removed: Advanced Reasoning Stage - archived 2025-10-17
      
      new MainProcessingStage(this.getProcessingHandlers()),
      new ResponseStage(),
    ];
  }
  
  /**
   * Process a chat request
   */
  async process(
    request: ChatRequestV2,
    options: ProcessingOptions = {}
  ): Promise<MessageResponse> {
    const requestId = request.request_id ?? crypto.randomUUID();
    
    try {
      // Validate request if needed
      if (options.validate ?? true) {
        const validation = this.validator.validateChatRequest(request);
        if (!validation.valid) {
          throw new ValidationError(validation.errors);
        }
      }
      
      // Create processing context
      const context: ProcessingContext = {
        request_id: requestId,
        agent_id: request.context?.agent_id || request.message?.context?.agent_id || (request as any).agent_id || undefined,
        user_id: request.context?.user_id || request.message?.context?.user_id || (request as any).user_id || undefined,
        conversation_id: request.context?.conversation_id || request.message?.context?.conversation_id || (request as any).conversation_id || undefined,
        session_id: request.context?.session_id || request.message?.context?.session_id || (request as any).session_id || undefined,
        workspace_id: request.context?.workspace_id || request.message?.context?.workspace_id || undefined,
        channel_id: request.context?.channel_id || request.message?.context?.channel_id || undefined,
        request_options: request.options,
      };
      
      // Initialize metrics
      const metrics: ProcessingMetrics = {
        start_time: Date.now(),
        stages: {},
        tokens_used: 0,
        memory_searches: 0,
        tool_executions: 0,
      };
      
      // Create initial message
      let message = createMessage(request, context);
      
      // Context loading is now handled by MessagePreparation stage
      // All history, working memory, and context is loaded there in a single pass
      
      // Run through pipeline
      for (const stage of this.pipeline) {
        const stageStart = Date.now();
        
        try {
          message = await stage.process(message, context, metrics);
          metrics.stages[stage.name] = Date.now() - stageStart;
        } catch (error) {
          // Log error but don't use monitoring system
          console.error(`[MessageProcessor] Error in stage ${stage.name}:`, error);
          throw error;
        }
      }
      
      // Complete metrics
      metrics.end_time = Date.now();
      
      // Build response
      return buildSuccessResponse(message, context, metrics);
      
    } catch (error) {
      // Log error but don't use monitoring system
      console.error('[MessageProcessor] Error processing message:', error);
      throw error;
    }
  }
  
  /**
   * Process with streaming response
   */
  async *processStream(
    request: ChatRequestV2,
    options: ProcessingOptions = {}
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const requestId = request.request_id ?? crypto.randomUUID();
    
    try {
      // Start event
      yield {
        event: 'message_start',
        message_id: requestId,
        role: 'assistant',
        timestamp: new Date().toISOString(),
      };
      
      // Process message
      const response = await this.process(request, { ...options, stream: true });
      
      // Stream content
      const content = response.data.message.content;
      if (content.type === 'text') {
        // Simulate streaming by chunking text
        const chunks = chunkText(content.text ?? '', 50);
        
        for (let i = 0; i < chunks.length; i++) {
          yield {
            event: 'content_delta',
            delta: chunks[i],
            index: i,
          finish_reason: (i === chunks.length - 1 ? 'stop' : undefined) as 'stop' | 'length' | 'tool_calls' | undefined,
          };
          
          // Simulate network delay
          await new Promise<void>(resolve => setTimeout(resolve, 50));
        }
      }
      
      // Complete event
      yield {
        event: 'message_complete',
        message: response.data.message,
        metrics: response.metrics as any,
      };
      
    } catch (error) {
      yield {
        event: 'error',
        error: errorToDetails(error as Error),
        recoverable: false,
      };
    }
  }
  
  /**
   * Validate a message without processing
   */
  async validate(request: ChatRequestV2): Promise<{ valid: boolean; errors?: any[] }> {
    const validation = this.validator.validateChatRequest(request);
    return validation;
  }
  
  // ============================
  // Private Methods
  // ============================
  
  private getProcessingHandlers(): MessageHandler[] {
    return Array.from(this.handlers.values());
  }
}