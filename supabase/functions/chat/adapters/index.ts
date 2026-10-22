// Adapters Index - Central export point for integration adapters
// V2 Chat System Only - V1 deprecated and removed

export { MessageFormatAdapter, MessageAdapter } from './message_adapter.ts';
export type { FeatureFlags } from './feature_flags.ts';
export { 
  getFeatureFlags, 
  isFeatureEnabled, 
  logFeatureFlags,
  KillSwitch,
  withFeatureFlag
} from './feature_flags.ts';
export {
  DualWriteService,
  ToolCompatibilityWrapper,
  ContextCompatibility,
  MigrationHelper,
  RollbackManager
} from './compatibility_layer.ts';
export {
  RollbackLevel,
  RollbackOrchestrator,
  RollbackMonitor
} from './rollback_procedures.ts';

// Re-export commonly used types
export type { ChatMessage } from '../context_builder.ts';
export type { 
  AdvancedChatMessage,
  MessageRole,
  MessageContent,
  MessageMetadata,
  MessageContext,
  ChatRequestV2
} from '../types/message.types.ts';