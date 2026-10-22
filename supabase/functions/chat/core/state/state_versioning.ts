// State Versioning System
// Handles state version control, branching, and history management

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import {
  AgentState,
  StateChange,
  StateDelta,
} from '../../types/state.types.ts';
import { generateTimestamp, generateStateId } from '../../types/utils.ts';

// ============================
// Interfaces
// ============================

export interface StateVersion {
  version_id: string;
  agent_id: string;
  version_number: number;
  parent_version?: string;
  branch_name: string;
  state_snapshot: AgentState;
  changes: StateChange[];
  commit_message: string;
  author: string;
  created_at: string;
  tags: string[];
  metadata: any;
}

export interface StateBranch {
  branch_id: string;
  agent_id: string;
  branch_name: string;
  base_version: string;
  head_version: string;
  created_at: string;
  created_by: string;
  description?: string;
  is_active: boolean;
  merged_at?: string;
  merged_into?: string;
}

export interface MergeRequest {
  merge_id: string;
  source_branch: string;
  target_branch: string;
  conflicts: StateConflict[];
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  created_by: string;
  created_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  merge_strategy: 'fast_forward' | 'recursive' | 'manual';
}

export interface StateConflict {
  path: string;
  source_value: any;
  target_value: any;
  base_value?: any;
  resolution?: 'source' | 'target' | 'manual' | 'merged';
  resolved_value?: any;
}

export interface VersionQuery {
  agent_id: string;
  branch?: string;
  from_version?: string;
  to_version?: string;
  limit?: number;
  include_changes?: boolean;
}

export interface DiffOptions {
  context_lines: number;
  ignore_whitespace: boolean;
  show_metadata: boolean;
}

// ============================
// State Versioning Manager
// ============================

export class StateVersioningManager {
  constructor(private supabase: SupabaseClient) {}
  
  /**
   * Create a new version (commit) of agent state
   */
  async createVersion(
    agent_id: string,
    state: AgentState,
    commit_message: string,
    author: string,
    branch: string = 'main'
  ): Promise<string> {
    // Get current version for this branch
    const currentVersion = await this.getCurrentVersion(agent_id, branch);
    
    // Calculate changes from previous version
    const changes = currentVersion 
      ? await this.calculateChanges(currentVersion.state_snapshot, state)
      : [];
    
    // Create new version
    const version: StateVersion = {
      version_id: generateStateId(),
      agent_id,
      version_number: (currentVersion?.version_number || 0) + 1,
      parent_version: currentVersion?.version_id,
      branch_name: branch,
      state_snapshot: state,
      changes,
      commit_message,
      author,
      created_at: generateTimestamp(),
      tags: [],
      metadata: {
        state_size: JSON.stringify(state).length,
        change_count: changes.length,
      },
    };
    
    // Store version
    await this.storeVersion(version);
    
    // Update branch head
    await this.updateBranchHead(agent_id, branch, version.version_id);
    
    return version.version_id;
  }
  
  /**
   * Create a new branch from current version
   */
  async createBranch(
    agent_id: string,
    branch_name: string,
    base_version?: string,
    description?: string,
    created_by?: string
  ): Promise<string> {
    // Check if branch already exists
    const existingBranch = await this.getBranch(agent_id, branch_name);
    if (existingBranch) {
      throw new Error(`Branch ${branch_name} already exists`);
    }
    
    // Get base version (default to main branch head)
    const baseVersionId = base_version || await this.getBranchHead(agent_id, 'main');
    if (!baseVersionId) {
      throw new Error('No base version found');
    }
    
    // Create branch
    const branch: StateBranch = {
      branch_id: crypto.randomUUID(),
      agent_id,
      branch_name,
      base_version: baseVersionId,
      head_version: baseVersionId,
      created_at: generateTimestamp(),
      created_by: created_by || 'system',
      description,
      is_active: true,
    };
    
    await this.storeBranch(branch);
    
    return branch.branch_id;
  }
  
