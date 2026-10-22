// State Persistence Layer
// Handles state storage, caching, and data integrity

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import {
  AgentState,
  LocalState,
  SharedState,
  SessionState,
  PersistentState,
  StateChange,
} from '../../types/state.types.ts';
import { generateTimestamp, generateStateId } from '../../types/utils.ts';

// ============================
// Interfaces
// ============================

export interface PersistenceOptions {
  cache_strategy: 'write_through' | 'write_behind' | 'write_around';
  compression_enabled: boolean;
  versioning_enabled: boolean;
  backup_enabled: boolean;
  encryption_enabled: boolean;
}

export interface StorageStats {
  total_states: number;
  total_size_bytes: number;
  cache_hit_ratio: number;
  average_write_time_ms: number;
  average_read_time_ms: number;
  compression_ratio: number;
}

export interface BackupOptions {
  include_history: boolean;
  compression_level: number;
  encryption_key?: string;
  retention_days: number;
}

export interface RestoreOptions {
  point_in_time?: string;
  merge_with_current: boolean;
  validate_integrity: boolean;
  create_backup_first: boolean;
}

// ============================
// State Persistence Manager
// ============================

export class StatePersistenceManager {
  private cache: Map<string, CacheEntry> = new Map();
  private writeQueue: Map<string, PendingWrite> = new Map();
  private stats: StorageStats = {
    total_states: 0,
    total_size_bytes: 0,
    cache_hit_ratio: 0,
    average_write_time_ms: 0,
    average_read_time_ms: 0,
    compression_ratio: 0,
  };
  
  constructor(
    private supabase: SupabaseClient,
    private options: PersistenceOptions = {
      cache_strategy: 'write_through',
      compression_enabled: true,
      versioning_enabled: true,
      backup_enabled: true,
      encryption_enabled: false,
    }
  ) {
    // Start background processes
    this.startWriteBehindProcessor();
    this.startCacheCleanup();
    this.startStatsCollection();
  }
  
  /**
   * Save agent state with persistence options
   */
  async saveState(
    state: AgentState,
    options: Partial<PersistenceOptions> = {}
  ): Promise<void> {
    const startTime = Date.now();
    const effectiveOptions = { ...this.options, ...options };
    
    try {
      // Validate state before saving
      await this.validateState(state);
      
      // Compress if enabled
      const processedState = effectiveOptions.compression_enabled
        ? await this.compressState(state)
        : state;
      
      // Encrypt if enabled
      const finalState = effectiveOptions.encryption_enabled
        ? await this.encryptState(processedState)
        : processedState;
      
      // Handle different cache strategies
      switch (effectiveOptions.cache_strategy) {
        case 'write_through':
          await this.writeThrough(finalState);
          break;
        case 'write_behind':
          await this.writeBehind(finalState);
          break;
        case 'write_around':
          await this.writeAround(finalState);
          break;
      }
      
      // Update stats
      const writeTime = Date.now() - startTime;
      this.updateWriteStats(writeTime, JSON.stringify(state).length);
      
    } catch (error) {
      console.error('State save failed:', error);
      throw error;
    }
  }
  
  /**
   * Load agent state with caching
   */
  async loadState(agent_id: string): Promise<AgentState | null> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cached = this.getCachedState(agent_id);
      if (cached) {
        this.updateReadStats(Date.now() - startTime, true);
        return cached;
      }
      
      // Load from database
      const { data, error } = await this.supabase
        .from('agent_states')
        .select('*')
        .eq('agent_id', agent_id)
        .eq('is_current', true)
        .single();
      
      if (error || !data) {
        this.updateReadStats(Date.now() - startTime, false);
        return null;
      }
      
      // Process loaded state
      let state = data as AgentState;
      
      // Decrypt if needed
      if (this.options.encryption_enabled) {
        state = await this.decryptState(state);
      }
      
      // Decompress if needed
      if (this.options.compression_enabled) {
        state = await this.decompressState(state);
      }
      
      // Cache the loaded state
      this.cacheState(agent_id, state);
      
