// API v2 Validation
// Request validation utilities for the advanced JSON chat system

import { ValidationError } from './errors.ts';
import {
  BaseRequest,
  CreateMessageRequest,
  CreateConversationRequest,
  CreateMemoryRequest,
  SearchMemoriesRequest,
} from './schemas/requests.ts';
import {
  isValidMessageRole,
  isValidMemoryType,
  isValidContentType,
} from '../../types/guards.ts';

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
    value?: any;
  }>;
}

/**
 * Validation context for nested validations
 */
class ValidationContext {
  private errors: ValidationResult['errors'] = [];
  private path: string[] = [];
  
  pushPath(segment: string): void {
    this.path.push(segment);
  }
  
  popPath(): void {
    this.path.pop();
  }
  
  addError(message: string, code: string, value?: any): void {
    this.errors.push({
      field: this.path.join('.'),
      message,
      code,
      value,
    });
  }
  
  getResult(): ValidationResult {
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
    };
  }
}

/**
 * Base validators
 */
export class Validators {
  /**
   * Validate base request fields
   */
  static validateBaseRequest(data: any, ctx: ValidationContext): void {
    if (!data.version || data.version !== '2.0.0') {
      ctx.addError(
        `Invalid API version. Expected '2.0.0', got '${data.version}'`,
        'invalid_version',
        data.version
      );
    }
    
    if (data.request_id && typeof data.request_id !== 'string') {
      ctx.addError(
        'request_id must be a string',
        'invalid_type',
        data.request_id
      );
    }
  }
  
  /**
   * Validate required field
   */
  static required(value: any, field: string, ctx: ValidationContext): boolean {
    if (value === undefined || value === null) {
      ctx.addError(`${field} is required`, 'required_field');
      return false;
    }
    return true;
  }
  
  /**
   * Validate string
   */
  static string(
    value: any,
    field: string,
    ctx: ValidationContext,
    options?: {
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
    }
  ): boolean {
    if (!this.required(value, field, ctx)) return false;
    
    if (typeof value !== 'string') {
      ctx.addError(`${field} must be a string`, 'invalid_type', value);
      return false;
    }
    
    if (options?.minLength && value.length < options.minLength) {
      ctx.addError(
        `${field} must be at least ${options.minLength} characters`,
        'min_length',
        value
      );
      return false;
    }
    
    if (options?.maxLength && value.length > options.maxLength) {
      ctx.addError(
        `${field} must be at most ${options.maxLength} characters`,
        'max_length',
        value
      );
      return false;
    }
    
    if (options?.pattern && !options.pattern.test(value)) {
      ctx.addError(
        `${field} does not match required pattern`,
        'pattern_mismatch',
        value
      );
      return false;
    }
    
    return true;
  }
  
  /**
   * Validate number
   */
  static number(
    value: any,
    field: string,
    ctx: ValidationContext,
    options?: {
      min?: number;
      max?: number;
      integer?: boolean;
    }
  ): boolean {
    if (!this.required(value, field, ctx)) return false;
    
    if (typeof value !== 'number' || isNaN(value)) {
      ctx.addError(`${field} must be a number`, 'invalid_type', value);
      return false;
    }
    
    if (options?.integer && !Number.isInteger(value)) {
      ctx.addError(`${field} must be an integer`, 'not_integer', value);
      return false;
    }
    
    if (options?.min !== undefined && value < options.min) {
      ctx.addError(
        `${field} must be at least ${options.min}`,
        'min_value',
        value
      );
      return false;
    }
    
    if (options?.max !== undefined && value > options.max) {
      ctx.addError(
        `${field} must be at most ${options.max}`,
        'max_value',
        value
      );
      return false;
    }
    
    return true;
  }
  
  /**
   * Validate boolean
   */
  static boolean(value: any, field: string, ctx: ValidationContext): boolean {
    if (!this.required(value, field, ctx)) return false;
    
    if (typeof value !== 'boolean') {
      ctx.addError(`${field} must be a boolean`, 'invalid_type', value);
      return false;
    }
    
    return true;
  }
  
