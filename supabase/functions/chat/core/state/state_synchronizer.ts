// State Synchronizer
// Handles real-time state synchronization between agents and sessions

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import {
  AgentState,
  StateChange,
} from '../../types/state.types.ts';
// Generate timestamp utility
function generateTimestamp(): string {
  return new Date().toISOString();
}

// ============================
// Interfaces
// ============================

export interface SyncEvent {
  id: string;
  source_agent_id: string;
  target_agent_ids: string[];
  sync_type: 'manual' | 'automatic' | 'conflict_resolution';
  state_keys: string[];
  changes: StateChange[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  conflicts_detected: number;
  conflicts_resolved: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
  metadata: any;
}

export interface ConflictResolution {
  path: string;
  strategy: 'source_wins' | 'target_wins' | 'merge' | 'manual';
  resolved_value: any;
  confidence: number;
}

export interface SyncOptions {
  conflict_resolution: 'automatic' | 'manual';
  merge_strategy: 'deep' | 'shallow' | 'replace';
  notify_targets: boolean;
  create_checkpoint: boolean;
  timeout_ms: number;
}

export interface SyncResult {
  success: boolean;
  sync_event_id: string;
  targets_synced: number;
  conflicts_detected: number;
  conflicts_resolved: number;
  errors: Array<{
    target_id: string;
    error: string;
  }>;
}

// ============================
// State Synchronizer Implementation
// ============================

export class StateSynchronizer {
  private syncQueue: Map<string, SyncEvent> = new Map();
  private activeSubscriptions: Map<string, EventSource> = new Map();
  
  constructor(private supabase: SupabaseClient) {
    // Start sync queue processor
    this.processSyncQueue();
    
    // Clean up expired subscriptions
    setInterval(() => this.cleanupSubscriptions(), 60000); // Every minute
  }
  
  /**
   * Synchronize state between agents
   */
  async syncState(
    source_agent_id: string,
    target_agent_ids: string[],
    state_keys: string[] = [],
    options: Partial<SyncOptions> = {}
  ): Promise<SyncResult> {
    const syncOptions: SyncOptions = {
      conflict_resolution: 'automatic',
      merge_strategy: 'deep',
      notify_targets: true,
      create_checkpoint: false,
      timeout_ms: 30000,
      ...options,
    };
    
    // Create sync event
    const syncEvent: SyncEvent = {
      id: crypto.randomUUID(),
      source_agent_id,
      target_agent_ids,
      sync_type: 'manual',
      state_keys,
      changes: [],
      status: 'pending',
      conflicts_detected: 0,
      conflicts_resolved: 0,
      started_at: generateTimestamp(),
      metadata: { options: syncOptions },
    };
    
    // Store sync event
    await this.storeSyncEvent(syncEvent);
    
    // Add to processing queue
    this.syncQueue.set(syncEvent.id, syncEvent);
    
    // Wait for completion or timeout
    return this.waitForSyncCompletion(syncEvent.id, syncOptions.timeout_ms);
  }
  
