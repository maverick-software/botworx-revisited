// API v2 Error Handling
// Comprehensive error handling for the advanced JSON chat system

import { ErrorResponse, ErrorCode, ErrorExtensions } from './schemas/responses.ts';

/**
 * Base error class for API v2
 */
export class APIError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly extensions?: ErrorExtensions;
  
  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    extensions?: ErrorExtensions
  ) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.status = status;
    this.extensions = extensions;
  }
  
  toResponse(): ErrorResponse {
    return {
      version: '2.0.0',
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        type: `https://api.agentopia.com/errors/${this.code}`,
        title: this.code.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        status: this.status,
        detail: this.message,
        instance: '',
        error_code: this.code,
        timestamp: new Date().toISOString(),
        extensions: this.extensions,
      },
    };
  }
}

/**
 * Validation error with field-specific details
 */
export class ValidationError extends APIError {
  constructor(errors: Array<{
    field: string;
    message: string;
    code: string;
    value?: any;
  }>) {
    super(
      ErrorCode.INVALID_REQUEST,
      'Validation failed for one or more fields',
      400,
      { validation_errors: errors }
    );
    this.name = 'ValidationError';
  }
}

/**
 * Rate limit error with retry information
 */
export class RateLimitError extends APIError {
  constructor(
    limit: number,
    remaining: number,
    reset: number,
    window: string = '1m'
  ) {
    super(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded. Limit: ${limit} per ${window}`,
      429,
      {
        rate_limit: { limit, remaining, reset, window },
        retry: {
          should_retry: true,
          after_seconds: Math.ceil((reset - Date.now()) / 1000),
        },
      }
    );
    this.name = 'RateLimitError';
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends APIError {
  constructor(detail: string = 'Authentication failed') {
    super(
      ErrorCode.AUTHENTICATION_FAILED,
      detail,
      401,
      {
        suggestions: [
          'Check your API key or token',
          'Ensure the Authorization header is properly formatted',
          'Verify your credentials are not expired',
        ],
        documentation: 'https://docs.agentopia.com/authentication',
      }
    );
    this.name = 'AuthenticationError';
  }
}

/**
 * Permission error
 */
export class PermissionError extends APIError {
  constructor(
    resource: string,
    action: string,
    requiredScopes?: string[]
  ) {
    super(
      ErrorCode.INSUFFICIENT_PERMISSIONS,
      `Insufficient permissions to ${action} ${resource}`,
      403,
      {
        suggestions: requiredScopes
          ? [`Required scopes: ${requiredScopes.join(', ')}`]
          : ['Contact your administrator to request access'],
        documentation: 'https://docs.agentopia.com/permissions',
      }
    );
    this.name = 'PermissionError';
  }
}

/**
 * Resource not found error
 */
export class NotFoundError extends APIError {
  constructor(
    resourceType: string,
    resourceId: string
  ) {
    super(
      ErrorCode.RESOURCE_NOT_FOUND,
      `${resourceType} with ID '${resourceId}' not found`,
      404,
      {
        suggestions: [
          `Verify the ${resourceType} ID is correct`,
          `Check if the ${resourceType} exists`,
          `Ensure you have permission to access this ${resourceType}`,
        ],
      }
    );
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error
 */
export class ConflictError extends APIError {
  constructor(
    resource: string,
    detail: string
  ) {
    super(
      ErrorCode.CONFLICT,
      `Conflict with existing ${resource}: ${detail}`,
      409
    );
    this.name = 'ConflictError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends APIError {
  constructor(
    operation: string,
    timeoutMs: number
  ) {
    super(
      ErrorCode.TIMEOUT,
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      504,
      {
        retry: {
          should_retry: true,
          max_attempts: 3,
        },
      }
    );
    this.name = 'TimeoutError';
  }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends APIError {
  constructor(
    service: string,
    reason?: string
  ) {
    super(
      ErrorCode.SERVICE_UNAVAILABLE,
      `Service '${service}' is temporarily unavailable${reason ? `: ${reason}` : ''}`,
      503,
      {
        retry: {
          should_retry: true,
          after_seconds: 30,
        },
      }
    );
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Business logic errors
 */
export class BusinessError extends APIError {
  constructor(
    code: ErrorCode,
    message: string,
    suggestions?: string[]
  ) {
    super(code, message, 422, { suggestions });
    this.name = 'BusinessError';
  }
}

/**
 * Error handler middleware
 */
import { CORS_HEADERS } from './index.ts';

export async function handleError(
  error: unknown,
  requestId?: string
): Promise<Response> {
  console.error('[API Error]', error);
  
  // Handle known API errors
  if (error instanceof APIError) {
    const response = error.toResponse();
    if (requestId) {
      response.error.request_id = requestId;
    }
    
    return new Response(JSON.stringify(response), {
      status: error.status,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId || '',
        ...CORS_HEADERS,
      },
    });
  }
  
  // Handle standard errors
  if (error instanceof Error) {
    const response: ErrorResponse = {
      version: '2.0.0',
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        type: 'https://api.agentopia.com/errors/internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred',
        instance: '',
        error_code: ErrorCode.INTERNAL_ERROR,
        timestamp: new Date().toISOString(),
        request_id: requestId,
        extensions: {
          suggestions: ['Please try again later', 'Contact support if the issue persists'],
          support: 'https://support.agentopia.com',
        },
      },
    };
    
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId || '',
        ...CORS_HEADERS,
      },
    });
  }
  
  // Handle unknown errors
  const response: ErrorResponse = {
    version: '2.0.0',
    status: 'error',
    timestamp: new Date().toISOString(),
    error: {
      type: 'https://api.agentopia.com/errors/internal_error',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unknown error occurred',
      instance: '',
      error_code: ErrorCode.INTERNAL_ERROR,
      timestamp: new Date().toISOString(),
      request_id: requestId,
    },
  };
  
  return new Response(JSON.stringify(response), {
    status: 500,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId || '',
      ...CORS_HEADERS,
    },
  });
}

/**
 * Error code to HTTP status mapping
 */
export const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  // 4xx errors
  [ErrorCode.INVALID_REQUEST]: 400,
  [ErrorCode.INVALID_MESSAGE_FORMAT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_API_VERSION]: 400,
  [ErrorCode.AUTHENTICATION_FAILED]: 401,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.PRECONDITION_FAILED]: 412,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.QUOTA_EXCEEDED]: 429,
  
  // 5xx errors
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.TIMEOUT]: 504,
  [ErrorCode.DEPENDENCY_ERROR]: 502,
  
  // Business errors (422)
  [ErrorCode.AGENT_NOT_FOUND]: 404,
  [ErrorCode.CONVERSATION_CLOSED]: 422,
  [ErrorCode.MEMORY_LIMIT_EXCEEDED]: 422,
  [ErrorCode.STATE_CORRUPTION]: 422,
  [ErrorCode.TOOL_EXECUTION_FAILED]: 422,
  [ErrorCode.CONTEXT_TOO_LARGE]: 422,
  [ErrorCode.INVALID_MEMORY_TYPE]: 422,
  [ErrorCode.CHECKPOINT_NOT_FOUND]: 404,
};

/**
 * Create error from code
 */
export function createError(
  code: ErrorCode,
  detail: string,
  extensions?: ErrorExtensions
): APIError {
  const status = ERROR_STATUS_MAP[code] || 500;
  return new APIError(code, detail, status, extensions);
}

/**
 * Validate request and throw if invalid
 */
export function validateOrThrow<T>(
  data: any,
  validator: (data: any) => { valid: boolean; errors: Array<any> }
): T {
  const result = validator(data);
  
  if (!result.valid) {
    throw new ValidationError(result.errors);
  }
  
  return data as T;
}

/**
 * Wrap async handler with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<Response>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    const requestId = crypto.randomUUID();
    
    try {
      const response = await handler(...args);
      
      // Add request ID to response
      const headers = new Headers(response.headers);
      headers.set('X-Request-ID', requestId);
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      return handleError(error, requestId);
    }
  }) as T;
}

/**
 * Assert condition or throw error
 */
export function assert(
  condition: boolean,
  code: ErrorCode,
  message: string
): asserts condition {
  if (!condition) {
    throw createError(code, message);
  }
}

/**
 * Assert not null or throw error
 */
export function assertNotNull<T>(
  value: T | null | undefined,
  resourceType: string,
  resourceId: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(resourceType, resourceId);
  }
}