// State Manager Component
// Handles agent state persistence, synchronization, and recovery

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import {
  AgentState,
  LocalState,
  SharedState,
  SessionState,
  PersistentState,
  StateChange,
  StateDelta,
  CheckpointType,
  StateValidation,
} from '../../types/state.types.ts';
import { generateStateId, generateTimestamp, createStateDelta } from '../../types/utils.ts';
import { StateSynchronizer } from './state_synchronizer.ts';
import { StatePersistenceManager } from './state_persistence.ts';
import { StateVersioningManager } from './state_versioning.ts';

// ============================
// Interfaces
// ============================

export interface StateUpdate {
  local?: Partial<LocalState>;
  shared?: Partial<SharedState>;
  session?: Partial<SessionState>;
  persistent?: Partial<PersistentState>;
  
  // Update metadata
  reason?: string;
  trigger?: string;
}

export interface UpdateOptions {
  merge?: boolean;          // Merge vs replace
  validate?: boolean;       // Validate against schema
  create_checkpoint?: boolean;
  notify_subscribers?: boolean;
}

export interface Checkpoint {
  id: string;
  agent_id: string;
  state_id: string;
  checkpoint_type: CheckpointType;
  description?: string;
  data: any;  // Compressed state data
  metadata: {
    size_bytes: number;
    compression_type: string;
    retention_policy: string;
  };
  created_at: string;
  expires_at?: string;
}

export interface RestoreOptions {
  preserve_current?: boolean;  // Create checkpoint before restore
  merge?: boolean;            // Merge vs replace
  validate?: boolean;         // Validate restored state
}

export interface SyncOptions {
  merge_conflicts?: boolean;
  preserve_local?: boolean;
  notify?: boolean;
}

export interface StateConflict {
  path: string;
  source_value: any;
  target_value: any;
  resolution?: 'source' | 'target' | 'merged';
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  repaired?: boolean;
}

// ============================
// State Manager Implementation
// ============================

export class StateManager {
  private store: StateStore;
  public synchronizer: StateSynchronizer;
  public persistenceManager: StatePersistenceManager;
  public versioningManager: StateVersioningManager;
  private checkpointManager: CheckpointManager;
  private validator: StateValidator;
  private subscribers: Map<string, StateSubscriber[]> = new Map();
  
  constructor(
    private supabase: SupabaseClient,
    private config: {
      auto_checkpoint?: boolean;
      checkpoint_interval?: number;
      max_checkpoints?: number;
      validation_enabled?: boolean;
    }
  ) {
    this.store = new StateStore(supabase);
    this.synchronizer = new StateSynchronizer(supabase);
    this.persistenceManager = new StatePersistenceManager(supabase);
    this.versioningManager = new StateVersioningManager(supabase);
    this.checkpointManager = new CheckpointManager(supabase, this);
    this.validator = new StateValidator();
    
    // Auto-checkpoint timer
    if (config.auto_checkpoint) {
      setInterval(() => this.autoCheckpoint(), config.checkpoint_interval || 3600000); // 1 hour
    }
  }
  
  /**
   * Get current state for an agent
   */
  async get(agent_id: string): Promise<AgentState | null> {
    return this.store.load(agent_id);
  }
  
  /**
   * Update agent state
   */
  async update(
    agent_id: string,
    updates: StateUpdate,
    options: UpdateOptions = {}
  ): Promise<void> {
    // Get current state
    let state = await this.get(agent_id);
    
    if (!state) {
      // Create new state if doesn't exist
      state = this.createDefaultState(agent_id);
    }
    
    // Apply updates
    const previousState = { ...state };
    state = this.applyUpdates(state, updates, options.merge ?? true);
    
    // Update metadata
    state.modification_count++;
    state.last_modified = generateTimestamp();
    state.state_hash = await this.calculateStateHash(state);
    
    // Validate if requested
    if (options.validate ?? this.config.validation_enabled) {
      const validation = await this.validator.validate(state);
      if (!validation.valid) {
        throw new Error(`State validation failed: ${validation.errors.join(', ')}`);
      }
    }
    
    // Create checkpoint if requested
    if (options.create_checkpoint) {
      await this.checkpoint(agent_id, 'manual', {
        description: updates.reason || 'Manual update',
      });
    }
    
    // Save state
    await this.store.save(state);
    
    // Record transition
    await this.recordTransition(previousState, state, updates);
    
    // Notify subscribers
    if (options.notify_subscribers ?? true) {
      await this.notifySubscribers(agent_id, state, previousState);
    }
  }
  