  /**
   * Subscribe to state changes for real-time sync
   */
  async subscribeToStateChanges(
    agent_id: string,
    state_keys: string[],
    callback: (change: StateChangeEvent) => Promise<void>
  ): Promise<string> {
    const subscription_id = crypto.randomUUID();
    
    // Set up Supabase real-time subscription
    const subscription = this.supabase
      .channel(`state_changes_${agent_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_states',
          filter: `agent_id=eq.${agent_id}`,
        },
        async (payload) => {
          try {
            const changeEvent = this.payloadToChangeEvent(payload, state_keys);
            if (changeEvent) {
              await callback(changeEvent);
            }
          } catch (error) {
            console.error('State change callback error:', error);
          }
        }
      )
      .subscribe();
    
    // Store subscription for cleanup
    this.activeSubscriptions.set(subscription_id, subscription as any);
    
    return subscription_id;
  }
  
  /**
   * Unsubscribe from state changes
   */
  async unsubscribe(subscription_id: string): Promise<void> {
    const subscription = this.activeSubscriptions.get(subscription_id);
    if (subscription) {
      await this.supabase.removeChannel(subscription as any);
      this.activeSubscriptions.delete(subscription_id);
    }
  }
  
  /**
   * Detect conflicts between states
   */
  async detectConflicts(
    source_state: AgentState,
    target_state: AgentState,
    state_keys: string[] = []
  ): Promise<StateConflict[]> {
    const conflicts: StateConflict[] = [];
    
    // Focus on shared state for conflicts
    const sourceShared = source_state.shared_state;
    const targetShared = target_state.shared_state;
    
    // If specific keys provided, check only those
    const keysToCheck = state_keys.length > 0 
      ? state_keys 
      : [...new Set([...Object.keys(sourceShared), ...Object.keys(targetShared)])];
    
    for (const key of keysToCheck) {
      const sourceValue = this.getNestedValue(sourceShared, key);
      const targetValue = this.getNestedValue(targetShared, key);
      
      if (!this.deepEqual(sourceValue, targetValue)) {
        conflicts.push({
          path: `shared_state.${key}`,
          source_value: sourceValue,
          target_value: targetValue,
          conflict_type: this.classifyConflict(sourceValue, targetValue),
        });
      }
    }
    
    return conflicts;
  }
  
  /**
   * Resolve conflicts automatically
   */
  async resolveConflicts(
    conflicts: StateConflict[],
    strategy: 'source_wins' | 'target_wins' | 'merge' = 'merge'
  ): Promise<ConflictResolution[]> {
    const resolutions: ConflictResolution[] = [];
    
    for (const conflict of conflicts) {
      let resolved_value: any;
      let confidence = 1.0;
      
      switch (strategy) {
        case 'source_wins':
          resolved_value = conflict.source_value;
          break;
          
        case 'target_wins':
          resolved_value = conflict.target_value;
          break;
          
        case 'merge':
          resolved_value = this.mergeValues(conflict.source_value, conflict.target_value);
          confidence = 0.8; // Lower confidence for merged values
          break;
          

      }
      
      resolutions.push({
        path: conflict.path,
        strategy,
        resolved_value,
        confidence,
      });
    }
    
    return resolutions;
  }
  
  /**
   * Apply sync changes to target state
   */
  async applySyncChanges(
    target_agent_id: string,
    changes: StateChange[],
    resolutions: ConflictResolution[]
  ): Promise<void> {
    // Get current target state
    const { data: currentState, error } = await this.supabase
      .from('agent_states')
      .select('*')
      .eq('agent_id', target_agent_id)
      .eq('is_current', true)
      .single();
    
    if (error || !currentState) {
      throw new Error(`Failed to get current state for agent ${target_agent_id}`);
    }
    
    // Apply changes and resolutions
    const updatedState = { ...currentState };
    
    // Apply conflict resolutions first
    for (const resolution of resolutions) {
      this.setNestedValue(updatedState, resolution.path, resolution.resolved_value);
    }
    
    // Apply other changes
    for (const change of changes) {
      if (!resolutions.some(r => r.path === change.path)) {
        this.applyStateChange(updatedState, change);
      }
    }
    
    // Update modification metadata
    updatedState.modification_count = (updatedState.modification_count || 0) + 1;
    updatedState.last_modified = generateTimestamp();
    updatedState.state_hash = await this.calculateStateHash(updatedState);
    
    // Save updated state
    await this.saveUpdatedState(target_agent_id, updatedState);
  }
  
  /**
   * Get sync event status
   */
  async getSyncStatus(sync_event_id: string): Promise<SyncEvent | null> {
    const { data, error } = await this.supabase
      .from('state_sync_events')
      .select('*')
      .eq('id', sync_event_id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return this.dbRowToSyncEvent(data);
  }
  
  /**
   * Get sync history for an agent
   */
  async getSyncHistory(
    agent_id: string,
    limit: number = 10
  ): Promise<SyncEvent[]> {
    const { data, error } = await this.supabase
      .from('state_sync_events')
      .select('*')
      .or(`source_agent_id.eq.${agent_id},target_agent_id.eq.${agent_id}`)
      .order('started_at', { ascending: false })
      .limit(limit);
    
    if (error || !data) {
      return [];
    }
    
    return data.map(row => this.dbRowToSyncEvent(row));
  }
  
  // ============================
  // Private Methods
  // ============================
  
  private async processSyncQueue(): Promise<void> {
    setInterval(async () => {
      const pendingEvents = Array.from(this.syncQueue.values())
        .filter(event => event.status === 'pending');
      
      for (const event of pendingEvents) {
        try {
          await this.processSyncEvent(event);
        } catch (error) {
          console.error(`Sync event ${event.id} failed:`, error);
          event.status = 'failed';
          event.error_message = error instanceof Error ? error.message : 'Unknown error';
          await this.updateSyncEvent(event);
        }
      }
    }, 1000); // Process every second
  }
  
  private async processSyncEvent(event: SyncEvent): Promise<void> {
    event.status = 'in_progress';
    await this.updateSyncEvent(event);
    
    // Get source state
    const { data: sourceState, error: sourceError } = await this.supabase
      .from('agent_states')
      .select('*')
      .eq('agent_id', event.source_agent_id)
      .eq('is_current', true)
      .single();
    
    if (sourceError || !sourceState) {
      throw new Error(`Source agent ${event.source_agent_id} state not found`);
    }
    
    const errors: Array<{ target_id: string; error: string }> = [];
    let targets_synced = 0;
    
    // Process each target
    for (const target_id of event.target_agent_ids) {
      try {
        await this.syncToTarget(sourceState, target_id, event);
        targets_synced++;
      } catch (error) {
        errors.push({
          target_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    // Update event status
    event.status = errors.length === 0 ? 'completed' : 'failed';
    event.completed_at = generateTimestamp();
    event.metadata = {
      ...event.metadata,
      targets_synced,
      errors,
    };
    
    await this.updateSyncEvent(event);
    
    // Remove from queue
    this.syncQueue.delete(event.id);
  }
  
  private async syncToTarget(
    sourceState: any,
    target_id: string,
    event: SyncEvent
  ): Promise<void> {
    // Get target state
    const { data: targetState, error } = await this.supabase
      .from('agent_states')
      .select('*')
      .eq('agent_id', target_id)
      .eq('is_current', true)
      .single();
    
    if (error || !targetState) {
      throw new Error(`Target agent ${target_id} state not found`);
    }
    
    // Detect conflicts
    const conflicts = await this.detectConflicts(sourceState, targetState, event.state_keys);
    event.conflicts_detected += conflicts.length;
    
    // Resolve conflicts
    const resolutions = await this.resolveConflicts(conflicts);
    event.conflicts_resolved += resolutions.length;
    
    // Build state changes
    const changes = this.buildStateChanges(sourceState, targetState, event.state_keys);
    
    // Apply changes
    await this.applySyncChanges(target_id, changes, resolutions);
  }
  
  private buildStateChanges(
    sourceState: any,
    targetState: any,
    state_keys: string[]
  ): StateChange[] {
    const changes: StateChange[] = [];
    
    // Focus on shared state
    const sourceShared = sourceState.shared_state || {};
    const targetShared = targetState.shared_state || {};
    
    const keysToSync = state_keys.length > 0 
      ? state_keys 
      : Object.keys(sourceShared);
    
    for (const key of keysToSync) {
      const sourceValue = sourceShared[key];
      const targetValue = targetShared[key];
      
      if (!this.deepEqual(sourceValue, targetValue)) {
        changes.push({
          path: `shared_state.${key}`,
          operation: sourceValue === undefined ? 'delete' : 'update',
          previous_value: targetValue,
          new_value: sourceValue,
        });
      }
    }
    
    return changes;
  }
  
  private async storeSyncEvent(event: SyncEvent): Promise<void> {
    const { error } = await this.supabase
      .from('state_sync_events')
      .insert({
        id: event.id,
        source_agent_id: event.source_agent_id,
        target_agent_id: event.target_agent_ids[0], // Simplified for schema
        sync_type: event.sync_type,
        state_keys: event.state_keys,
        conflicts_detected: event.conflicts_detected,
        conflicts_resolved: event.conflicts_resolved,
        status: event.status,
        error_message: event.error_message,
        started_at: event.started_at,
        completed_at: event.completed_at,
        metadata: event.metadata,
      });
    
    if (error) {
      throw new Error(`Failed to store sync event: ${error.message}`);
    }
  }
  
  private async updateSyncEvent(event: SyncEvent): Promise<void> {
    const { error } = await this.supabase
      .from('state_sync_events')
      .update({
        conflicts_detected: event.conflicts_detected,
        conflicts_resolved: event.conflicts_resolved,
        status: event.status,
        error_message: event.error_message,
        completed_at: event.completed_at,
        metadata: event.metadata,
      })
      .eq('id', event.id);
    
    if (error) {
      throw new Error(`Failed to update sync event: ${error.message}`);
    }
  }
  
  private async waitForSyncCompletion(
    sync_event_id: string,
    timeout_ms: number
  ): Promise<SyncResult> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout_ms) {
      const event = await this.getSyncStatus(sync_event_id);
      
      if (!event) {
        throw new Error(`Sync event ${sync_event_id} not found`);
      }
      
      if (event.status === 'completed' || event.status === 'failed') {
        return {
          success: event.status === 'completed',
          sync_event_id,
          targets_synced: event.metadata?.targets_synced || 0,
          conflicts_detected: event.conflicts_detected,
          conflicts_resolved: event.conflicts_resolved,
          errors: event.metadata?.errors || [],
        };
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Sync event ${sync_event_id} timed out`);
  }
  