  /**
   * Merge one branch into another
   */
  async mergeBranches(
    agent_id: string,
    source_branch: string,
    target_branch: string,
    merge_strategy: 'fast_forward' | 'recursive' | 'manual' = 'recursive',
    author: string
  ): Promise<string> {
    // Get branch heads
    const sourceHead = await this.getBranchHead(agent_id, source_branch);
    const targetHead = await this.getBranchHead(agent_id, target_branch);
    
    if (!sourceHead || !targetHead) {
      throw new Error('Source or target branch not found');
    }
    
    // Get versions
    const sourceVersion = await this.getVersion(sourceHead);
    const targetVersion = await this.getVersion(targetHead);
    
    if (!sourceVersion || !targetVersion) {
      throw new Error('Version not found');
    }
    
    // Detect conflicts
    const conflicts = await this.detectMergeConflicts(sourceVersion, targetVersion);
    
    if (conflicts.length > 0 && merge_strategy !== 'manual') {
      throw new Error(`Merge conflicts detected. ${conflicts.length} conflicts need resolution.`);
    }
    
    // Perform merge based on strategy
    let mergedState: AgentState;
    
    switch (merge_strategy) {
      case 'fast_forward':
        mergedState = sourceVersion.state_snapshot;
        break;
        
      case 'recursive':
        mergedState = await this.performRecursiveMerge(sourceVersion, targetVersion);
        break;
        
      case 'manual':
        throw new Error('Manual merge requires conflict resolution');
    }
    
    // Create merge commit
    const mergeCommit = await this.createVersion(
      agent_id,
      mergedState,
      `Merge ${source_branch} into ${target_branch}`,
      author,
      target_branch
    );
    
    // Update merge metadata
    await this.recordMerge(agent_id, source_branch, target_branch, mergeCommit, conflicts);
    
    return mergeCommit;
  }
  
  /**
   * Get version history for agent/branch
   */
  async getVersionHistory(query: VersionQuery): Promise<StateVersion[]> {
    let dbQuery = this.supabase
      .from('state_versions')
      .select('*')
      .eq('agent_id', query.agent_id);
    
    if (query.branch) {
      dbQuery = dbQuery.eq('branch_name', query.branch);
    }
    
    if (query.from_version) {
      // Get versions after specific version
      const fromVersion = await this.getVersion(query.from_version);
      if (fromVersion) {
        dbQuery = dbQuery.gte('version_number', fromVersion.version_number);
      }
    }
    
    if (query.to_version) {
      // Get versions up to specific version
      const toVersion = await this.getVersion(query.to_version);
      if (toVersion) {
        dbQuery = dbQuery.lte('version_number', toVersion.version_number);
      }
    }
    
    const { data, error } = await dbQuery
      .order('version_number', { ascending: false })
      .limit(query.limit || 50);
    
    if (error) {
      throw new Error(`Failed to get version history: ${error.message}`);
    }
    
    return (data || []).map(row => this.dbRowToVersion(row));
  }
  
  /**
   * Get diff between two versions
   */
  async getDiff(
    version1_id: string,
    version2_id: string,
    options: DiffOptions = {
      context_lines: 3,
      ignore_whitespace: false,
      show_metadata: true,
    }
  ): Promise<StateDiff> {
    const version1 = await this.getVersion(version1_id);
    const version2 = await this.getVersion(version2_id);
    
    if (!version1 || !version2) {
      throw new Error('One or both versions not found');
    }
    
    return this.calculateDiff(version1.state_snapshot, version2.state_snapshot, options);
  }
  
  /**
   * Revert to a previous version
   */
  async revertToVersion(
    agent_id: string,
    version_id: string,
    branch: string,
    author: string,
    commit_message?: string
  ): Promise<string> {
    const targetVersion = await this.getVersion(version_id);
    if (!targetVersion) {
      throw new Error(`Version ${version_id} not found`);
    }
    
    // Create revert commit
    const revertCommit = await this.createVersion(
      agent_id,
      targetVersion.state_snapshot,
      commit_message || `Revert to version ${version_id}`,
      author,
      branch
    );
    
    return revertCommit;
  }
  
  /**
   * Tag a version
   */
  async tagVersion(
    version_id: string,
    tag: string,
    message?: string
  ): Promise<void> {
    const version = await this.getVersion(version_id);
    if (!version) {
      throw new Error(`Version ${version_id} not found`);
    }
    
    // Add tag to version
    const updatedTags = [...version.tags, tag];
    
    const { error } = await this.supabase
      .from('state_versions')
      .update({ 
        tags: updatedTags,
        metadata: {
          ...version.metadata,
          [`tag_${tag}`]: {
            message,
            created_at: generateTimestamp(),
          },
        },
      })
      .eq('version_id', version_id);
    
    if (error) {
      throw new Error(`Failed to tag version: ${error.message}`);
    }
  }
  
