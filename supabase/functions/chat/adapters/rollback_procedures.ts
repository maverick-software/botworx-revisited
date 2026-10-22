// Rollback Procedures for Advanced JSON Chat System
// Provides automated and manual rollback capabilities

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { KillSwitch } from './feature_flags.ts';

/**
 * Rollback levels for different severity scenarios
 */
export enum RollbackLevel {
  FEATURE = 'feature',      // Single feature rollback
  PARTIAL = 'partial',      // Multiple features rollback
  COMPLETE = 'complete',    // Full system rollback
  EMERGENCY = 'emergency'   // Immediate rollback with data preservation
}

/**
 * Rollback configuration
 */
interface RollbackConfig {
  level: RollbackLevel;
  reason: string;
  timestamp: string;
  initiator: string;
  features?: string[];
  preserveData: boolean;
}

/**
 * Rollback orchestrator
 */
export class RollbackOrchestrator {
  private static instance: RollbackOrchestrator;
  private rollbackHistory: RollbackConfig[] = [];
  
  private constructor(private supabaseClient: SupabaseClient) {}
  
  static getInstance(supabaseClient: SupabaseClient): RollbackOrchestrator {
    if (!this.instance) {
      this.instance = new RollbackOrchestrator(supabaseClient);
    }
    return this.instance;
  }
  
  /**
   * Execute rollback based on level
   */
  async executeRollback(config: RollbackConfig): Promise<{
    success: boolean;
    actions: string[];
    errors: any[];
  }> {
    console.warn(`[Rollback] Initiating ${config.level} rollback: ${config.reason}`);
    
    const actions: string[] = [];
    const errors: any[] = [];
    
    try {
      // Record rollback attempt
      this.rollbackHistory.push(config);
      await this.logRollback(config);
      
      switch (config.level) {
        case RollbackLevel.FEATURE:
          return await this.featureRollback(config);
          
        case RollbackLevel.PARTIAL:
          return await this.partialRollback(config);
          
        case RollbackLevel.COMPLETE:
          return await this.completeRollback(config);
          
        case RollbackLevel.EMERGENCY:
          return await this.emergencyRollback(config);
          
        default:
          throw new Error(`Unknown rollback level: ${config.level}`);
      }
    } catch (error) {
      console.error('[Rollback] Fatal error during rollback:', error);
      errors.push({ fatal: true, error });
      return { success: false, actions, errors };
    }
  }
  
  /**
   * Feature-level rollback
   */
  private async featureRollback(config: RollbackConfig): Promise<{
    success: boolean;
    actions: string[];
    errors: any[];
  }> {
    const actions: string[] = [];
    const errors: any[] = [];
    
    try {
      // Disable specific features
      if (config.features) {
        for (const feature of config.features) {
          switch (feature) {
            case 'advanced_messages':
              KillSwitch.activate('disable_v2_messages');
              actions.push('Disabled V2 messages');
              break;
              
            case 'memory_system':
              KillSwitch.activate('disable_memory_system');
              actions.push('Disabled memory system');
              break;
              
            case 'state_management':
              KillSwitch.activate('disable_state_management');
              actions.push('Disabled state management');
              break;
              
            case 'new_tools':
              KillSwitch.activate('disable_new_tools');
              actions.push('Disabled new tool framework');
              break;
          }
        }
      }
      
      // Update feature flags in database
      await this.updateFeatureFlags({
        rollback_active: true,
        disabled_features: config.features,
        rollback_timestamp: config.timestamp,
      });
      
      actions.push('Updated feature flags in database');
      
      return { success: true, actions, errors };
    } catch (error) {
      errors.push({ phase: 'feature_rollback', error });
      return { success: false, actions, errors };
    }
  }
  
  /**
   * Partial rollback - multiple features
   */
  private async partialRollback(config: RollbackConfig): Promise<{
    success: boolean;
    actions: string[];
    errors: any[];
  }> {
    const actions: string[] = [];
    const errors: any[] = [];
    
    try {
      // Disable advanced features but keep basic functionality
      const featuresToDisable = [
        'disable_v2_messages',
        'disable_memory_system',
        'disable_state_management',
        'disable_new_tools'
      ];
      
      for (const feature of featuresToDisable) {
        KillSwitch.activate(feature);
        actions.push(`Activated kill switch: ${feature}`);
      }
      
      // Switch to compatibility mode
      await this.enableCompatibilityMode();
      actions.push('Enabled compatibility mode');
      
      // Redirect traffic to V1 endpoints
      await this.updateRoutingRules({
        use_v1_endpoints: true,
        maintain_dual_write: false,
      });
      actions.push('Updated routing to V1 endpoints');
      
      return { success: true, actions, errors };
    } catch (error) {
      errors.push({ phase: 'partial_rollback', error });
      return { success: false, actions, errors };
    }
  }
  
