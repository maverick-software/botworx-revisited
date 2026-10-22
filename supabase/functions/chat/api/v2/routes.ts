// API v2 Route Definitions
// Defines all endpoints for the advanced JSON chat system

export const API_VERSION = '2.0.0';
export const API_BASE_PATH = '/v2';

/**
 * Route definitions with metadata
 */
export const Routes = {
  // Chat endpoints
  chat: {
    messages: {
      create: {
        path: `${API_BASE_PATH}/chat/messages`,
        method: 'POST',
        description: 'Create a new message',
        auth: true,
        scopes: ['messages:write'],
      },
      stream: {
        path: `${API_BASE_PATH}/chat/messages/stream`,
        method: 'POST',
        description: 'Create a message with streaming response',
        auth: true,
        scopes: ['messages:write'],
      },
      get: {
        path: `${API_BASE_PATH}/chat/messages/:messageId`,
        method: 'GET',
        description: 'Get a specific message',
        auth: true,
        scopes: ['messages:read'],
      },
      updateMetadata: {
        path: `${API_BASE_PATH}/chat/messages/:messageId/metadata`,
        method: 'PATCH',
        description: 'Update message metadata',
        auth: true,
        scopes: ['messages:write'],
      },
      versions: {
        path: `${API_BASE_PATH}/chat/messages/:messageId/versions`,
        method: 'GET',
        description: 'Get message version history',
        auth: true,
        scopes: ['messages:read'],
      },
      batch: {
        path: `${API_BASE_PATH}/chat/messages/batch`,
        method: 'POST',
        description: 'Process multiple messages',
        auth: true,
        scopes: ['messages:write'],
      },
    },
  },
  
  // Conversation endpoints
  conversations: {
    create: {
      path: `${API_BASE_PATH}/conversations`,
      method: 'POST',
      description: 'Create a new conversation',
      auth: true,
      scopes: ['conversations:write'],
    },
    get: {
      path: `${API_BASE_PATH}/conversations/:conversationId`,
      method: 'GET',
      description: 'Get conversation details',
      auth: true,
      scopes: ['conversations:read'],
    },
    list: {
      path: `${API_BASE_PATH}/conversations`,
      method: 'GET',
      description: 'List conversations',
      auth: true,
      scopes: ['conversations:read'],
      queryParams: ['agent_id', 'user_id', 'status', 'limit', 'offset'],
    },
    messages: {
      path: `${API_BASE_PATH}/conversations/:conversationId/messages`,
      method: 'GET',
      description: 'Get conversation messages',
      auth: true,
      scopes: ['conversations:read', 'messages:read'],
      queryParams: ['limit', 'offset', 'since', 'until'],
    },
    update: {
      path: `${API_BASE_PATH}/conversations/:conversationId`,
      method: 'PATCH',
      description: 'Update conversation',
      auth: true,
      scopes: ['conversations:write'],
    },
    close: {
      path: `${API_BASE_PATH}/conversations/:conversationId/close`,
      method: 'POST',
      description: 'Close a conversation',
      auth: true,
      scopes: ['conversations:write'],
    },
  },
  
  // Memory endpoints
  memories: {
    create: {
      path: `${API_BASE_PATH}/agents/:agentId/memories`,
      method: 'POST',
      description: 'Create agent memory',
      auth: true,
      scopes: ['memories:write'],
    },
    search: {
      path: `${API_BASE_PATH}/agents/:agentId/memories/search`,
      method: 'POST',
      description: 'Search agent memories',
      auth: true,
      scopes: ['memories:read'],
    },
    get: {
      path: `${API_BASE_PATH}/memories/:memoryId`,
      method: 'GET',
      description: 'Get specific memory',
      auth: true,
      scopes: ['memories:read'],
    },
    updateImportance: {
      path: `${API_BASE_PATH}/memories/:memoryId/importance`,
      method: 'PATCH',
      description: 'Update memory importance',
      auth: true,
      scopes: ['memories:write'],
    },
    consolidate: {
      path: `${API_BASE_PATH}/agents/:agentId/memories/consolidate`,
      method: 'POST',
      description: 'Consolidate agent memories',
      auth: true,
      scopes: ['memories:write'],
    },
    delete: {
      path: `${API_BASE_PATH}/memories/:memoryId`,
      method: 'DELETE',
      description: 'Delete a memory',
      auth: true,
      scopes: ['memories:delete'],
    },
  },
  
  // State endpoints
  state: {
    getCurrent: {
      path: `${API_BASE_PATH}/agents/:agentId/state`,
      method: 'GET',
      description: 'Get current agent state',
      auth: true,
      scopes: ['state:read'],
    },
    update: {
      path: `${API_BASE_PATH}/agents/:agentId/state`,
      method: 'PATCH',
      description: 'Update agent state',
      auth: true,
      scopes: ['state:write'],
    },
    createCheckpoint: {
      path: `${API_BASE_PATH}/agents/:agentId/state/checkpoints`,
      method: 'POST',
      description: 'Create state checkpoint',
      auth: true,
      scopes: ['state:write'],
    },
    restore: {
      path: `${API_BASE_PATH}/agents/:agentId/state/restore`,
      method: 'POST',
      description: 'Restore from checkpoint',
      auth: true,
      scopes: ['state:write'],
    },
    history: {
      path: `${API_BASE_PATH}/agents/:agentId/state/history`,
      method: 'GET',
      description: 'Get state history',
      auth: true,
      scopes: ['state:read'],
      queryParams: ['limit', 'offset', 'since', 'until'],
    },
  },
  
  // Context endpoints
  context: {
    getSnapshot: {
      path: `${API_BASE_PATH}/messages/:messageId/context`,
      method: 'GET',
      description: 'Get context snapshot',
      auth: true,
      scopes: ['messages:read'],
    },
    createTemplate: {
      path: `${API_BASE_PATH}/context/templates`,
      method: 'POST',
      description: 'Create context template',
      auth: true,
      scopes: ['admin:write'],
    },
    applyTemplate: {
      path: `${API_BASE_PATH}/conversations/:conversationId/context/apply`,
      method: 'POST',
      description: 'Apply context template',
      auth: true,
      scopes: ['conversations:write'],
    },
    optimize: {
      path: `${API_BASE_PATH}/conversations/:conversationId/context/optimize`,
      method: 'POST',
      description: 'Optimize conversation context',
      auth: true,
      scopes: ['conversations:write'],
    },
  },
  
  // System endpoints
  system: {
    health: {
      path: `${API_BASE_PATH}/health`,
      method: 'GET',
      description: 'Health check',
      auth: false,
      scopes: [],
    },
    status: {
      path: `${API_BASE_PATH}/status`,
      method: 'GET',
      description: 'System status',
      auth: false,
      scopes: [],
    },
    migrate: {
      path: `${API_BASE_PATH}/migrate`,
      method: 'POST',
      description: 'Migrate from v1',
      auth: true,
      scopes: ['admin:write'],
    },
    migrationStatus: {
      path: `${API_BASE_PATH}/migration/status`,
      method: 'GET',
      description: 'Migration status',
      auth: true,
      scopes: ['admin:read'],
    },
  },
};