  private payloadToChangeEvent(
    payload: Record<string, any>,
    state_keys: string[]
  ): StateChangeEvent | null {
    // Convert Supabase payload to state change event
    const newRecord = payload.new;
    const oldRecord = payload.old;
    
    if (!newRecord || !oldRecord) return null;
    
    // Check if any of the watched keys changed
    const hasRelevantChanges = state_keys.length === 0 || state_keys.some(key => {
      const newValue = this.getNestedValue(newRecord, key);
      const oldValue = this.getNestedValue(oldRecord, key);
      return !this.deepEqual(newValue, oldValue);
    });
    
    if (!hasRelevantChanges) return null;
    
    return {
      agent_id: newRecord.agent_id,
      previous: oldRecord,
      current: newRecord,
      changes: this.calculateChanges(oldRecord, newRecord),
      timestamp: generateTimestamp(),
    };
  }
  
  private calculateChanges(oldState: any, newState: any): StateChange[] {
    const changes: StateChange[] = [];
    
    // Compare state partitions
    const partitions = ['local_state', 'shared_state', 'session_state', 'persistent_state'];
    
    for (const partition of partitions) {
      const oldPartition = oldState[partition] || {};
      const newPartition = newState[partition] || {};
      
      this.findChangesInObject(oldPartition, newPartition, partition, changes);
    }
    
    return changes;
  }
  