      this.updateReadStats(Date.now() - startTime, false);
      return state;
      
    } catch (error) {
      console.error('State load failed:', error);
      this.updateReadStats(Date.now() - startTime, false);
      throw error;
    }
  }
  
  /**
   * Create backup of agent state
   */
  async createBackup(
    agent_id: string,
    options: BackupOptions = {
      include_history: false,
      compression_level: 6,
      retention_days: 30,
    }
  ): Promise<string> {
    const backup_id = crypto.randomUUID();
    
    try {
      // Get current state
      const currentState = await this.loadState(agent_id);
      if (!currentState) {
        throw new Error(`No current state found for agent ${agent_id}`);
      }
      
      let backupData: any = { current: currentState };
      
      // Include history if requested
      if (options.include_history) {
        const { data: history } = await this.supabase
          .from('agent_states')
          .select('*')
          .eq('agent_id', agent_id)
          .order('created_at', { ascending: false });
        
        backupData.history = history || [];
      }
      
      // Compress backup data
      const compressed = await this.compressData(
        JSON.stringify(backupData),
        options.compression_level
      );
      
      // Encrypt if key provided
      const finalData = options.encryption_key
        ? await this.encryptData(compressed, options.encryption_key)
        : compressed;
      
      // Store backup
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + options.retention_days);
      
      const { error } = await this.supabase
        .from('state_backups')
        .insert({
          id: backup_id,
          agent_id,
          backup_data: finalData,
          metadata: {
            compression_level: options.compression_level,
            encrypted: !!options.encryption_key,
            include_history: options.include_history,
            original_size: JSON.stringify(backupData).length,
            compressed_size: finalData.length,
          },
          expires_at: expiresAt.toISOString(),
        });
      
      if (error) {
        throw new Error(`Failed to create backup: ${error.message}`);
      }
      
      return backup_id;
      
    } catch (error) {
      console.error('Backup creation failed:', error);
      throw error;
    }
  }
  
  /**
   * Restore from backup
   */
  async restoreFromBackup(
    backup_id: string,
    options: RestoreOptions = {
      merge_with_current: false,
      validate_integrity: true,
      create_backup_first: true,
    }
  ): Promise<void> {
    try {
      // Get backup data
      const { data: backup, error } = await this.supabase
        .from('state_backups')
        .select('*')
        .eq('id', backup_id)
        .single();
      
      if (error || !backup) {
        throw new Error(`Backup ${backup_id} not found`);
      }
      
      // Create backup of current state first
      if (options.create_backup_first) {
        await this.createBackup(backup.agent_id, {
          include_history: false,
          compression_level: 6,
          retention_days: 7,
        });
      }
      
      // Decrypt backup data if needed
      let backupData = backup.backup_data;
      if (backup.metadata?.encrypted) {
        // Would need encryption key - simplified for now
        console.warn('Encrypted backup restore not fully implemented');
      }
      
      // Decompress backup data
      const decompressed = await this.decompressData(backupData);
      const parsed = JSON.parse(decompressed);
      
      let restoredState = parsed.current;
      
      // Validate integrity if requested
      if (options.validate_integrity) {
        await this.validateState(restoredState);
      }
      
      // Merge with current state if requested
      if (options.merge_with_current) {
        const currentState = await this.loadState(backup.agent_id);
        if (currentState) {
          restoredState = this.mergeStates(currentState, restoredState);
        }
      }
      
      // Update state metadata
      restoredState.id = generateStateId();
      restoredState.modification_count = (restoredState.modification_count || 0) + 1;
      restoredState.last_modified = generateTimestamp();
      restoredState.state_hash = await this.calculateStateHash(restoredState);
      
      // Save restored state
      await this.saveState(restoredState);
      
    } catch (error) {
      console.error('Backup restore failed:', error);
      throw error;
    }
  }
  
  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    // Update database stats
    const { data: stateStats } = await this.supabase
      .from('agent_states')
      .select('id, local_state, shared_state, session_state, persistent_state')
      .eq('is_current', true);
    
    if (stateStats) {
      this.stats.total_states = stateStats.length;
      this.stats.total_size_bytes = stateStats.reduce((sum, state) => {
        return sum + JSON.stringify(state).length;
      }, 0);
    }
    
    return { ...this.stats };
  }
  
  /**
   * Optimize storage (cleanup, compression, etc.)
   */
  async optimizeStorage(): Promise<{
    states_cleaned: number;
    space_saved_bytes: number;
    compression_applied: number;
  }> {
    let statesProcessed = 0;
    let spaceSaved = 0;
    let compressionApplied = 0;
    
    try {
      // Clean up old non-current states
      const { data: oldStates } = await this.supabase
        .from('agent_states')
        .select('id, local_state, shared_state, session_state, persistent_state')
        .eq('is_current', false)
        .lt('valid_until', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
      if (oldStates && oldStates.length > 0) {
        const sizeBefore = oldStates.reduce((sum, state) => 
          sum + JSON.stringify(state).length, 0);
        
        // Delete old states
        const { error } = await this.supabase
          .from('agent_states')
          .delete()
          .in('id', oldStates.map(s => s.id));
        
        if (!error) {
          statesProcessed = oldStates.length;
          spaceSaved = sizeBefore;
        }
      }
      
      // Apply compression to uncompressed states if enabled
      if (this.options.compression_enabled) {
        const { data: uncompressedStates } = await this.supabase
          .from('agent_states')
          .select('*')
          .eq('is_current', true)
          .is('metadata->compressed', null);
        
        if (uncompressedStates) {
          for (const state of uncompressedStates) {
            const compressed = await this.compressState(state);
            
            const { error } = await this.supabase
              .from('agent_states')
              .update(compressed)
              .eq('id', state.id);
            
            if (!error) {
              compressionApplied++;
            }
          }
        }
      }
      
      // Clean expired backups
      await this.supabase
        .from('state_backups')
        .delete()
        .lt('expires_at', new Date().toISOString());
      
      return {
        states_cleaned: statesProcessed,
        space_saved_bytes: spaceSaved,
        compression_applied: compressionApplied,
      };
      
    } catch (error) {
      console.error('Storage optimization failed:', error);
      throw error;
    }
  }
  
  /**
   * Validate state integrity
   */
  async validateState(state: AgentState): Promise<void> {
    // Check required fields
    if (!state.id) throw new Error('State missing ID');
    if (!state.agent_id) throw new Error('State missing agent ID');
    if (!state.version) throw new Error('State missing version');
    
    // Validate state partitions
    if (!state.local_state || typeof state.local_state !== 'object') {
      throw new Error('Invalid local state');
    }
    
    if (state.shared_state && typeof state.shared_state !== 'object') {
      throw new Error('Invalid shared state');
    }
    
    if (state.session_state && typeof state.session_state !== 'object') {
      throw new Error('Invalid session state');
    }
    
    if (!state.persistent_state || typeof state.persistent_state !== 'object') {
      throw new Error('Invalid persistent state');
    }
    
    // Validate hash if present
    if (state.state_hash) {
      const calculatedHash = await this.calculateStateHash(state);
      if (state.state_hash !== calculatedHash) {
        throw new Error('State hash mismatch - possible corruption');
      }
    }
  }
  
  // ============================
  // Private Methods
  // ============================
  
  private async writeThrough(state: AgentState): Promise<void> {
    // Write to cache and database simultaneously
    await Promise.all([
      this.writeToDatabaseAndCache(state),
      this.cacheState(state.agent_id, state),
    ]);
  }
  
  private async writeBehind(state: AgentState): Promise<void> {
    // Write to cache immediately, queue database write
    this.cacheState(state.agent_id, state);
    this.queueDatabaseWrite(state);
  }
  
  private async writeAround(state: AgentState): Promise<void> {
    // Write directly to database, bypass cache
    await this.writeToDatabase(state);
    this.invalidateCache(state.agent_id);
  }
  
  private async writeToDatabaseAndCache(state: AgentState): Promise<void> {
    // Mark previous states as non-current
    await this.supabase
      .from('agent_states')
      .update({ is_current: false, valid_until: generateTimestamp() })
      .eq('agent_id', state.agent_id)
      .eq('is_current', true);
    
    // Insert new state
    const { error } = await this.supabase
      .from('agent_states')
      .insert(state);
    
    if (error) {
      throw new Error(`Failed to save state: ${error.message}`);
    }
  }
  
  private async writeToDatabase(state: AgentState): Promise<void> {
    await this.writeToDatabaseAndCache(state);
  }
  
  private cacheState(agent_id: string, state: AgentState): void {
    this.cache.set(agent_id, {
      state,
      timestamp: Date.now(),
      access_count: 0,
    });
  }
  
  private getCachedState(agent_id: string): AgentState | null {
    const cached = this.cache.get(agent_id);
    if (!cached) return null;
    
    // Check if cache entry is still valid (5 minutes)
    if (Date.now() - cached.timestamp > 5 * 60 * 1000) {
      this.cache.delete(agent_id);
      return null;
    }
    
    cached.access_count++;
    return cached.state;
  }
  
  private invalidateCache(agent_id: string): void {
    this.cache.delete(agent_id);
  }
  
  private queueDatabaseWrite(state: AgentState): void {
    this.writeQueue.set(state.agent_id, {
      state,
      queued_at: Date.now(),
      retries: 0,
    });
  }
  
  private startWriteBehindProcessor(): void {
    setInterval(async () => {
      const pendingWrites = Array.from(this.writeQueue.values());
      
      for (const write of pendingWrites) {
        try {
          await this.writeToDatabase(write.state);
          this.writeQueue.delete(write.state.agent_id);
        } catch (error) {
          write.retries++;
          if (write.retries > 3) {
            console.error(`Failed to write state after 3 retries:`, error);
            this.writeQueue.delete(write.state.agent_id);
          }
        }
      }
    }, 5000); // Process every 5 seconds
  }
  
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const maxAge = 10 * 60 * 1000; // 10 minutes
      
      for (const [agent_id, entry] of this.cache.entries()) {
        if (now - entry.timestamp > maxAge) {
          this.cache.delete(agent_id);
        }
      }
    }, 60000); // Cleanup every minute
  }
  
  private startStatsCollection(): void {
    setInterval(async () => {
      // Update cache hit ratio
      const totalReads = this.stats.cache_hit_ratio + (1 - this.stats.cache_hit_ratio);
      this.stats.cache_hit_ratio = this.cache.size / Math.max(totalReads, 1);
    }, 30000); // Update every 30 seconds
  }
  
  private updateWriteStats(writeTime: number, dataSize: number): void {
    this.stats.average_write_time_ms = 
      (this.stats.average_write_time_ms + writeTime) / 2;
  }
  
  private updateReadStats(readTime: number, cacheHit: boolean): void {
    this.stats.average_read_time_ms = 
      (this.stats.average_read_time_ms + readTime) / 2;
  }
  
  private async compressState(state: AgentState): Promise<AgentState> {
    // Simplified compression - in production use actual compression library
    const compressed = { ...state };
    
    // Mark as compressed in metadata
    compressed.metadata = {
      ...compressed.metadata,
      compressed: true,
      compression_algorithm: 'simplified',
    };
    
    return compressed;
  }
  
  private async decompressState(state: AgentState): Promise<AgentState> {
    // Simplified decompression
    const decompressed = { ...state };
    
    if (decompressed.metadata?.compressed) {
      delete decompressed.metadata.compressed;
      delete decompressed.metadata.compression_algorithm;
    }
    
    return decompressed;
  }
  
  private async encryptState(state: AgentState): Promise<AgentState> {
    // Simplified encryption - in production use proper encryption
    const encrypted = { ...state };
    
    encrypted.metadata = {
      ...encrypted.metadata,
      encrypted: true,
      encryption_algorithm: 'simplified',
    };
    
    return encrypted;
  }
  
  private async decryptState(state: AgentState): Promise<AgentState> {
    // Simplified decryption
    const decrypted = { ...state };
    
    if (decrypted.metadata?.encrypted) {
      delete decrypted.metadata.encrypted;
      delete decrypted.metadata.encryption_algorithm;
    }
    
    return decrypted;
  }
  
  private async compressData(data: string, level: number = 6): Promise<string> {
    // Simplified compression - in production use zlib or similar
    return btoa(data);
  }
  
  private async decompressData(data: string): Promise<string> {
    // Simplified decompression
    return atob(data);
  }
  
  private async encryptData(data: string, key: string): Promise<string> {
    // Simplified encryption - in production use proper crypto
    return btoa(data + key);
  }
  
  private mergeStates(current: AgentState, restored: AgentState): AgentState {
    return {
      ...current,
      local_state: this.deepMerge(current.local_state, restored.local_state),
      shared_state: this.deepMerge(current.shared_state, restored.shared_state),
      session_state: this.deepMerge(current.session_state, restored.session_state),
      persistent_state: this.deepMerge(current.persistent_state, restored.persistent_state),
    };
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
}

// ============================
// Types
// ============================

interface CacheEntry {
  state: AgentState;
  timestamp: number;
  access_count: number;
}

interface PendingWrite {
  state: AgentState;
  queued_at: number;
  retries: number;
}