  /**
   * Get branches for agent
   */
  async getBranches(agent_id: string): Promise<StateBranch[]> {
    const { data, error } = await this.supabase
      .from('state_branches')
      .select('*')
      .eq('agent_id', agent_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get branches: ${error.message}`);
    }
    
    return (data || []).map(row => this.dbRowToBranch(row));
  }
  
  /**
   * Delete a branch
   */
  async deleteBranch(
    agent_id: string,
    branch_name: string,
    force: boolean = false
  ): Promise<void> {
    if (branch_name === 'main') {
      throw new Error('Cannot delete main branch');
    }
    
    const branch = await this.getBranch(agent_id, branch_name);
    if (!branch) {
      throw new Error(`Branch ${branch_name} not found`);
    }
    
    // Check if branch has unmerged changes
    if (!force) {
      const unmergedCommits = await this.getUnmergedCommits(agent_id, branch_name);
      if (unmergedCommits.length > 0) {
        throw new Error(`Branch has ${unmergedCommits.length} unmerged commits. Use force=true to delete anyway.`);
      }
    }
    
    // Mark branch as inactive
    const { error } = await this.supabase
      .from('state_branches')
      .update({ 
        is_active: false,
        deleted_at: generateTimestamp(),
      })
      .eq('branch_id', branch.branch_id);
    
    if (error) {
      throw new Error(`Failed to delete branch: ${error.message}`);
    }
  }
  
  // ============================
  // Private Methods
  // ============================
  
  private async getCurrentVersion(agent_id: string, branch: string): Promise<StateVersion | null> {
    const { data, error } = await this.supabase
      .from('state_versions')
      .select('*')
      .eq('agent_id', agent_id)
      .eq('branch_name', branch)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return this.dbRowToVersion(data);
  }
  
  private async getBranchHead(agent_id: string, branch: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('state_branches')
      .select('head_version')
      .eq('agent_id', agent_id)
      .eq('branch_name', branch)
      .eq('is_active', true)
      .single();
    
    return data?.head_version || null;
  }
  
  private async getBranch(agent_id: string, branch_name: string): Promise<StateBranch | null> {
    const { data, error } = await this.supabase
      .from('state_branches')
      .select('*')
      .eq('agent_id', agent_id)
      .eq('branch_name', branch_name)
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return this.dbRowToBranch(data);
  }
  
  private async getVersion(version_id: string): Promise<StateVersion | null> {
    const { data, error } = await this.supabase
      .from('state_versions')
      .select('*')
      .eq('version_id', version_id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return this.dbRowToVersion(data);
  }
  
  private async storeVersion(version: StateVersion): Promise<void> {
    const { error } = await this.supabase
      .from('state_versions')
      .insert({
        version_id: version.version_id,
        agent_id: version.agent_id,
        version_number: version.version_number,
        parent_version: version.parent_version,
        branch_name: version.branch_name,
        state_snapshot: version.state_snapshot,
        changes: version.changes,
        commit_message: version.commit_message,
        author: version.author,
        created_at: version.created_at,
        tags: version.tags,
        metadata: version.metadata,
      });
    
    if (error) {
      throw new Error(`Failed to store version: ${error.message}`);
    }
  }
  
  private async storeBranch(branch: StateBranch): Promise<void> {
    const { error } = await this.supabase
      .from('state_branches')
      .insert({
        branch_id: branch.branch_id,
        agent_id: branch.agent_id,
        branch_name: branch.branch_name,
        base_version: branch.base_version,
        head_version: branch.head_version,
        created_at: branch.created_at,
        created_by: branch.created_by,
        description: branch.description,
        is_active: branch.is_active,
      });
    
    if (error) {
      throw new Error(`Failed to store branch: ${error.message}`);
    }
  }
  
  private async updateBranchHead(agent_id: string, branch: string, version_id: string): Promise<void> {
    const { error } = await this.supabase
      .from('state_branches')
      .update({ head_version: version_id })
      .eq('agent_id', agent_id)
      .eq('branch_name', branch)
      .eq('is_active', true);
    
    if (error) {
      throw new Error(`Failed to update branch head: ${error.message}`);
    }
  }
  
  private async calculateChanges(oldState: AgentState, newState: AgentState): Promise<StateChange[]> {
    const changes: StateChange[] = [];
    
    // Compare state partitions
    const partitions = ['local_state', 'shared_state', 'session_state', 'persistent_state'];
    
    for (const partition of partitions) {
      const oldPartition = oldState[partition as keyof AgentState] || {};
      const newPartition = newState[partition as keyof AgentState] || {};
      
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
        let operation: 'set' | 'delete';
        
        if (newValue === undefined) {
          operation = 'delete';
        } else {
          operation = 'set';
        }
        
        changes.push({
          path,
          operation,
          old_value: oldValue,
          new_value: newValue,
          timestamp: generateTimestamp(),
        });
      }
    }
  }
  
  private async detectMergeConflicts(
    sourceVersion: StateVersion,
    targetVersion: StateVersion
  ): Promise<StateConflict[]> {
    const conflicts: StateConflict[] = [];
    
    // Compare shared state (most likely to have conflicts)
    const sourceShared = sourceVersion.state_snapshot.shared_state;
    const targetShared = targetVersion.state_snapshot.shared_state;
    
    this.findConflictsInObject(sourceShared, targetShared, 'shared_state', conflicts);
    
    return conflicts;
  }
  
  private findConflictsInObject(
    sourceObj: any,
    targetObj: any,
    basePath: string,
    conflicts: StateConflict[]
  ): void {
    const allKeys = new Set([...Object.keys(sourceObj || {}), ...Object.keys(targetObj || {})]);
    
    for (const key of allKeys) {
      const path = `${basePath}.${key}`;
      const sourceValue = sourceObj?.[key];
      const targetValue = targetObj?.[key];
      
      if (!this.deepEqual(sourceValue, targetValue)) {
        conflicts.push({
          path,
          source_value: sourceValue,
          target_value: targetValue,
        });
      }
    }
  }
  
  private async performRecursiveMerge(
    sourceVersion: StateVersion,
    targetVersion: StateVersion
  ): Promise<AgentState> {
    const merged = { ...targetVersion.state_snapshot };
    
    // Merge shared state (primary concern for conflicts)
    merged.shared_state = this.deepMerge(
      targetVersion.state_snapshot.shared_state,
      sourceVersion.state_snapshot.shared_state
    );
    
    // Update metadata
    merged.modification_count = Math.max(
      sourceVersion.state_snapshot.modification_count,
      targetVersion.state_snapshot.modification_count
    ) + 1;
    merged.last_modified = generateTimestamp();
    
    return merged;
  }
  
  private calculateDiff(
    state1: AgentState,
    state2: AgentState,
    options: DiffOptions
  ): StateDiff {
    const changes: StateChange[] = [];
    
    // Calculate changes between states
    const partitions = ['local_state', 'shared_state', 'session_state', 'persistent_state'];
    
    for (const partition of partitions) {
      const partition1 = state1[partition as keyof AgentState] || {};
      const partition2 = state2[partition as keyof AgentState] || {};
      
      this.findChangesInObject(partition1, partition2, partition, changes);
    }
    
    return {
      changes,
      additions: changes.filter(c => c.operation === 'set' && c.old_value === undefined).length,
      deletions: changes.filter(c => c.operation === 'delete').length,
      modifications: changes.filter(c => c.operation === 'set' && c.old_value !== undefined).length,
    };
  }
  
  private async recordMerge(
    agent_id: string,
    source_branch: string,
    target_branch: string,
    merge_commit: string,
    conflicts: StateConflict[]
  ): Promise<void> {
    const { error } = await this.supabase
      .from('merge_records')
      .insert({
        agent_id,
        source_branch,
        target_branch,
        merge_commit,
        conflicts_count: conflicts.length,
        conflicts: conflicts,
        merged_at: generateTimestamp(),
      });
    
    if (error) {
      console.error('Failed to record merge:', error);
    }
  }
  
  private async getUnmergedCommits(agent_id: string, branch_name: string): Promise<StateVersion[]> {
    // Get commits in this branch that aren't in main
    const { data, error } = await this.supabase
      .from('state_versions')
      .select('*')
      .eq('agent_id', agent_id)
      .eq('branch_name', branch_name);
    
    if (error || !data) {
      return [];
    }
    
    // This is simplified - in production would do proper merge-base analysis
    return data.map(row => this.dbRowToVersion(row));
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
  
  private dbRowToVersion(row: any): StateVersion {
    return {
      version_id: row.version_id,
      agent_id: row.agent_id,
      version_number: row.version_number,
      parent_version: row.parent_version,
      branch_name: row.branch_name,
      state_snapshot: row.state_snapshot,
      changes: row.changes || [],
      commit_message: row.commit_message,
      author: row.author,
      created_at: row.created_at,
      tags: row.tags || [],
      metadata: row.metadata || {},
    };
  }
  
  private dbRowToBranch(row: any): StateBranch {
    return {
      branch_id: row.branch_id,
      agent_id: row.agent_id,
      branch_name: row.branch_name,
      base_version: row.base_version,
      head_version: row.head_version,
      created_at: row.created_at,
      created_by: row.created_by,
      description: row.description,
      is_active: row.is_active,
      merged_at: row.merged_at,
      merged_into: row.merged_into,
    };
  }
}

// ============================
// Types
// ============================

interface StateDiff {
  changes: StateChange[];
  additions: number;
  deletions: number;
  modifications: number;
}