// Schema Validator
// Handles JSON schema validation for the advanced chat system

import { z } from 'npm:zod@3.22.4';
import {
  AdvancedChatMessage,
  ChatRequestV2,
  MessageRole,
  MessageContent,
  ToolCall,
  MemoryReference,
  StateSnapshot,
} from '../types/message.types.ts';
import {
  CreateMessageRequest,
  CreateConversationRequest,
  SearchMemoriesRequest,
} from '../api/v2/schemas/requests.ts';
import { ValidationError } from '../api/v2/errors.ts';

// ============================
// Interfaces
// ============================

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
    value?: any;
  }>;
  warnings?: Array<{
    field: string;
    message: string;
  }>;
}

export interface SchemaDefinition {
  name: string;
  version: string;
  schema: z.ZodSchema<any>;
}

// ============================
// Schema Definitions
// ============================

// Base schemas
const MessageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);

const TextContentSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1).max(100000),
});

const StructuredContentSchema = z.object({
  type: z.literal('structured'),
  data: z.any(),
  schema: z.string().optional(),
});

const MultimodalPartSchema = z.object({
  type: z.enum(['text', 'image', 'file']),
  content: z.string(),
  metadata: z.any().optional(),
});

const MultimodalContentSchema = z.object({
  type: z.literal('multimodal'),
  parts: z.array(MultimodalPartSchema).min(1),
});

const MessageContentSchema = z.discriminatedUnion('type', [
  TextContentSchema,
  StructuredContentSchema,
  MultimodalContentSchema,
]);

// Tool schemas
const ToolCallSchema = z.object({
  tool_id: z.string(),
  tool_name: z.string(),
  arguments: z.any(),
  execution_id: z.string().optional(),
  status: z.enum(['pending', 'executing', 'completed', 'failed']).optional(),
  result: z.any().optional(),
  error: z.string().optional(),
});

// Memory schemas
const MemoryReferenceSchema = z.object({
  memory_id: z.string(),
  relevance_score: z.number().min(0).max(1).optional(),
});

// State schemas
const StateSnapshotSchema = z.object({
  local_state: z.any().optional(),
  shared_state: z.any().optional(),
  session_state: z.any().optional(),
});

// Metadata schemas
const MessageMetadataSchema = z.object({
  source: z.string().optional(),
  tokens: z.number().optional(),
  model: z.string().optional(),
  temperature: z.number().optional(),
  confidence_score: z.number().optional(),
  processing_time_ms: z.number().optional(),
  custom: z.any().optional(),
}).passthrough();

// Context schemas
const MessageContextSchema = z.object({
  conversation_id: z.string().optional(),
  session_id: z.string().optional(),
  thread_id: z.string().optional(),
  parent_message_id: z.string().optional(),
  agent_id: z.string().optional(),
  channel_id: z.string().optional(),
  workspace_id: z.string().optional(),
  relevant_memories: z.array(z.string()).optional(),
  memory_score: z.number().optional(),
}).passthrough();