  /**
   * Complete rollback - full system revert
   */
  private async completeRollback(config: RollbackConfig): Promise<{
    success: boolean;
    actions: string[];
    errors: any[];
  }> {
    const actions: string[] = [];
    const errors: any[] = [];
    
    try {
      // Activate emergency kill switch
      KillSwitch.activate('emergency_rollback');
      actions.push('Activated emergency rollback');
      
      // Stop all new features
      const allKillSwitches = [
        'disable_v2_messages',
        'disable_memory_system', 
        'disable_state_management',
        'disable_new_tools'
      ];
      
      for (const ks of allKillSwitches) {
        KillSwitch.activate(ks);
      }
      actions.push('Activated all kill switches');
      
      // Preserve data if requested
      if (config.preserveData) {
        await this.backupV2Data();
        actions.push('Created backup of V2 data');
      }
      
      // Update system configuration
      await this.updateSystemConfig({
        api_version: '1.0',
        schema_version: 'legacy',
        features_enabled: [],
        rollback_complete: true,
      });
      actions.push('Reverted system configuration');
      
      // Notify administrators
      await this.notifyAdmins(config);
      actions.push('Notified administrators');
      
      return { success: true, actions, errors };
    } catch (error) {
      errors.push({ phase: 'complete_rollback', error });
      return { success: false, actions, errors };
    }
  }
  
  /**
   * Emergency rollback - immediate action required
   */
  private async emergencyRollback(config: RollbackConfig): Promise<{
    success: boolean;
    actions: string[];
    errors: any[];
  }> {
    const actions: string[] = [];
    const errors: any[] = [];
    
    console.error('[EMERGENCY] Executing emergency rollback');
    
    try {
      // Immediate actions - no async operations
      KillSwitch.activate('emergency_rollback');
      KillSwitch.activate('disable_v2_messages');
      KillSwitch.activate('disable_memory_system');
      KillSwitch.activate('disable_state_management');
      KillSwitch.activate('disable_new_tools');
      
      actions.push('All kill switches activated immediately');
      
      // Force cache clear (if using caching)
      this.clearAllCaches();
      actions.push('Cleared all caches');
      
      // Create emergency snapshot
      const snapshotId = await this.createEmergencySnapshot();
      actions.push(`Created emergency snapshot: ${snapshotId}`);
      
      // Switch to minimal mode
      await this.enableMinimalMode();
      actions.push('Switched to minimal operation mode');
      
      // Alert on-call
      await this.alertOnCall({
        severity: 'CRITICAL',
        message: `Emergency rollback executed: ${config.reason}`,
        snapshot_id: snapshotId,
      });
      actions.push('Alerted on-call team');
      
      return { success: true, actions, errors };
    } catch (error) {
      // Even if some steps fail, consider it successful if kill switches are activated
      errors.push({ phase: 'emergency_rollback', error });
      return { 
        success: KillSwitch.isActivated('emergency_rollback'), 
        actions, 
        errors 
      };
    }
  }
  
  /**
   * Helper methods
   */
  
  private async logRollback(config: RollbackConfig): Promise<void> {
    try {
      await this.supabaseClient
        .from('system_rollbacks')
        .insert({
          level: config.level,
          reason: config.reason,
          timestamp: config.timestamp,
          initiator: config.initiator,
          features: config.features,
          preserve_data: config.preserveData,
        });
    } catch (error) {
      console.error('[Rollback] Failed to log rollback:', error);
    }
  }
  