  /**
   * Create a checkpoint
   */
  async checkpoint(
    agent_id: string,
    type: CheckpointType,
    options?: {
      description?: string;
      retention?: 'temporary' | 'permanent' | 'archive';
      expires_in?: number; // milliseconds
    }
  ): Promise<string> {
    const state = await this.get(agent_id);
    if (!state) {
      throw new Error(`No state found for agent ${agent_id}`);
    }
    
    return this.checkpointManager.create(state, type, options);
  }
  
  /**
   * Restore from checkpoint
   */
  async restore(
    agent_id: string,
    checkpoint_id: string,
    options: RestoreOptions = {}
  ): Promise<void> {
    // Preserve current state if requested
    if (options.preserve_current) {
      await this.checkpoint(agent_id, 'error_recovery', {
        description: 'Pre-restore backup',
      });
    }
    
    // Restore checkpoint
    const restored = await this.checkpointManager.restore(checkpoint_id);
    
    // Validate if requested
    if (options.validate ?? this.config.validation_enabled) {
      const validation = await this.validator.validate(restored);
      if (!validation.valid) {
        throw new Error(`Restored state validation failed: ${validation.errors.join(', ')}`);
      }
    }
    
    // Apply to current state
    if (options.merge) {
      const current = await this.get(agent_id);
      if (current) {
        const merged = this.mergeStates(current, restored);
        await this.store.save(merged);
      } else {
        await this.store.save(restored);
      }
    } else {
      await this.store.save(restored);
    }
  }
  
  /**
   * Get specific state partition
   */
  async getLocal(agent_id: string): Promise<LocalState | null> {
    const state = await this.get(agent_id);
    return state?.local_state || null;
  }
  
  async getShared(agent_id: string): Promise<SharedState | null> {
    const state = await this.get(agent_id);
    return state?.shared_state || null;
  }
  
  async getSession(session_id: string): Promise<SessionState | null> {
    // Session states are stored separately
    return this.store.loadSession(session_id);
  }
  
  async getPersistent(agent_id: string): Promise<PersistentState | null> {
    const state = await this.get(agent_id);
    return state?.persistent_state || null;
  }
  
  /**
   * Synchronize state with other agents
   */
  async sync(
    agent_id: string,
    target_ids: string[],
    state_keys: string[] = [],
    options: any = {}
  ): Promise<any> {
    return await this.synchronizer.syncState(agent_id, target_ids, state_keys, options);
  }
  
  /**
   * Create a new version of agent state
   */
  async createVersion(
    agent_id: string,
    commit_message: string,
    author: string,
    branch: string = 'main'
  ): Promise<string> {
    const currentState = await this.get(agent_id);
    if (!currentState) {
      throw new Error(`No current state found for agent ${agent_id}`);
    }
    
    return await this.versioningManager.createVersion(
      agent_id,
      currentState,
      commit_message,
      author,
      branch
    );
  }
  
  /**
   * Create a new branch
   */
  async createBranch(
    agent_id: string,
    branch_name: string,
    base_version?: string,
    description?: string,
    created_by?: string
  ): Promise<string> {
    return await this.versioningManager.createBranch(
      agent_id,
      branch_name,
      base_version,
      description,
      created_by
    );
  }
  
  /**
   * Merge branches
   */
  async mergeBranches(
    agent_id: string,
    source_branch: string,
    target_branch: string,
    author: string,
    merge_strategy: 'fast_forward' | 'recursive' | 'manual' = 'recursive'
  ): Promise<string> {
    return await this.versioningManager.mergeBranches(
      agent_id,
      source_branch,
      target_branch,
      merge_strategy,
      author
    );
  }
  