  private findChangesInObject(
    oldObj: any,
    newObj: any,
    basePath: string,
    changes: StateChange[]
  ): void {
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    
    for (const key of allKeys) {
      const path = `${basePath}.${key}`;
      const oldValue = oldObj[key];
      const newValue = newObj[key];
      
      if (!this.deepEqual(oldValue, newValue)) {
        let operation: 'add' | 'update' | 'delete';
        
        if (newValue === undefined) {
          operation = 'delete';
        } else if (oldValue === undefined) {
          operation = 'add';
        } else {
          operation = 'update';
        }
        
        changes.push({
          path,
          operation,
          previous_value: oldValue,
          new_value: newValue,
        });
      }
    }
  }
  
  private async saveUpdatedState(agent_id: string, state: any): Promise<void> {
    // Mark current state as non-current
    await this.supabase
      .from('agent_states')
      .update({ is_current: false, valid_until: generateTimestamp() })
      .eq('agent_id', agent_id)
      .eq('is_current', true);
    
    // Create new state record
    const newState = {
      ...state,
      id: crypto.randomUUID(),
      valid_from: generateTimestamp(),
      is_current: true,
    };
    
    const { error } = await this.supabase
      .from('agent_states')
      .insert(newState);
    
    if (error) {
      throw new Error(`Failed to save updated state: ${error.message}`);
    }
  }
  