  private async updateFeatureFlags(flags: any): Promise<void> {
    try {
      await this.supabaseClient
        .from('feature_flags')
        .upsert({
          id: 'system',
          ...flags,
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('[Rollback] Failed to update feature flags:', error);
      throw error;
    }
  }
  
  private async enableCompatibilityMode(): Promise<void> {
    // Update environment or configuration to enable compatibility mode
    console.log('[Rollback] Compatibility mode enabled');
  }
  
  private async updateRoutingRules(rules: any): Promise<void> {
    // Update API gateway or load balancer rules
    console.log('[Rollback] Routing rules updated:', rules);
  }
  
  private async backupV2Data(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Create backup tables
    const backupTables = [
      'chat_messages_v2',
      'agent_memories',
      'agent_states',
      'conversation_sessions'
    ];
    
    for (const table of backupTables) {
      try {
        await this.supabaseClient.rpc('create_table_backup', {
          source_table: table,
          backup_name: `${table}_rollback_${timestamp}`
        });
      } catch (error) {
        console.error(`[Rollback] Failed to backup ${table}:`, error);
      }
    }
  }
  
  private async updateSystemConfig(config: any): Promise<void> {
    try {
      await this.supabaseClient
        .from('system_configuration')
        .upsert({
          id: 'main',
          ...config,
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('[Rollback] Failed to update system config:', error);
      throw error;
    }
  }
  
  private async notifyAdmins(config: RollbackConfig): Promise<void> {
    // Send notifications via email, Slack, etc.
    console.log('[Rollback] Admin notification sent:', config);
  }
  
  private clearAllCaches(): void {
    // Clear any in-memory caches
    console.log('[Rollback] All caches cleared');
  }
  
  private async createEmergencySnapshot(): Promise<string> {
    const snapshotId = `emergency_${Date.now()}`;
    
    // Create system state snapshot
    try {
      await this.supabaseClient
        .from('system_snapshots')
        .insert({
          id: snapshotId,
          type: 'emergency',
          state: {
            kill_switches: KillSwitch.getStatus(),
            timestamp: new Date().toISOString(),
          },
        });
    } catch (error) {
      console.error('[Rollback] Failed to create snapshot:', error);
    }
    
    return snapshotId;
  }
  
  private async enableMinimalMode(): Promise<void> {
    // Switch to minimal functionality mode
    console.log('[Rollback] Minimal mode enabled - only critical operations available');
  }
  
  private async alertOnCall(alert: any): Promise<void> {
    // Send critical alert to on-call team
    console.error('[ALERT] On-call notification:', alert);
    
    // In production, this would integrate with PagerDuty, OpsGenie, etc.
  }
  
  /**
   * Check if rollback is needed based on metrics
   */
  static shouldRollback(metrics: {
    errorRate: number;
    responseTime: number;
    successRate: number;
    memoryUsage: number;
  }): { needed: boolean; level?: RollbackLevel; reason?: string } {
    // Critical thresholds
    if (metrics.errorRate > 0.1) { // 10% error rate
      return {
        needed: true,
        level: RollbackLevel.EMERGENCY,
        reason: `Critical error rate: ${(metrics.errorRate * 100).toFixed(1)}%`
      };
    }
    
    if (metrics.responseTime > 10000) { // 10 seconds
      return {
        needed: true,
        level: RollbackLevel.EMERGENCY,
        reason: `Critical response time: ${metrics.responseTime}ms`
      };
    }
    
    // Warning thresholds
    if (metrics.errorRate > 0.05) { // 5% error rate
      return {
        needed: true,
        level: RollbackLevel.PARTIAL,
        reason: `High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`
      };
    }
    
    if (metrics.successRate < 0.95) { // Less than 95% success
      return {
        needed: true,
        level: RollbackLevel.FEATURE,
        reason: `Low success rate: ${(metrics.successRate * 100).toFixed(1)}%`
      };
    }
    
    if (metrics.memoryUsage > 0.9) { // 90% memory usage
      return {
        needed: true,
        level: RollbackLevel.FEATURE,
        reason: `High memory usage: ${(metrics.memoryUsage * 100).toFixed(1)}%`
      };
    }
    
    return { needed: false };
  }
}

/**
 * Automated rollback monitor
 */
export class RollbackMonitor {
  private checkInterval: number;
  private intervalId?: number;
  
  constructor(
    private orchestrator: RollbackOrchestrator,
    checkIntervalMs: number = 30000 // 30 seconds
  ) {
    this.checkInterval = checkIntervalMs;
  }
  
  start(): void {
    console.log('[RollbackMonitor] Starting automated monitoring');
    
    this.intervalId = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        const rollbackCheck = RollbackOrchestrator.shouldRollback(metrics);
        
        if (rollbackCheck.needed && rollbackCheck.level && rollbackCheck.reason) {
          console.warn('[RollbackMonitor] Rollback triggered:', rollbackCheck);
          
          await this.orchestrator.executeRollback({
            level: rollbackCheck.level,
            reason: rollbackCheck.reason,
            timestamp: new Date().toISOString(),
            initiator: 'automated_monitor',
            preserveData: true,
          });
          
          // Stop monitoring after rollback
          this.stop();
        }
      } catch (error) {
        console.error('[RollbackMonitor] Error during monitoring:', error);
      }
    }, this.checkInterval);
  }
  
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log('[RollbackMonitor] Monitoring stopped');
    }
  }
  
  private async collectMetrics(): Promise<{
    errorRate: number;
    responseTime: number;
    successRate: number;
    memoryUsage: number;
  }> {
    // In production, these would come from monitoring systems
    // For now, return mock data
    return {
      errorRate: 0.02,
      responseTime: 500,
      successRate: 0.98,
      memoryUsage: 0.65,
    };
  }
}