/**
 * Helper to build full URL for a route
 */
export function buildUrl(route: any, params?: Record<string, string>): string {
  let url = route.path;
  
  // Replace path parameters
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, value);
    });
  }
  
  return url;
}

/**
 * Route matcher for incoming requests
 */
export function matchRoute(method: string, path: string): {
  route: any;
  params: Record<string, string>;
} | null {
  // Normalize path
  const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
  
  // Iterate through all routes
  for (const category of Object.values(Routes)) {
    for (const endpoint of Object.values(category as any)) {
      if (endpoint.method !== method) continue;
      
      // Create regex pattern from route path
      const pattern = endpoint.path
        .replace(/:[^/]+/g, '([^/]+)') // Replace :param with capture group
        .replace(/\//g, '\\/'); // Escape slashes
      
      const regex = new RegExp(`^${pattern}$`);
      const match = normalizedPath.match(regex);
      
      if (match) {
        // Extract parameters
        const params: Record<string, string> = {};
        const paramNames = (endpoint.path.match(/:[^/]+/g) || [])
          .map(p => p.substring(1));
        
        paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });
        
        return { route: endpoint, params };
      }
    }
  }
  
  return null;
}

/**
 * Scope definitions
 */
export const Scopes = {
  // Message operations
  MESSAGES_READ: 'messages:read',
  MESSAGES_WRITE: 'messages:write',
  
  // Conversation operations
  CONVERSATIONS_READ: 'conversations:read',
  CONVERSATIONS_WRITE: 'conversations:write',
  
  // Memory operations
  MEMORIES_READ: 'memories:read',
  MEMORIES_WRITE: 'memories:write',
  MEMORIES_DELETE: 'memories:delete',
  
  // State operations
  STATE_READ: 'state:read',
  STATE_WRITE: 'state:write',
  
  // Admin operations
  ADMIN_READ: 'admin:read',
  ADMIN_WRITE: 'admin:write',
};

/**
 * Rate limit configurations
 */
export const RateLimits = {
  default: {
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: 'Too many requests',
  },
  streaming: {
    windowMs: 60 * 1000,
    max: 30,
    message: 'Too many streaming requests',
  },
  batch: {
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many batch requests',
  },
  migration: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: 'Too many migration requests',
  },
};