  private applyStateChange(state: any, change: StateChange): void {
    if (change.operation === 'add' || change.operation === 'update') {
      this.setNestedValue(state, change.path, change.new_value);
    } else if (change.operation === 'delete') {
      this.deleteNestedValue(state, change.path);
    }
  }
  
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }
  
  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
  }
  
  private deleteNestedValue(obj: any, path: string): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        return; // Path doesn't exist
      }
      current = current[parts[i]];
    }
    
    delete current[parts[parts.length - 1]];
  }
  
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    
    if (a === null || b === null) return a === b;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false;
      
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) return false;
      
      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.deepEqual(a[key], b[key])) return false;
      }
      
      return true;
    }
    
    return false;
  }
  
  private mergeValues(sourceValue: any, targetValue: any): any {
    if (typeof sourceValue !== 'object' || typeof targetValue !== 'object') {
      // For non-objects, prefer source value
      return sourceValue;
    }
    
    if (Array.isArray(sourceValue) || Array.isArray(targetValue)) {
      // For arrays, combine and deduplicate
      const combined = [...(Array.isArray(sourceValue) ? sourceValue : [sourceValue]),
                        ...(Array.isArray(targetValue) ? targetValue : [targetValue])];
      return [...new Set(combined)];
    }
    
    // For objects, deep merge
    const merged = { ...targetValue };
    
    for (const key in sourceValue) {
      if (sourceValue.hasOwnProperty(key)) {
        if (typeof sourceValue[key] === 'object' && typeof targetValue[key] === 'object') {
          merged[key] = this.mergeValues(sourceValue[key], targetValue[key]);
        } else {
          merged[key] = sourceValue[key];
        }
      }
    }
    
    return merged;
  }
  
  private classifyConflict(sourceValue: any, targetValue: any): 'concurrent_modification' | 'deleted_modified' | 'type_mismatch' {
    if (sourceValue === undefined && targetValue !== undefined) {
      return 'deleted_modified';
    }
    
    if (targetValue === undefined && sourceValue !== undefined) {
      return 'deleted_modified';
    }
    
    if (typeof sourceValue !== typeof targetValue) {
      return 'type_mismatch';
    }
    
    return 'concurrent_modification';
  }
  
  private async calculateStateHash(state: any): Promise<string> {
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
  
  private dbRowToSyncEvent(row: Record<string, any>): SyncEvent {
    return {
      id: row.id,
      source_agent_id: row.source_agent_id,
      target_agent_ids: [row.target_agent_id], // Simplified from array
      sync_type: row.sync_type,
      state_keys: row.state_keys || [],
      changes: [],
      status: row.status,
      conflicts_detected: row.conflicts_detected || 0,
      conflicts_resolved: row.conflicts_resolved || 0,
      error_message: row.error_message,
      started_at: row.started_at,
      completed_at: row.completed_at,
      metadata: row.metadata || {},
    };
  }
  
  private cleanupSubscriptions(): void {
    // Remove any stale subscriptions
    for (const [subscriptionId, subscription] of this.activeSubscriptions) {
      // In a real implementation, check if subscription is still active
      // For now, we'll keep them all
      console.log(`Subscription ${subscriptionId} with ${subscription} is active`);
    }
  }
}

// ============================
// Types
// ============================

interface StateChangeEvent {
  agent_id: string;
  previous: any;
  current: any;
  changes: StateChange[];
  timestamp: string;
}

interface StateConflict {
  path: string;
  source_value: any;
  target_value: any;
  conflict_type: 'concurrent_modification' | 'deleted_modified' | 'type_mismatch';
}