// Complete message schema
const AdvancedChatMessageSchema = z.object({
  id: z.string().uuid(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  role: MessageRoleSchema,
  content: MessageContentSchema,
  timestamp: z.string().datetime(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional(),
  metadata: MessageMetadataSchema.optional(),
  context: MessageContextSchema.optional(),
  tools: z.array(ToolCallSchema).optional(),
  memory: z.array(MemoryReferenceSchema).optional(),
  state: StateSnapshotSchema.optional(),
  audit: z.object({
    created_by: z.string().optional(),
    created_at: z.string().datetime(),
    modified_by: z.string().optional(),
    modified_at: z.string().datetime().optional(),
    ip_address: z.string().optional(),
    user_agent: z.string().optional(),
  }).optional(),
});

// Request schemas
const ChatRequestV2Schema = z.object({
  version: z.literal('2.0.0'),
  message: z.object({
    role: MessageRoleSchema.optional(),
    content: MessageContentSchema.optional(),
    metadata: MessageMetadataSchema.optional(),
    tools: z.array(ToolCallSchema).optional(),
    memory_refs: z.array(z.string()).optional(),
  }),
  context: z.object({
    conversation_id: z.string().optional(),
    session_id: z.string().optional(),
    agent_id: z.string().optional(),
    channel_id: z.string().optional(),
    workspace_id: z.string().optional(),
    user_id: z.string().optional(),
  }).optional(),
  options: z.object({
    memory: z.object({
      enabled: z.boolean(),
      types: z.array(z.enum(['episodic', 'semantic', 'procedural', 'working'])),
      max_results: z.number().min(1).max(100),
      min_relevance: z.number().min(0).max(1),
      include_expired: z.boolean().optional(),
    }).optional(),
    state: z.object({
      save_checkpoint: z.boolean(),
      include_shared: z.boolean(),
      checkpoint_type: z.enum(['automatic', 'manual']).optional(),
    }).optional(),
    response: z.object({
      stream: z.boolean(),
      include_metadata: z.boolean(),
      include_metrics: z.boolean(),
      max_tokens: z.number().min(1).max(32000).optional(),
      temperature: z.number().min(0).max(2).optional(),
      model: z.string().optional(),
    }).optional(),
    tools: z.object({
      enabled: z.boolean(),
      parallel_execution: z.boolean(),
      timeout_ms: z.number().min(1000).max(300000),
      max_retries: z.number().min(0).max(5).optional(),
      allowed_tools: z.array(z.string()).optional(),
    }).optional(),
    context: z.object({
      max_messages: z.number().min(1).max(1000).optional(),
      token_limit: z.number().min(100).max(128000).optional(),
      compression_enabled: z.boolean().optional(),
      include_system_messages: z.boolean().optional(),
    }).optional(),
    reasoning: z.object({
      enabled: z.boolean().default(true),
      mode: z.enum(['summary','trace']).default('summary'),
      threshold: z.number().min(0).max(1).default(0.6),
      max_steps: z.number().min(1).max(32).default(8),
      max_tool_calls: z.number().min(0).max(10).default(3),
      styles_allowed: z.array(z.enum(['inductive','abductive','deductive'])).optional(),
      style_bias: z.enum(['inductive','abductive','deductive']).optional(),
      budget_tokens: z.number().min(128).max(32000).optional(),
      timeout_ms: z.number().min(500).max(120000).optional(),
    }).optional(),
  }).optional(),
  request_id: z.string().optional(),
});

// ============================
// Schema Validator Implementation
// ============================

export class SchemaValidator {
  private schemas: Map<string, SchemaDefinition>;
  private cache: Map<string, z.ZodSchema<any>>;
  
  constructor() {
    this.schemas = new Map();
    this.cache = new Map();
    
    // Register default schemas
    this.registerDefaults();
  }
  
  /**
   * Validate a chat request
   */
  validateChatRequest(request: any): ValidationResult {
    return this.validate(request, ChatRequestV2Schema, 'ChatRequestV2');
  }
  
  /**
   * Validate a message
   */
  validateMessage(message: any): ValidationResult {
    return this.validate(message, AdvancedChatMessageSchema, 'AdvancedChatMessage');
  }
  
  /**
   * Validate message content
   */
  validateMessageContent(content: any): ValidationResult {
    return this.validate(content, MessageContentSchema, 'MessageContent');
  }
  
  /**
   * Register a custom schema
   */
  registerSchema(definition: SchemaDefinition): void {
    this.schemas.set(definition.name, definition);
    this.cache.delete(definition.name); // Invalidate cache
  }
  
  /**
   * Get a registered schema
   */
  getSchema(name: string): z.ZodSchema<any> | null {
    // Check cache
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }
    
    // Get from registry
    const definition = this.schemas.get(name);
    if (!definition) {
      return null;
    }
    
    // Cache and return
    this.cache.set(name, definition.schema);
    return definition.schema;
  }
  
  /**
   * Validate data against a schema
   */
  validate<T>(
    data: any,
    schema: z.ZodSchema<T>,
    schemaName?: string
  ): ValidationResult {
    try {
      const result = schema.safeParse(data);
      
      if (result.success) {
        return {
          valid: true,
          errors: [],
        };
      }
      
      // Convert Zod errors to our format
      const errors = this.formatZodErrors(result.error, schemaName);
      
      return {
        valid: false,
        errors,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          field: 'root',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          code: 'validation_error',
        }],
      };
    }
  }
  
  /**
   * Validate with warnings
   */
  validateWithWarnings<T>(
    data: any,
    schema: z.ZodSchema<T>,
    warningChecks?: Array<(data: T) => string | null>
  ): ValidationResult {
    const result = this.validate(data, schema);
    
    if (result.valid && warningChecks) {
      const warnings: Array<{ field: string; message: string }> = [];
      
      for (const check of warningChecks) {
        const warning = check(data as T);
        if (warning) {
          warnings.push({
            field: 'root',
            message: warning,
          });
        }
      }
      
      if (warnings.length > 0) {
        result.warnings = warnings;
      }
    }
    
    return result;
  }
  
  /**
   * Create a custom validator
   */
  createValidator<T>(schema: z.ZodSchema<T>): (data: any) => ValidationResult {
    return (data: any) => this.validate(data, schema);
  }
  
  // ============================
  // Private Methods
  // ============================
  
  private registerDefaults(): void {
    // Register all default schemas
    this.registerSchema({
      name: 'MessageRole',
      version: '2.0.0',
      schema: MessageRoleSchema,
    });
    
    this.registerSchema({
      name: 'MessageContent',
      version: '2.0.0',
      schema: MessageContentSchema,
    });
    
    this.registerSchema({
      name: 'AdvancedChatMessage',
      version: '2.0.0',
      schema: AdvancedChatMessageSchema,
    });
    
    this.registerSchema({
      name: 'ChatRequestV2',
      version: '2.0.0',
      schema: ChatRequestV2Schema,
    });
    
    this.registerSchema({
      name: 'ToolCall',
      version: '2.0.0',
      schema: ToolCallSchema,
    });
    
    this.registerSchema({
      name: 'MemoryReference',
      version: '2.0.0',
      schema: MemoryReferenceSchema,
    });
    
    this.registerSchema({
      name: 'StateSnapshot',
      version: '2.0.0',
      schema: StateSnapshotSchema,
    });
  }
  
  private formatZodErrors(
    error: z.ZodError,
    schemaName?: string
  ): Array<{ field: string; message: string; code: string; value?: any }> {
    const errors: Array<{ field: string; message: string; code: string; value?: any }> = [];
    
    for (const issue of error.issues) {
      const field = issue.path.join('.');
      const code = this.mapZodCode(issue.code);
      
      errors.push({
        field: field || 'root',
        message: issue.message,
        code,
        value: 'input' in issue ? issue.input : undefined,
      });
    }
    
    return errors;
  }
  
  private mapZodCode(zodCode: string): string {
    const codeMap: Record<string, string> = {
      invalid_type: 'invalid_type',
      invalid_literal: 'invalid_value',
      custom: 'custom_validation',
      invalid_union: 'invalid_union',
      invalid_union_discriminator: 'invalid_discriminator',
      invalid_enum_value: 'invalid_enum',
      unrecognized_keys: 'unknown_fields',
      invalid_arguments: 'invalid_arguments',
      invalid_return_type: 'invalid_return',
      invalid_date: 'invalid_date',
      invalid_string: 'invalid_string',
      too_small: 'min_length',
      too_big: 'max_length',
      invalid_intersection_types: 'invalid_intersection',
      not_multiple_of: 'not_multiple',
    };
    
    return codeMap[zodCode] || 'validation_error';
  }
}

