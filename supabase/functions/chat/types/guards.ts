/**
 * Type Guards for Runtime Validation
 * Version: 1.0.0
 * 
 * These guards provide runtime type checking for all major types
 * in the advanced chat system.
 */

import {
  AdvancedChatMessage,
  MessageRole,
  ContentType,
  ChatRequestV2,
  ChatResponseV2
} from './message.types.ts';

import {
  MemoryType,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  WorkingMemory
} from './memory.types.ts';

import {
  AgentState,
  LocalState,
  SharedState,
  SessionState,
  PersistentState
} from './state.types.ts';

import {
  ContextWindow,
  ContextSegment,
  ContextSegmentType,
  CompressionMethod
} from './context.types.ts';

// ============================
// Message Type Guards
// ============================

export function isValidMessageRole(value: any): value is MessageRole {
  return typeof value === 'string' && 
    ['system', 'user', 'assistant', 'tool'].includes(value);
}

export function isValidContentType(value: any): value is ContentType {
  return typeof value === 'string' &&
    ['text', 'structured', 'multimodal', 'tool_result'].includes(value);
}

export function isAdvancedChatMessage(value: any): value is AdvancedChatMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.version === 'string' &&
    isValidMessageRole(value.role) &&
    typeof value.content === 'object' &&
    typeof value.metadata === 'object' &&
    typeof value.context === 'object' &&
    typeof value.timestamp === 'string'
  );
}

export function isChatRequestV2(value: any): value is ChatRequestV2 {
  return (
    typeof value === 'object' &&
    value !== null &&
    value.version === '2.0.0' &&
    typeof value.message === 'object'
  );
}

export function isChatResponseV2(value: any): value is ChatResponseV2 {
  return (
    typeof value === 'object' &&
    value !== null &&
    value.version === '2.0.0' &&
    isAdvancedChatMessage(value.message) &&
    typeof value.metrics === 'object'
  );
}

// ============================
// Memory Type Guards
// ============================

export function isValidMemoryType(value: any): value is MemoryType {
  return typeof value === 'string' &&
    ['episodic', 'semantic', 'procedural', 'working'].includes(value);
}

export function isEpisodicMemory(value: any): value is EpisodicMemory {
  return (
    typeof value === 'object' &&
    value !== null &&
    value.type === 'episodic' &&
    typeof value.id === 'string' &&
    typeof value.content === 'object' &&
    typeof value.temporal === 'object' &&
    typeof value.importance === 'number' &&
    value.importance >= 0 && value.importance <= 1
  );
}

export function isSemanticMemory(value: any): value is SemanticMemory {
  return (
    typeof value === 'object' &&
    value !== null &&
    value.type === 'semantic' &&
    typeof value.id === 'string' &&
    typeof value.content === 'object' &&
    typeof value.source === 'object' &&
    typeof value.confidence === 'number' &&
    value.confidence >= 0 && value.confidence <= 1
  );
}

export function isProceduralMemory(value: any): value is ProceduralMemory {
  return (
    typeof value === 'object' &&
    value !== null &&
    value.type === 'procedural' &&
    typeof value.id === 'string' &&
    typeof value.content === 'object' &&
    typeof value.performance === 'object' &&
    typeof value.optimization === 'object'
  );
}

export function isWorkingMemory(value: any): value is WorkingMemory {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.capacity === 'number' &&
    typeof value.usage === 'number' &&
    Array.isArray(value.items) &&
    Array.isArray(value.priority_queue) &&
    typeof value.compression_enabled === 'boolean'
  );
}

// ============================
// State Type Guards
// ============================

export function isAgentState(value: any): value is AgentState {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.agent_id === 'string' &&
    typeof value.version === 'string' &&
    isLocalState(value.local_state) &&
    isSharedState(value.shared_state) &&
    isSessionState(value.session_state) &&
    isPersistentState(value.persistent_state)
  );
}

export function isLocalState(value: any): value is LocalState {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.preferences === 'object' &&
    Array.isArray(value.learned_patterns) &&
    Array.isArray(value.skill_levels) &&
    Array.isArray(value.error_history) &&
    typeof value.current_context === 'object' &&
    typeof value.conversation_style === 'object'
  );
}

export function isSharedState(value: any): value is SharedState {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.shared_knowledge === 'object' &&
    typeof value.coordination_state === 'object' &&
    typeof value.workspace_context === 'object' &&
    Array.isArray(value.shared_resources) &&
    typeof value.global_settings === 'object'
  );
}

