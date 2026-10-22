// API v2 Main Entry Point
// Central export and configuration for the advanced JSON chat system API

// Export routes
export * from './routes.ts';

// Export schemas
export * from './schemas/requests.ts';
export * from './schemas/responses.ts';

// Export error handling
export * from './errors.ts';

// Export validation
export * from './validation.ts';

// API Configuration
export const APIConfig = {
  version: '2.0.0',
  basePath: '/v2',
  
  // Rate limiting defaults
  rateLimits: {
    default: {
      windowMs: 60 * 1000, // 1 minute
      max: 100,
    },
    streaming: {
      windowMs: 60 * 1000,
      max: 30,
    },
    batch: {
      windowMs: 60 * 1000,
      max: 10,
    },
  },
  
  // Response defaults
  defaults: {
    maxTokens: 4096,
    temperature: 0.7,
    // Model now determined by LLMRouter per-agent when USE_LLM_ROUTER=true
    model: 'gpt-4',
    memoryMaxResults: 10,
    contextWindowSize: 50,
  },
  
  // Limits
  limits: {
    maxMessageLength: 100000,
    maxBatchSize: 50,
    maxMemoryResults: 100,
    maxConversationMessages: 1000,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  },
  
  // Timeouts
  timeouts: {
    default: 30000, // 30 seconds
    streaming: 300000, // 5 minutes
    toolExecution: 60000, // 1 minute
    migration: 600000, // 10 minutes
  },
};

// Content type constants
export const ContentTypes = {
  JSON: 'application/json',
  JSON_V2: 'application/vnd.agentopia.v2+json',
  STREAM: 'text/event-stream',
  ERROR: 'application/problem+json',
} as const;

// Header constants
export const Headers = {
  API_VERSION: 'X-API-Version',
  REQUEST_ID: 'X-Request-ID',
  RATE_LIMIT: 'X-RateLimit-Limit',
  RATE_REMAINING: 'X-RateLimit-Remaining',
  RATE_RESET: 'X-RateLimit-Reset',
  RESPONSE_TIME: 'X-Response-Time',
  DEPRECATION: 'X-Deprecation',
} as const;

/**
 * Create standard API response headers
 */
export function createResponseHeaders(options?: {
  requestId?: string;
  processingTime?: number;
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
  deprecations?: string[];
}): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': ContentTypes.JSON,
    [Headers.API_VERSION]: APIConfig.version,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    ...CORS_HEADERS,
  };
  
  if (options?.requestId) {
    headers[Headers.REQUEST_ID] = options.requestId;
  }
  
  if (options?.processingTime !== undefined) {
    headers[Headers.RESPONSE_TIME] = `${options.processingTime}ms`;
  }
  
  if (options?.rateLimit) {
    headers[Headers.RATE_LIMIT] = String(options.rateLimit.limit);
    headers[Headers.RATE_REMAINING] = String(options.rateLimit.remaining);
    headers[Headers.RATE_RESET] = String(options.rateLimit.reset);
  }
  
  if (options?.deprecations && options.deprecations.length > 0) {
    headers[Headers.DEPRECATION] = options.deprecations.join('; ');
  }
  
  return headers;
}

/**
 * Parse accept header for content negotiation
 */
export function parseAcceptHeader(acceptHeader: string | null): {
  wantsJSON: boolean;
  wantsV2: boolean;
  wantsStream: boolean;
} {
  if (!acceptHeader) {
    return { wantsJSON: true, wantsV2: false, wantsStream: false };
  }
  
  const accepts = acceptHeader.toLowerCase();
  
  return {
    wantsJSON: accepts.includes('application/json') || accepts.includes('*/*'),
    wantsV2: accepts.includes('application/vnd.agentopia.v2+json'),
    wantsStream: accepts.includes('text/event-stream'),
  };
}

/**
 * Get API version from request
 */
export function getAPIVersion(req: Request): string {
  // Check header first
  const headerVersion = req.headers.get(Headers.API_VERSION);
  if (headerVersion) return headerVersion;
  
  // Check URL path
  const url = new URL(req.url);
  if (url.pathname.includes('/v2/')) return '2.0';
  if (url.pathname.includes('/v1/')) return '1.0';
  
  // Check accept header
  const acceptHeader = req.headers.get('Accept');
  if (acceptHeader?.includes('vnd.agentopia.v2')) return '2.0';
  if (acceptHeader?.includes('vnd.agentopia.v1')) return '1.0';
  
  // Default
  return '1.0';
}

/**
 * Create pagination links
 */
export function createPaginationLinks(
  baseUrl: string,
  total: number,
  limit: number,
  offset: number
): {
  self: string;
  first?: string;
  prev?: string;
  next?: string;
  last?: string;
} {
  const url = new URL(baseUrl);
  
  // Self
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  const links: any = { self: url.toString() };
  
  // First
  if (offset > 0) {
    url.searchParams.set('offset', '0');
    links.first = url.toString();
  }
  
  // Previous
  if (offset > 0) {
    const prevOffset = Math.max(0, offset - limit);
    url.searchParams.set('offset', String(prevOffset));
    links.prev = url.toString();
  }
  
  // Next
  if (offset + limit < total) {
    url.searchParams.set('offset', String(offset + limit));
    links.next = url.toString();
  }
  
  // Last
  if (offset + limit < total) {
    const lastOffset = Math.floor(total / limit) * limit;
    url.searchParams.set('offset', String(lastOffset));
    links.last = url.toString();
  }
  
  return links;
}

/**
 * Format link header for pagination
 */
export function formatLinkHeader(links: Record<string, string>): string {
  return Object.entries(links)
    .map(([rel, url]) => `<${url}>; rel="${rel}"`)
    .join(', ');
}

/**
 * Stream response helper
 */
export class StreamResponse {
  private encoder = new TextEncoder();
  private stream: ReadableStream<Uint8Array>;
  private controller?: ReadableStreamDefaultController<Uint8Array>;
  
  constructor() {
    this.stream = new ReadableStream({
      start: (controller) => {
        this.controller = controller;
      },
    });
  }
  
  send(event: any): void {
    if (!this.controller) return;
    
    const data = `data: ${JSON.stringify(event)}\n\n`;
    this.controller.enqueue(this.encoder.encode(data));
  }
  
  close(): void {
    this.controller?.close();
  }
  
  error(error: any): void {
    this.controller?.error(error);
  }
  
  getResponse(): Response {
    return new Response(this.stream, {
      headers: {
        'Content-Type': ContentTypes.STREAM,
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }
}

/**
 * Middleware composition helper
 */
export function compose(...middlewares: Array<(req: Request) => Promise<Response | void>>) {
  return async (req: Request): Promise<Response> => {
    for (const middleware of middlewares) {
      const result = await middleware(req);
      if (result) return result;
    }
    
    throw new Error('No middleware returned a response');
  };
}

/**
 * CORS headers
 */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  // Include both common Supabase client headers and our custom headers (case-insensitive but some environments are picky)
  'Access-Control-Allow-Headers': [
    'authorization',
    'content-type',
    'x-client-info',
    'apikey',
    'Authorization',
    'Content-Type',
    'X-API-Version',
    'X-Request-ID',
  ].join(', '),
  'Access-Control-Max-Age': '86400',
} as const;

/**
 * Handle CORS preflight
 */
export function handleCORS(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }
  
  return null;
}