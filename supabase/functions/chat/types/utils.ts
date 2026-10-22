/**
 * Type Utilities for Advanced Chat System
 * Version: 1.0.0
 * 
 * Common utility functions and helpers for working with the type system.
 */

import {
  AdvancedChatMessage,
  MessageRole,
  MessageContent,
  ChatRequestV2
} from './message.types.ts';

import {
  MemoryType,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory
} from './memory.types.ts';

import {
  AgentState,
  StateChange,
  StateDelta
} from './state.types.ts';

import {
  ContextSegment,
  ContextWindow
} from './context.types.ts';

// ============================
// ID Generation
// ============================

/**
 * Generate a UUID v4
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate a prefixed ID for better organization
 */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}_${generateId()}`;
}

/**
 * Generate a memory-specific ID
 */
export function generateMemoryId(): string {
  return generatePrefixedId('mem');
}

/**
 * Generate a state-specific ID
 */
export function generateStateId(): string {
  return generatePrefixedId('state');
}

/**
 * Generate a message-specific ID
 * Note: Returns pure UUID format for database compatibility (id field is UUID type)
 */
export function generateMessageId(): string {
  return generateId(); // Use pure UUID format for database compatibility
}

/**
 * Generate a conversation-specific ID
 * Note: Returns pure UUID format for database compatibility
 */
export function generateConversationId(): string {
  return generateId(); // Use pure UUID format for database compatibility
}

// ============================
// Timestamp Utilities
// ============================

/**
 * Get current ISO timestamp with timezone
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Generate a timestamp (alias for getCurrentTimestamp for consistency)
 */
export function generateTimestamp(): string {
  return getCurrentTimestamp();
}

/**
 * Calculate time difference in milliseconds
 */
export function getTimeDiff(start: string, end: string): number {
  return new Date(end).getTime() - new Date(start).getTime();
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

// ============================
// Message Utilities
// ============================

/**
 * Create a basic message structure
 */
export function createMessage(
  role: MessageRole,
  content: string,
  context?: Partial<AdvancedChatMessage['context']>
): Partial<AdvancedChatMessage> {
  return {
    id: generateId(),
    version: '1.0.0',
    role,
    content: {
      type: 'text',
      text: content
    },
    timestamp: getCurrentTimestamp(),
    created_at: getCurrentTimestamp(),
    metadata: {},
    context: {
      conversation_id: context?.conversation_id || generateId(),
      session_id: context?.session_id || generateId(),
      ...context
    }
  };
}

/**
 * Extract text content from various message content types
 */
export function extractTextContent(content: MessageContent): string {
  if (content.text) return content.text;
  
  if (content.structured) {
    return JSON.stringify(content.structured);
  }
  
  if (content.parts) {
    return content.parts
      .map(part => {
        if (typeof part.content === 'string') return part.content;
        return JSON.stringify(part.content);
      })
      .join('\n');
  }
  
  return '';
}

/**
 * Merge message metadata
 */
export function mergeMetadata(
  base: Record<string, any>,
  updates: Record<string, any>
): Record<string, any> {
  return {
    ...base,
    ...updates,
    tokens: {
      ...base.tokens,
      ...updates.tokens
    },
    latency: {
      ...base.latency,
      ...updates.latency
    }
  };
}

// ============================
// Memory Utilities
// ============================

/**
 * Calculate memory decay based on time and access patterns
 */
export function calculateMemoryDecay(
  lastAccessed: string,
  accessCount: number,
  decayRate: number
): number {
  const daysSinceAccess = getTimeDiff(lastAccessed, getCurrentTimestamp()) / (1000 * 60 * 60 * 24);
  const accessBonus = Math.log(accessCount + 1) * 0.1;
  const decay = Math.exp(-decayRate * daysSinceAccess);
  return Math.min(1, decay + accessBonus);
}

/**
 * Rank memories by combined relevance and importance
 */
export function rankMemories<T extends { importance: number; relevance_score?: number }>(
  memories: T[],
  weights = { importance: 0.4, relevance: 0.6 }
): T[] {
  return memories.sort((a, b) => {
    const scoreA = (a.importance * weights.importance) + 
                   ((a.relevance_score || 0) * weights.relevance);
    const scoreB = (b.importance * weights.importance) + 
                   ((b.relevance_score || 0) * weights.relevance);
    return scoreB - scoreA;
  });
}

/**
 * Group memories by type
 */
export function groupMemoriesByType(memories: Array<{
  memory_type: MemoryType;
  [key: string]: any;
}>): Record<MemoryType, any[]> {
  return memories.reduce((acc, memory) => {
    if (!acc[memory.memory_type]) {
      acc[memory.memory_type] = [];
    }
    acc[memory.memory_type].push(memory);
    return acc;
  }, {} as Record<MemoryType, any[]>);
}

// ============================
// State Utilities
// ============================

/**
 * Create a state delta from two states
 */
export function createStateDelta(
  previousState: any,
  newState: any,
  path = ''
): StateChange[] {
  const changes: StateChange[] = [];

  // Handle different types
  if (previousState === newState) return changes;
  
  if (previousState === undefined) {
    changes.push({
      path,
      operation: 'add',
      new_value: newState
    });
    return changes;
  }
  
  if (newState === undefined) {
    changes.push({
      path,
      operation: 'delete',
      previous_value: previousState
    });
    return changes;
  }
  
  if (typeof previousState !== typeof newState) {
    changes.push({
      path,
      operation: 'update',
      previous_value: previousState,
      new_value: newState
    });
    return changes;
  }
  
  // Handle objects
  if (typeof previousState === 'object' && previousState !== null) {
    const allKeys = new Set([
      ...Object.keys(previousState),
      ...Object.keys(newState)
    ]);
    
    for (const key of allKeys) {
      const subPath = path ? `${path}.${key}` : key;
      changes.push(...createStateDelta(
        previousState[key],
        newState[key],
        subPath
      ));
    }
    
    return changes;
  }
  
  // Handle primitives
  if (previousState !== newState) {
    changes.push({
      path,
      operation: 'update',
      previous_value: previousState,
      new_value: newState
    });
  }
  
  return changes;
}

/**
 * Apply a state delta to a state object
 */
export function applyStateDelta(
  state: any,
  delta: StateDelta
): any {
  const newState = JSON.parse(JSON.stringify(state)); // Deep clone
  
  for (const change of delta.changes) {
    const pathParts = change.path.split('.');
    let current = newState;
    
    // Navigate to the parent of the target
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) {
        current[pathParts[i]] = {};
      }
      current = current[pathParts[i]];
    }
    
    const lastKey = pathParts[pathParts.length - 1];
    
    switch (change.operation) {
      case 'add':
      case 'update':
        current[lastKey] = change.new_value;
        break;
      case 'delete':
        delete current[lastKey];
        break;
    }
  }
  
  return newState;
}

/**
 * Calculate state hash for integrity checking
 */
export function calculateStateHash(state: any): string {
  const stateString = JSON.stringify(state, Object.keys(state).sort());
  // Simple hash implementation - in production use crypto
  let hash = 0;
  for (let i = 0; i < stateString.length; i++) {
    const char = stateString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

// ============================
// Context Utilities
// ============================

/**
 * Calculate total tokens in a context window
 */
export function calculateTotalTokens(window: ContextWindow): number {
  return window.segments.reduce((sum, segment) => sum + segment.tokens, 0);
}

/**
 * Sort segments by priority
 */
export function sortSegmentsByPriority(segments: ContextSegment[]): ContextSegment[] {
  return [...segments].sort((a, b) => b.priority - a.priority);
}

/**
 * Filter segments by type
 */
export function filterSegmentsByType(
  segments: ContextSegment[],
  types: string[]
): ContextSegment[] {
  return segments.filter(segment => types.includes(segment.type));
}

/**
 * Calculate context window efficiency
 */
export function calculateContextEfficiency(window: ContextWindow): {
  utilization: number;
  compressionEfficiency: number;
  diversityScore: number;
} {
  const utilization = window.current_tokens / window.max_tokens;
  
  const compressedTokens = window.segments
    .filter(s => s.compressed)
    .reduce((sum, s) => sum + (s.original_tokens || s.tokens) - s.tokens, 0);
  
  const totalOriginalTokens = window.segments
    .reduce((sum, s) => sum + (s.original_tokens || s.tokens), 0);
  
  const compressionEfficiency = totalOriginalTokens > 0 
    ? compressedTokens / totalOriginalTokens 
    : 0;
  
  // Calculate diversity based on segment types
  const typeCount = new Set(window.segments.map(s => s.type)).size;
  const maxTypes = 8; // Number of defined segment types
  const diversityScore = typeCount / maxTypes;
  
  return {
    utilization,
    compressionEfficiency,
    diversityScore
  };
}

// ============================
// Validation Utilities
// ============================

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
  
  const cloned = {} as T;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const result = deepClone(target);
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        result[key] &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key])
      ) {
        result[key] = deepMerge(result[key], source[key]);
      } else {
        result[key] = deepClone(source[key]) as any;
      }
    }
  }
  
  return result;
}

/**
 * Pick specific fields from an object
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific fields from an object
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

// ============================
// Token Estimation
// ============================

/**
 * Estimate token count for a string
 * Note: This is a rough approximation. Use a proper tokenizer in production.
 */
export function estimateTokens(text: string): number {
  // Rough approximation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for an object
 */
export function estimateObjectTokens(obj: any): number {
  return estimateTokens(JSON.stringify(obj));
}

/**
 * Truncate text to fit within token limit
 */
export function truncateToTokenLimit(
  text: string,
  maxTokens: number,
  addEllipsis = true
): string {
  const estimatedChars = maxTokens * 4;
  if (text.length <= estimatedChars) return text;
  
  const truncated = text.substring(0, estimatedChars - (addEllipsis ? 3 : 0));
  return addEllipsis ? truncated + '...' : truncated;
}

// ============================
// Error Handling
// ============================

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: any
): {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
} {
  return {
    error: {
      code,
      message,
      details,
      timestamp: getCurrentTimestamp()
    }
  };
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(
  json: string,
  fallback: T
): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Safe JSON stringify with error handling
 */
export function safeJsonStringify(
  obj: any,
  fallback = '{}'
): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return fallback;
  }
}