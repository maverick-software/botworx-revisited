/**
 * MCP Server Detection and Type Utilities
 * 
 * Provides intelligent detection of MCP server types and their capabilities.
 * Supports Zapier, Retell AI, Anthropic, OpenAI, and custom MCP servers.
 */

export interface MCPServerType {
  type: string;
  name: string;
  vendor?: string;
  requiresInstructions: boolean;
  supportsSSE: boolean;
  defaultTransport: 'http' | 'http-sse' | 'websocket';
  knownCapabilities: string[];
}

export interface MCPInitializeResponse {
  protocolVersion: string;
  capabilities?: {
    tools?: { listChanged?: boolean };
    prompts?: { listChanged?: boolean };
    resources?: { subscribe?: boolean; listChanged?: boolean };
    sampling?: {};
    experimental?: Record<string, any>;
  };
  serverInfo?: {
    name?: string;
    version?: string;
    vendor?: string;
  };
}

/**
 * Detect MCP server type from initialize response and URL
 */
export function detectServerType(
  serverUrl: string,
  initResponse: MCPInitializeResponse
): string {
  // Priority 1: Check server info for known providers
  const serverName = initResponse.serverInfo?.name?.toLowerCase() || '';
  const vendor = initResponse.serverInfo?.vendor?.toLowerCase() || '';
  
  if (serverName.includes('zapier') || vendor.includes('zapier')) {
    return 'zapier';
  }
  if (serverName.includes('retell') || vendor.includes('retell')) {
    return 'retell';
  }
  if (serverName.includes('anthropic') || vendor.includes('anthropic')) {
    return 'anthropic';
  }
  if (serverName.includes('openai') || vendor.includes('openai')) {
    return 'openai';
  }
  
  // Priority 2: Check URL patterns
  try {
    const url = new URL(serverUrl);
    const hostname = url.hostname.toLowerCase();
    
    if (hostname.includes('zapier.com') || hostname.includes('zapier')) {
      return 'zapier';
    }
    if (hostname.includes('retellai.com') || hostname.includes('retell')) {
      return 'retell';
    }
    if (hostname.includes('anthropic.com')) {
      return 'anthropic';
    }
    if (hostname.includes('openai.com')) {
      return 'openai';
    }
  } catch (e) {
    // Invalid URL, continue to capabilities check
  }
  
  // Priority 3: Check experimental capabilities for unique patterns
  const experimental = initResponse.capabilities?.experimental || {};
  
  if (experimental['zapier-ai-actions'] !== undefined) {
    return 'zapier';
  }
  if (experimental['retell-telephony'] !== undefined) {
    return 'retell';
  }
  if (experimental['anthropic-tools'] !== undefined) {
    return 'anthropic';
  }
  
  // Priority 4: If server info exists but didn't match known types, use the name
  if (initResponse.serverInfo?.name) {
    // Sanitize the name to create a valid type identifier
    return initResponse.serverInfo.name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  // Default to generic MCP server
  return 'generic';
}

/**
 * Get metadata and behavioral information for a server type
 */
export function getServerTypeMetadata(type: string): MCPServerType {
  const metadata: Record<string, MCPServerType> = {
    zapier: {
      type: 'zapier',
      name: 'Zapier MCP Server',
      vendor: 'Zapier',
      requiresInstructions: true,
      supportsSSE: true,
      defaultTransport: 'http-sse',
      knownCapabilities: ['tools', 'experimental.zapier-ai-actions']
    },
    retell: {
      type: 'retell',
      name: 'Retell AI MCP Server',
      vendor: 'Retell AI',
      requiresInstructions: false,
      supportsSSE: true,
      defaultTransport: 'http',
      knownCapabilities: ['tools', 'experimental.retell-telephony']
    },
    anthropic: {
      type: 'anthropic',
      name: 'Anthropic MCP Server',
      vendor: 'Anthropic',
      requiresInstructions: false,
      supportsSSE: false,
      defaultTransport: 'http',
      knownCapabilities: ['tools', 'prompts', 'resources']
    },
    openai: {
      type: 'openai',
      name: 'OpenAI MCP Server',
      vendor: 'OpenAI',
      requiresInstructions: false,
      supportsSSE: true,
      defaultTransport: 'http',
      knownCapabilities: ['tools', 'sampling']
    },
    generic: {
      type: 'generic',
      name: 'Generic MCP Server',
      vendor: undefined,
      requiresInstructions: false,
      supportsSSE: true,
      defaultTransport: 'http',
      knownCapabilities: ['tools']
    }
  };
  
  return metadata[type] || metadata.generic;
}

/**
 * Validate that a server response conforms to MCP protocol
 */
export function validateMCPResponse(response: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check JSON-RPC 2.0 format
  if (response.jsonrpc !== '2.0') {
    errors.push('Invalid JSON-RPC version (must be "2.0")');
  }
  
  // Check for id field
  if (response.id === undefined) {
    errors.push('Missing required "id" field');
  }
  
  // Check for result or error
  if (response.result === undefined && response.error === undefined) {
    errors.push('Response must contain either "result" or "error"');
  }
  
  // If error is present, validate error structure
  if (response.error) {
    if (typeof response.error.code !== 'number') {
      errors.push('Error code must be a number');
    }
    if (typeof response.error.message !== 'string') {
      errors.push('Error message must be a string');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Extract capabilities from initialize response
 */
export function extractCapabilities(initResponse: MCPInitializeResponse): string[] {
  const capabilities: string[] = [];
  const caps = initResponse.capabilities || {};
  
  if (caps.tools) {
    capabilities.push('tools');
  }
  if (caps.prompts) {
    capabilities.push('prompts');
  }
  if (caps.resources) {
    capabilities.push('resources');
  }
  if (caps.sampling) {
    capabilities.push('sampling');
  }
  
  // Add experimental capabilities
  if (caps.experimental) {
    Object.keys(caps.experimental).forEach(key => {
      capabilities.push(`experimental.${key}`);
    });
  }
  
  return capabilities;
}

/**
 * Format server info for display
 */
export function formatServerInfo(
  type: string,
  initResponse: MCPInitializeResponse
): string {
  const metadata = getServerTypeMetadata(type);
  const serverInfo = initResponse.serverInfo;
  
  if (serverInfo?.name && serverInfo?.version) {
    return `${serverInfo.name} v${serverInfo.version}`;
  }
  if (serverInfo?.name) {
    return serverInfo.name;
  }
  
  return metadata.name;
}

/**
 * Check if server supports a specific capability
 */
export function hasCapability(
  initResponse: MCPInitializeResponse,
  capability: string
): boolean {
  const capabilities = extractCapabilities(initResponse);
  return capabilities.includes(capability);
}

/**
 * Generate connection health report
 */
export interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  checks: {
    protocol: boolean;
    tools: boolean;
    lastCall: boolean;
  };
}

export function generateHealthReport(
  protocolVersion: string,
  toolCount: number,
  lastCall: Date | null,
  currentTime: Date = new Date()
): HealthReport {
  const checks = {
    protocol: protocolVersion >= '2024-11-05', // Minimum supported version
    tools: toolCount > 0,
    lastCall: lastCall !== null && (currentTime.getTime() - lastCall.getTime()) < 7 * 24 * 60 * 60 * 1000 // < 7 days
  };
  
  const allHealthy = Object.values(checks).every(v => v);
  const someHealthy = Object.values(checks).some(v => v);
  
  if (allHealthy) {
    return {
      status: 'healthy',
      message: 'Server is operating normally',
      checks
    };
  }
  
  if (!someHealthy) {
    return {
      status: 'unhealthy',
      message: 'Server has critical issues',
      checks
    };
  }
  
  // Identify specific issues
  const issues: string[] = [];
  if (!checks.protocol) issues.push('outdated protocol');
  if (!checks.tools) issues.push('no tools available');
  if (!checks.lastCall) issues.push('connection stale');
  
  return {
    status: 'degraded',
    message: `Server issues: ${issues.join(', ')}`,
    checks
  };
}