  /**
   * Validate array
   */
  static array(
    value: any,
    field: string,
    ctx: ValidationContext,
    options?: {
      minLength?: number;
      maxLength?: number;
      itemValidator?: (item: any, index: number, ctx: ValidationContext) => void;
    }
  ): boolean {
    if (!this.required(value, field, ctx)) return false;
    
    if (!Array.isArray(value)) {
      ctx.addError(`${field} must be an array`, 'invalid_type', value);
      return false;
    }
    
    if (options?.minLength && value.length < options.minLength) {
      ctx.addError(
        `${field} must have at least ${options.minLength} items`,
        'min_items',
        value
      );
      return false;
    }
    
    if (options?.maxLength && value.length > options.maxLength) {
      ctx.addError(
        `${field} must have at most ${options.maxLength} items`,
        'max_items',
        value
      );
      return false;
    }
    
    if (options?.itemValidator) {
      value.forEach((item, index) => {
        ctx.pushPath(`${field}[${index}]`);
        options.itemValidator(item, index, ctx);
        ctx.popPath();
      });
    }
    
    return true;
  }
  
  /**
   * Validate object
   */
  static object(
    value: any,
    field: string,
    ctx: ValidationContext,
    validator?: (obj: any, ctx: ValidationContext) => void
  ): boolean {
    if (!this.required(value, field, ctx)) return false;
    
    if (typeof value !== 'object' || Array.isArray(value)) {
      ctx.addError(`${field} must be an object`, 'invalid_type', value);
      return false;
    }
    
    if (validator) {
      ctx.pushPath(field);
      validator(value, ctx);
      ctx.popPath();
    }
    
    return true;
  }
  
  /**
   * Validate enum value
   */
  static enum<T>(
    value: any,
    field: string,
    validValues: T[],
    ctx: ValidationContext
  ): boolean {
    if (!this.required(value, field, ctx)) return false;
    
    if (!validValues.includes(value)) {
      ctx.addError(
        `${field} must be one of: ${validValues.join(', ')}`,
        'invalid_enum',
        value
      );
      return false;
    }
    
    return true;
  }
  
  /**
   * Validate UUID
   */
  static uuid(value: any, field: string, ctx: ValidationContext): boolean {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return this.string(value, field, ctx, { pattern: uuidPattern });
  }
  
  /**
   * Validate ISO timestamp
   */
  static timestamp(value: any, field: string, ctx: ValidationContext): boolean {
    if (!this.string(value, field, ctx)) return false;
    
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      ctx.addError(
        `${field} must be a valid ISO timestamp`,
        'invalid_timestamp',
        value
      );
      return false;
    }
    
    return true;
  }
}

/**
 * Request validators
 */
export class RequestValidators {
  /**
   * Validate create message request
   */
  static validateCreateMessage(data: any): ValidationResult {
    const ctx = new ValidationContext();
    
    // Base validation
    Validators.validateBaseRequest(data, ctx);
    
    // Message validation
    if (data.message) {
      ctx.pushPath('message');
      
      // Role
      if (data.message.role && !isValidMessageRole(data.message.role)) {
        ctx.addError(
          'Invalid message role',
          'invalid_role',
          data.message.role
        );
      }
      
      // Content
      if (data.message.content) {
        ctx.pushPath('content');
        
        if (data.message.content.type && !isValidContentType(data.message.content.type)) {
          ctx.addError(
            'Invalid content type',
            'invalid_content_type',
            data.message.content.type
          );
        }
        
        if (data.message.content.type === 'text') {
          Validators.string(data.message.content.text, 'text', ctx, {
            minLength: 1,
            maxLength: 100000,
          });
        }
        
        ctx.popPath();
      } else {
        ctx.addError('content is required', 'required_field');
      }
      
      // Memory refs
      if (data.message.memory_refs) {
        Validators.array(data.message.memory_refs, 'memory_refs', ctx, {
          itemValidator: (item, index, ctx) => {
            Validators.uuid(item, `memory_refs[${index}]`, ctx);
          },
        });
      }
      
      ctx.popPath();
    } else {
      ctx.addError('message is required', 'required_field');
    }
    
    // Context validation
    if (data.context) {
      ctx.pushPath('context');
      
      if (data.context.conversation_id) {
        Validators.uuid(data.context.conversation_id, 'conversation_id', ctx);
      }
      
      if (data.context.agent_id) {
        Validators.uuid(data.context.agent_id, 'agent_id', ctx);
      }
      
      ctx.popPath();
    }
    
    // Options validation
    if (data.options) {
      ctx.pushPath('options');
      
      // Memory options
      if (data.options.memory) {
        ctx.pushPath('memory');
        
        if (data.options.memory.enabled !== undefined) {
          Validators.boolean(data.options.memory.enabled, 'enabled', ctx);
        }
        
        if (data.options.memory.types) {
          Validators.array(data.options.memory.types, 'types', ctx, {
            itemValidator: (item, index, ctx) => {
              if (!isValidMemoryType(item)) {
                ctx.addError('Invalid memory type', 'invalid_memory_type', item);
              }
            },
          });
        }
        
        if (data.options.memory.max_results !== undefined) {
          Validators.number(data.options.memory.max_results, 'max_results', ctx, {
            min: 1,
            max: 100,
            integer: true,
          });
        }
        
        ctx.popPath();
      }
      
      // Response options
      if (data.options.response) {
        ctx.pushPath('response');
        
        if (data.options.response.max_tokens !== undefined) {
          Validators.number(data.options.response.max_tokens, 'max_tokens', ctx, {
            min: 1,
            max: 32000,
            integer: true,
          });
        }
        
        if (data.options.response.temperature !== undefined) {
          Validators.number(data.options.response.temperature, 'temperature', ctx, {
            min: 0,
            max: 2,
          });
        }
        
        ctx.popPath();
      }
      
      ctx.popPath();
    }
    
    return ctx.getResult();
  }
  