  /**
   * Get version history
   */
  async getVersionHistory(
    agent_id: string,
    branch?: string,
    limit?: number
  ): Promise<any[]> {
    return await this.versioningManager.getVersionHistory({
      agent_id,
      branch,
      limit,
    });
  }
  
  /**
   * Save state with advanced persistence options
   */
  async saveWithPersistence(
    state: AgentState,
    options: any = {}
  ): Promise<void> {
    return await this.persistenceManager.saveState(state, options);
  }
  
  /**
   * Load state with caching
   */
  async loadWithCaching(agent_id: string): Promise<AgentState | null> {
    return await this.persistenceManager.loadState(agent_id);
  }
  
  /**
   * Create backup
   */
  async createBackup(
    agent_id: string,
    options: any = {}
  ): Promise<string> {
    return await this.persistenceManager.createBackup(agent_id, options);
  }
  
  /**
   * Restore from backup
   */
  async restoreFromBackup(
    backup_id: string,
    options: any = {}
  ): Promise<void> {
    return await this.persistenceManager.restoreFromBackup(backup_id, options);
  }
  
  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<any> {
    return await this.persistenceManager.getStorageStats();
  }
  
  /**
   * Optimize storage
   */
  async optimizeStorage(): Promise<any> {
    return await this.persistenceManager.optimizeStorage();
  }
  
  /**
   * Subscribe to real-time state changes
   */
  async subscribeToStateChanges(
    agent_id: string,
    state_keys: string[],
    callback: (change: any) => Promise<void>
  ): Promise<string> {
    return await this.synchronizer.subscribeToStateChanges(agent_id, state_keys, callback);
  }
  
  /**
   * Unsubscribe from state changes
   */
  async unsubscribeFromStateChanges(subscription_id: string): Promise<void> {
    return await this.synchronizer.unsubscribe(subscription_id);
  }
  
  /**
   * Merge multiple states
   */
  async merge(states: AgentState[]): Promise<AgentState> {
    if (states.length === 0) {
      throw new Error('No states to merge');
    }
    
    if (states.length === 1) {
      return states[0];
    }
    
    // Start with first state as base
    let merged = { ...states[0] };
    
    // Merge remaining states
    for (let i = 1; i < states.length; i++) {
      merged = this.mergeStates(merged, states[i]);
    }
    
    // Update metadata
    merged.id = generateStateId();
    merged.modification_count = states.reduce((sum, s) => sum + s.modification_count, 0);
    merged.last_modified = generateTimestamp();
    merged.state_hash = await this.calculateStateHash(merged);
    
    return merged;
  }
  
  /**
   * Validate state
   */
  async validate(state: AgentState): Promise<ValidationResult> {
    return this.validator.validate(state);
  }
  
  /**
   * Repair corrupted state
   */
  async repair(state: AgentState): Promise<AgentState> {
    const validation = await this.validate(state);
    
    if (validation.valid) {
      return state;
    }
    
    // Attempt repairs
    const repaired = await this.validator.repair(state);
    
    // Re-validate
    const revalidation = await this.validate(repaired);
    if (!revalidation.valid) {
      throw new Error('State could not be repaired');
    }
    
    return repaired;
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(agent_id: string, callback: StateSubscriber): () => void {
    if (!this.subscribers.has(agent_id)) {
      this.subscribers.set(agent_id, []);
    }
    
    this.subscribers.get(agent_id)!.push(callback);
    
    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(agent_id);
      if (subs) {
        const index = subs.indexOf(callback);
        if (index >= 0) {
          subs.splice(index, 1);
        }
      }
    };
  }
  
  // ============================
  // Private Methods
  // ============================
  
  private createDefaultState(agent_id: string): AgentState {
    return {
      id: generateStateId(),
      agent_id,
      version: '1.0.0',
      local_state: {
        preferences: {},
        settings: {},
        flags: {},
        counters: {},
        cache: {},
        custom: {},
      },
      shared_state: {},
      session_state: {},
      persistent_state: {
        knowledge: {},
        learned_patterns: {},
        skill_levels: {},
        achievements: {},
        history_summary: {},
        relationships: {},
      },
      state_hash: '',
      modification_count: 0,
      valid_from: generateTimestamp(),
      is_current: true,
      created_at: generateTimestamp(),
      last_modified: generateTimestamp(),
    };
  }
  
