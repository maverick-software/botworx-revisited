// State Management Module Exports
// Central export point for all state management functionality

export { StateManager } from './state_manager.ts';
export { StateSynchronizer } from './state_synchronizer.ts';
export { StatePersistenceManager } from './state_persistence.ts';
export { StateVersioningManager } from './state_versioning.ts';

// Export interfaces and types
export type {
  StateUpdate,
  UpdateOptions,
  Checkpoint,
  RestoreOptions,
  SyncOptions,
  StateConflict,
  ValidationResult,
} from './state_manager.ts';

export type {
  SyncEvent,
  ConflictResolution,
  SyncResult,
} from './state_synchronizer.ts';

export type {
  PersistenceOptions,
  StorageStats,
  BackupOptions,
} from './state_persistence.ts';

export type {
  StateVersion,
  StateBranch,
  MergeRequest,
  VersionQuery,
  DiffOptions,
} from './state_versioning.ts';