// ============================
// Custom Validators
// ============================

export class CustomValidators {
  /**
   * Validate token count
   */
  static validateTokenCount(text: string, maxTokens: number): string | null {
    const estimatedTokens = Math.ceil(text.length / 4);
    
    if (estimatedTokens > maxTokens) {
      return `Estimated token count (${estimatedTokens}) exceeds limit (${maxTokens})`;
    }
    
    return null;
  }
  
  /**
   * Validate memory references
   */
  static validateMemoryReferences(
    refs: string[],
    maxRefs: number = 50
  ): string | null {
    if (refs.length > maxRefs) {
      return `Too many memory references (${refs.length}), maximum is ${maxRefs}`;
    }
    
    return null;
  }
  
  /**
   * Validate tool calls
   */
  static validateToolCalls(
    tools: ToolCall[],
    allowedTools?: string[]
  ): string | null {
    if (!allowedTools) return null;
    
    const disallowed = tools.filter(t => !allowedTools.includes(t.tool_name));
    
    if (disallowed.length > 0) {
      return `Disallowed tools: ${disallowed.map(t => t.tool_name).join(', ')}`;
    }
    
    return null;
  }
  
  /**
   * Validate conversation context
   */
  static validateConversationContext(
    context: any,
    requiredFields?: string[]
  ): string | null {
    if (!requiredFields) return null;
    
    const missing = requiredFields.filter(f => !context[f]);
    
    if (missing.length > 0) {
      return `Missing required context fields: ${missing.join(', ')}`;
    }
    
    return null;
  }
}