  /**
   * Validate create conversation request
   */
  static validateCreateConversation(data: any): ValidationResult {
    const ctx = new ValidationContext();
    
    Validators.validateBaseRequest(data, ctx);
    
    if (data.title) {
      Validators.string(data.title, 'title', ctx, {
        maxLength: 200,
      });
    }
    
    if (data.participants) {
      ctx.pushPath('participants');
      
      if (data.participants.user_id) {
        Validators.uuid(data.participants.user_id, 'user_id', ctx);
      }
      
      if (data.participants.agent_id) {
        Validators.uuid(data.participants.agent_id, 'agent_id', ctx);
      }
      
      if (data.participants.team_ids) {
        Validators.array(data.participants.team_ids, 'team_ids', ctx, {
          itemValidator: (item, index, ctx) => {
            Validators.uuid(item, `team_ids[${index}]`, ctx);
          },
        });
      }
      
      ctx.popPath();
    } else {
      ctx.addError('participants is required', 'required_field');
    }
    
    return ctx.getResult();
  }
  
  /**
   * Validate search memories request
   */
  static validateSearchMemories(data: any): ValidationResult {
    const ctx = new ValidationContext();
    
    Validators.validateBaseRequest(data, ctx);
    
    Validators.string(data.query, 'query', ctx, {
      minLength: 1,
      maxLength: 1000,
    });
    
    if (data.filters) {
      ctx.pushPath('filters');
      
      if (data.filters.memory_types) {
        Validators.array(data.filters.memory_types, 'memory_types', ctx, {
          itemValidator: (item, index, ctx) => {
            if (!isValidMemoryType(item)) {
              ctx.addError('Invalid memory type', 'invalid_memory_type', item);
            }
          },
        });
      }
      
      if (data.filters.importance_min !== undefined) {
        Validators.number(data.filters.importance_min, 'importance_min', ctx, {
          min: 0,
          max: 1,
        });
      }
      
      ctx.popPath();
    }
    
    return ctx.getResult();
  }
}

/**
 * Validate and transform request
 */
export function validateRequest<T extends BaseRequest>(
  data: any,
  validator: (data: any) => ValidationResult
): T {
  const result = validator(data);
  
  if (!result.valid) {
    throw new ValidationError(result.errors);
  }
  
  return data as T;
}

/**
 * Express/Deno middleware for validation
 */
export function validationMiddleware<T extends BaseRequest>(
  validator: (data: any) => ValidationResult
) {
  return async (req: Request): Promise<T> => {
    const body = await req.json();
    return validateRequest<T>(body, validator);
  };
}