export function isSessionState(value: any): value is SessionState {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.session_id === 'string' &&
    typeof value.started_at === 'string' &&
    typeof value.last_active === 'string' &&
    Array.isArray(value.conversation_history) &&
    Array.isArray(value.active_tools)
  );
}

export function isPersistentState(value: any): value is PersistentState {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray(value.user_relationships) &&
    Array.isArray(value.long_term_goals) &&
    typeof value.accumulated_knowledge === 'object' &&
    typeof value.performance_history === 'object' &&
    typeof value.evolution_track === 'object'
  );
}

// ============================
// Context Type Guards
// ============================

export function isContextWindow(value: any): value is ContextWindow {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.max_tokens === 'number' &&
    typeof value.current_tokens === 'number' &&
    typeof value.compression_ratio === 'number' &&
    Array.isArray(value.segments) &&
    typeof value.priority_scores === 'object'
  );
}

export function isContextSegment(value: any): value is ContextSegment {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    isValidContextSegmentType(value.type) &&
    typeof value.tokens === 'number' &&
    typeof value.priority === 'number' &&
    typeof value.relevance === 'number' &&
    typeof value.compressed === 'boolean'
  );
}

export function isValidContextSegmentType(value: any): value is ContextSegmentType {
  return typeof value === 'string' && [
    'system_instruction',
    'memory',
    'conversation_history',
    'tool_definition',
    'knowledge',
    'state',
    'user_input',
    'workspace_context'
  ].includes(value);
}

export function isValidCompressionMethod(value: any): value is CompressionMethod {
  return typeof value === 'string' && [
    'summary',
    'extraction',
    'encoding',
    'reference',
    'hybrid'
  ].includes(value);
}

// ============================
// Composite Validators
// ============================

export function validateChatRequest(request: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!isChatRequestV2(request)) {
    errors.push('Invalid chat request structure');
  }

  if (request.version !== '2.0.0') {
    errors.push(`Unsupported version: ${request.version}`);
  }

  if (request.message && request.message.role && !isValidMessageRole(request.message.role)) {
    errors.push(`Invalid message role: ${request.message.role}`);
  }

  if (request.options?.memory) {
    const memOpts = request.options.memory;
    if (memOpts.types) {
      for (const type of memOpts.types) {
        if (!isValidMemoryType(type)) {
          errors.push(`Invalid memory type: ${type}`);
        }
      }
    }
    if (typeof memOpts.max_results !== 'number' || memOpts.max_results < 1) {
      errors.push('Invalid max_results in memory options');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateAgentState(state: any): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isAgentState(state)) {
    errors.push('Invalid agent state structure');
    return { valid: false, errors, warnings };
  }

  // Check state consistency
  if (state.modification_count < 0) {
    errors.push('Invalid modification count');
  }

  // Check token usage in session state
  const totalTokens = state.session_state.conversation_history.reduce(
    (sum, turn) => sum + turn.tokens_used, 0
  );
  if (totalTokens > 1000000) {
    warnings.push('High token usage in conversation history');
  }

  // Check checkpoint health
  if (state.checkpoints.length > 100) {
    warnings.push('Large number of checkpoints - consider cleanup');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// ============================
// Utility Type Guards
// ============================

export function isTimestamp(value: any): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return date instanceof Date && !isNaN(date.getTime());
}

export function isUUID(value: any): value is string {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

export function isValidConfidence(value: any): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1;
}

export function isValidPriority(value: any): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1;
}

// ============================
// Deep Validation
// ============================

export class DeepValidator {
  private errors: string[] = [];
  private warnings: string[] = [];
  private path: string[] = [];

  validate(value: any, schema: any): boolean {
    this.errors = [];
    this.warnings = [];
    this.path = [];
    return this.validateValue(value, schema);
  }

  getErrors(): string[] {
    return [...this.errors];
  }

  getWarnings(): string[] {
    return [...this.warnings];
  }

  private validateValue(value: any, schema: any): boolean {
    // Implementation would go here
    // This is a placeholder for a full schema validation system
    return true;
  }

  private addError(message: string): void {
    const fullPath = this.path.join('.');
    this.errors.push(`${fullPath}: ${message}`);
  }

  private addWarning(message: string): void {
    const fullPath = this.path.join('.');
    this.warnings.push(`${fullPath}: ${message}`);
  }
}