// ============================
// Schema Builder Utilities
// ============================

export class SchemaBuilder {
  /**
   * Create a message content schema with custom constraints
   */
  static createContentSchema(options: {
    maxLength?: number;
    allowedTypes?: Array<'text' | 'structured' | 'multimodal'>;
    customValidation?: (content: MessageContent) => boolean;
  }): z.ZodSchema<MessageContent> {
    let schema = MessageContentSchema;
    
    if (options.allowedTypes) {
      // Filter allowed types
      const schemas = [];
      
      if (options.allowedTypes.includes('text')) {
        let textSchema = TextContentSchema;
        if (options.maxLength) {
          textSchema = z.object({
            type: z.literal('text'),
            text: z.string().min(1).max(options.maxLength),
          });
        }
        schemas.push(textSchema);
      }
      
      if (options.allowedTypes.includes('structured')) {
        schemas.push(StructuredContentSchema);
      }
      
      if (options.allowedTypes.includes('multimodal')) {
        schemas.push(MultimodalContentSchema);
      }
      
      schema = z.discriminatedUnion('type', schemas as any);
    }
    
    if (options.customValidation) {
      schema = schema.refine(options.customValidation, {
        message: 'Custom validation failed',
      });
    }
    
    return schema;
  }
  
  /**
   * Create a request schema with custom options
   */
  static createRequestSchema(options: {
    requiredFields?: string[];
    maxTokens?: number;
    allowedRoles?: MessageRole[];
  }): z.ZodSchema<ChatRequestV2> {
    let schema = ChatRequestV2Schema;
    
    if (options.requiredFields) {
      // Make fields required
      // This would need more complex schema manipulation
    }
    
    return schema;
  }
}

// ============================
// Validation Middleware
// ============================

export function validationMiddleware(
  validator: SchemaValidator,
  schemaName: string
) {
  return async (request: Request): Promise<any> => {
    const body = await request.json();
    const schema = validator.getSchema(schemaName);
    
    if (!schema) {
      throw new Error(`Schema not found: ${schemaName}`);
    }
    
    const result = validator.validate(body, schema, schemaName);
    
    if (!result.valid) {
      throw new ValidationError(result.errors);
    }
    
    return body;
  };
}