  private applyUpdates(
    state: AgentState,
    updates: StateUpdate,
    merge: boolean
  ): AgentState {
    const updated = { ...state };
    
    if (updates.local) {
      updated.local_state = merge
        ? this.deepMerge(state.local_state, updates.local)
        : { ...state.local_state, ...updates.local };
    }
    
    if (updates.shared) {
      updated.shared_state = merge
        ? this.deepMerge(state.shared_state, updates.shared)
        : { ...state.shared_state, ...updates.shared };
    }
    
    if (updates.session) {
      updated.session_state = merge
        ? this.deepMerge(state.session_state, updates.session)
        : { ...state.session_state, ...updates.session };
    }
    
    if (updates.persistent) {
      updated.persistent_state = merge
        ? this.deepMerge(state.persistent_state, updates.persistent)
        : { ...state.persistent_state, ...updates.persistent };
    }
    
    return updated;
  }
  
  private deepMerge(target: any, source: any): any {
    if (!source) return target;
    if (!target) return source;
    
    if (typeof source !== 'object' || Array.isArray(source)) {
      return source;
    }
    
    const merged = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
          merged[key] = this.deepMerge(target[key], source[key]);
        } else {
          merged[key] = source[key];
        }
      }
    }
    
    return merged;
  }
  
  private mergeStates(state1: AgentState, state2: AgentState): AgentState {
    return {
      ...state1,
      local_state: this.deepMerge(state1.local_state, state2.local_state),
      shared_state: this.deepMerge(state1.shared_state, state2.shared_state),
      session_state: this.deepMerge(state1.session_state, state2.session_state),
      persistent_state: this.deepMerge(state1.persistent_state, state2.persistent_state),
    };
  }
  
  private async calculateStateHash(state: AgentState): Promise<string> {
    const content = JSON.stringify({
      local: state.local_state,
      shared: state.shared_state,
      session: state.session_state,
      persistent: state.persistent_state,
    });
    
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  private async recordTransition(
    from: AgentState,
    to: AgentState,
    update: StateUpdate
  ): Promise<void> {
    const changes = createStateDelta(from, to);
    
    await this.supabase.from('state_transitions').insert({
      agent_id: to.agent_id,
      from_state_id: from.id,
      to_state_id: to.id,
      transition_type: 'update',
      trigger: update.trigger || 'manual',
      changes,
      created_at: generateTimestamp(),
    });
  }
  
  private async notifySubscribers(
    agent_id: string,
    newState: AgentState,
    previousState: AgentState
  ): Promise<void> {
    const subscribers = this.subscribers.get(agent_id) || [];
    
    const event: StateChangeEvent = {
      agent_id,
      previous: previousState,
      current: newState,
      changes: createStateDelta(previousState, newState),
      timestamp: generateTimestamp(),
    };
    
    await Promise.all(
      subscribers.map(sub => sub(event).catch(err => 
        console.error('Subscriber error:', err)
      ))
    );
  }
  
  private async autoCheckpoint(): Promise<void> {
    // Get all agents with states
    const { data: agents } = await this.supabase
      .from('agent_states')
      .select('agent_id')
      .eq('is_current', true);
    
    if (!agents) return;
    
    for (const { agent_id } of agents) {
      try {
        await this.checkpoint(agent_id, 'automatic', {
          description: 'Scheduled checkpoint',
          retention: 'temporary',
          expires_in: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
      } catch (err) {
        console.error(`Auto-checkpoint failed for agent ${agent_id}:`, err);
      }
    }
  }
}

// ============================
// State Store
// ============================

class StateStore {
  constructor(private supabase: SupabaseClient) {}
  
  async save(state: AgentState): Promise<void> {
    // Mark previous states as non-current
    await this.supabase
      .from('agent_states')
      .update({ is_current: false, valid_until: generateTimestamp() })
      .eq('agent_id', state.agent_id)
      .eq('is_current', true);
    
    // Save new state
    const { error } = await this.supabase
      .from('agent_states')
      .insert(state);
    
    if (error) {
      throw new Error(`Failed to save state: ${error.message}`);
    }
  }
  
  async load(agent_id: string): Promise<AgentState | null> {
    const { data, error } = await this.supabase
      .from('agent_states')
      .select('*')
      .eq('agent_id', agent_id)
      .eq('is_current', true)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data as AgentState;
  }
  
  async loadSession(session_id: string): Promise<SessionState | null> {
    const { data, error } = await this.supabase
      .from('conversation_sessions')
      .select('session_state')
      .eq('id', session_id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data.session_state as SessionState;
  }
}

// ============================
// State Synchronizer
// ============================

class StateSynchronizer {
  constructor(private stateManager: StateManager) {}
  
  async sync(
    source: AgentState,
    target_ids: string[],
    options: SyncOptions
  ): Promise<void> {
    // Get target states
    const targetStates = await Promise.all(
      target_ids.map(id => this.stateManager.get(id))
    );
    
    // Process each target
    for (let i = 0; i < target_ids.length; i++) {
      const targetId = target_ids[i];
      const targetState = targetStates[i];
      
      if (!targetState) {
        console.warn(`No state found for target agent ${targetId}`);
        continue;
      }
      
      // Detect conflicts
      const conflicts = this.detectConflicts(source, targetState);
      
      // Resolve conflicts
      const resolved = await this.resolveConflicts(conflicts, options);
      
      // Apply sync
      await this.applySyncToTarget(targetId, source, targetState, resolved, options);
    }
  }
  
  private detectConflicts(
    source: AgentState,
    target: AgentState
  ): StateConflict[] {
    const conflicts: StateConflict[] = [];
    
    // Only check shared state for conflicts
    this.findConflicts(
      source.shared_state,
      target.shared_state,
      'shared_state',
      conflicts
    );
    
    return conflicts;
  }
  
  private findConflicts(
    source: any,
    target: any,
    path: string,
    conflicts: StateConflict[]
  ): void {
    if (source === target) return;
    
    if (typeof source !== 'object' || typeof target !== 'object') {
      conflicts.push({
        path,
        source_value: source,
        target_value: target,
      });
      return;
    }
    
    // Check all keys
    const allKeys = new Set([
      ...Object.keys(source || {}),
      ...Object.keys(target || {}),
    ]);
    
    for (const key of allKeys) {
      const sourceval = source?.[key];
      const targetVal = target?.[key];
      
      if (sourceval !== targetVal) {
        this.findConflicts(
          sourceval,
          targetVal,
          `${path}.${key}`,
          conflicts
        );
      }
    }
  }
  
  private async resolveConflicts(
    conflicts: StateConflict[],
    options: SyncOptions
  ): Promise<StateConflict[]> {
    return conflicts.map(conflict => ({
      ...conflict,
      resolution: options.preserve_local ? 'target' : 'source',
    }));
  }
  
  private async applySyncToTarget(
    targetId: string,
    source: AgentState,
    target: AgentState,
    conflicts: StateConflict[],
    options: SyncOptions
  ): Promise<void> {
    // Build update based on resolved conflicts
    const update: StateUpdate = {
      shared: this.buildSharedUpdate(source, target, conflicts),
      trigger: 'sync',
      reason: `Sync from agent ${source.agent_id}`,
    };
    
    await this.stateManager.update(targetId, update, {
      merge: options.merge_conflicts ?? true,
      notify_subscribers: options.notify ?? true,
    });
  }
  
  private buildSharedUpdate(
    source: AgentState,
    target: AgentState,
    conflicts: StateConflict[]
  ): Partial<SharedState> {
    const update = { ...source.shared_state };
    
    // Apply conflict resolutions
    for (const conflict of conflicts) {
      if (conflict.resolution === 'target' && conflict.path.startsWith('shared_state.')) {
        // Keep target value
        const path = conflict.path.substring('shared_state.'.length);
        this.setValueAtPath(update, path, conflict.target_value);
      }
    }
    
    return update;
  }
  
  private setValueAtPath(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
  }
}

// ============================
// Checkpoint Manager
// ============================

class CheckpointManager {
  constructor(
    private supabase: SupabaseClient,
    private stateManager: StateManager
  ) {}
  
  async create(
    state: AgentState,
    type: CheckpointType,
    options?: {
      description?: string;
      retention?: 'temporary' | 'permanent' | 'archive';
      expires_in?: number;
    }
  ): Promise<string> {
    // Compress state data
    const compressed = await this.compress(state);
    
    const checkpoint: Checkpoint = {
      id: crypto.randomUUID(),
      agent_id: state.agent_id,
      state_id: state.id,
      checkpoint_type: type,
      description: options?.description,
      data: compressed.data,
      metadata: {
        size_bytes: compressed.size,
        compression_type: 'gzip',
        retention_policy: options?.retention || 'permanent',
      },
      created_at: generateTimestamp(),
      expires_at: options?.expires_in
        ? new Date(Date.now() + options.expires_in).toISOString()
        : undefined,
    };
    
    // Store checkpoint
    const { error } = await this.supabase
      .from('state_checkpoints')
      .insert(checkpoint);
    
    if (error) {
      throw new Error(`Failed to create checkpoint: ${error.message}`);
    }
    
    // Clean old checkpoints if needed
    await this.cleanOldCheckpoints(state.agent_id);
    
    return checkpoint.id;
  }
  
  async restore(checkpoint_id: string): Promise<AgentState> {
    // Load checkpoint
    const { data, error } = await this.supabase
      .from('state_checkpoints')
      .select('*')
      .eq('id', checkpoint_id)
      .single();
    
    if (error || !data) {
      throw new Error(`Checkpoint not found: ${checkpoint_id}`);
    }
    
    const checkpoint = data as Checkpoint;
    
    // Decompress state
    const state = await this.decompress(checkpoint.data);
    
    // Update restoration metrics
    await this.supabase
      .from('state_checkpoints')
      .update({
        'metadata->restoration_count': (checkpoint.metadata as any).restoration_count + 1,
        'metadata->last_restored': generateTimestamp(),
      })
      .eq('id', checkpoint_id);
    
    return state;
  }
  
  private async compress(state: AgentState): Promise<{ data: string; size: number }> {
    const json = JSON.stringify(state);
    const encoder = new TextEncoder();
    const data = encoder.encode(json);
    
    // In production, use actual compression
    // For now, just base64 encode
    const compressed = btoa(String.fromCharCode(...data));
    
    return {
      data: compressed,
      size: compressed.length,
    };
  }
  
  private async decompress(data: string): Promise<AgentState> {
    // In production, use actual decompression
    // For now, just base64 decode
    const decoded = atob(data);
    const json = decoded;
    
    return JSON.parse(json);
  }
  
  private async cleanOldCheckpoints(agent_id: string): Promise<void> {
    const maxCheckpoints = this.stateManager['config'].max_checkpoints || 10;
    
    // Get checkpoint count
    const { count } = await this.supabase
      .from('state_checkpoints')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent_id)
      .eq('metadata->retention_policy', 'temporary');
    
    if (count && count > maxCheckpoints) {
      // Delete oldest temporary checkpoints
      const { data: oldCheckpoints } = await this.supabase
        .from('state_checkpoints')
        .select('id')
        .eq('agent_id', agent_id)
        .eq('metadata->retention_policy', 'temporary')
        .order('created_at', { ascending: true })
        .limit(count - maxCheckpoints);
      
      if (oldCheckpoints) {
        const ids = oldCheckpoints.map(c => c.id);
        await this.supabase
          .from('state_checkpoints')
          .delete()
          .in('id', ids);
      }
    }
  }
}

// ============================
// State Validator
// ============================

class StateValidator {
  async validate(state: AgentState): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields
    if (!state.id) errors.push('Missing state ID');
    if (!state.agent_id) errors.push('Missing agent ID');
    if (!state.version) errors.push('Missing version');
    
    // State structure
    if (!state.local_state) errors.push('Missing local state');
    if (!state.persistent_state) errors.push('Missing persistent state');
    
    // State hash
    const calculatedHash = await this.calculateHash(state);
    if (state.state_hash && state.state_hash !== calculatedHash) {
      warnings.push('State hash mismatch - possible corruption');
    }
    
    // Size limits
    const stateSize = JSON.stringify(state).length;
    if (stateSize > 1024 * 1024) { // 1MB limit
      warnings.push(`State size (${stateSize} bytes) exceeds recommended limit`);
    }
    
    // Type validations
    this.validateLocalState(state.local_state, errors, warnings);
    this.validateSharedState(state.shared_state, errors, warnings);
    this.validateSessionState(state.session_state, errors, warnings);
    this.validatePersistentState(state.persistent_state, errors, warnings);
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  async repair(state: AgentState): Promise<AgentState> {
    const repaired = { ...state };
    
    // Fix missing required fields
    if (!repaired.id) repaired.id = generateStateId();
    if (!repaired.version) repaired.version = '1.0.0';
    if (!repaired.state_hash) {
      repaired.state_hash = await this.calculateHash(repaired);
    }
    
    // Fix missing state partitions
    if (!repaired.local_state) {
      repaired.local_state = {
        preferences: {},
        settings: {},
        flags: {},
        counters: {},
        cache: {},
        custom: {},
      };
    }
    
    if (!repaired.shared_state) {
      repaired.shared_state = {};
    }
    
    if (!repaired.session_state) {
      repaired.session_state = {};
    }
    
    if (!repaired.persistent_state) {
      repaired.persistent_state = {
        knowledge: {},
        learned_patterns: {},
        skill_levels: {},
        achievements: {},
        history_summary: {},
        relationships: {},
      };
    }
    
    // Fix timestamps
    if (!repaired.created_at) {
      repaired.created_at = generateTimestamp();
    }
    
    if (!repaired.last_modified) {
      repaired.last_modified = generateTimestamp();
    }
    
    return repaired;
  }
  
  private validateLocalState(
    state: LocalState,
    errors: string[],
    warnings: string[]
  ): void {
    if (!state.preferences || typeof state.preferences !== 'object') {
      errors.push('Invalid local state preferences');
    }
    
    if (!state.settings || typeof state.settings !== 'object') {
      errors.push('Invalid local state settings');
    }
    
    // Check for oversized cache
    if (state.cache) {
      const cacheSize = JSON.stringify(state.cache).length;
      if (cacheSize > 100 * 1024) { // 100KB
        warnings.push('Local cache is large - consider cleanup');
      }
    }
  }
  
  private validateSharedState(
    state: SharedState,
    errors: string[],
    warnings: string[]
  ): void {
    // Shared state is flexible, just check it's an object
    if (state && typeof state !== 'object') {
      errors.push('Shared state must be an object');
    }
  }
  
  private validateSessionState(
    state: SessionState,
    errors: string[],
    warnings: string[]
  ): void {
    // Session state is flexible, just check it's an object
    if (state && typeof state !== 'object') {
      errors.push('Session state must be an object');
    }
  }
  
  private validatePersistentState(
    state: PersistentState,
    errors: string[],
    warnings: string[]
  ): void {
    if (!state.knowledge || typeof state.knowledge !== 'object') {
      errors.push('Invalid persistent state knowledge');
    }
    
    if (!state.learned_patterns || typeof state.learned_patterns !== 'object') {
      errors.push('Invalid persistent state learned patterns');
    }
    
    if (!state.skill_levels || typeof state.skill_levels !== 'object') {
      errors.push('Invalid persistent state skill levels');
    }
  }
  
  private async calculateHash(state: AgentState): Promise<string> {
    const content = JSON.stringify({
      local: state.local_state,
      shared: state.shared_state,
      session: state.session_state,
      persistent: state.persistent_state,
    });
    
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// ============================
// Types
// ============================

type StateSubscriber = (event: StateChangeEvent) => Promise<void>;

interface StateChangeEvent {
  agent_id: string;
  previous: AgentState;
  current: AgentState;
  changes: StateChange[];
  timestamp: string;
}