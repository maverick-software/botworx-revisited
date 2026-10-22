// Feature Flags Configuration for Gradual Rollout
// Controls which advanced features are enabled during migration

export interface FeatureFlags {
  // Core features
  use_advanced_messages: boolean;
  enable_memory_system: boolean;
  enable_state_management: boolean;
  use_new_tool_framework: boolean;
  enable_streaming_responses: boolean;
  
  // Migration features
  maintain_dual_write: boolean;
  auto_migrate_messages: boolean;
  enable_compatibility_mode: boolean;
  
  // Rollout controls
  rollout_percentage: number;
  enabled_agent_ids: string[];
  enabled_user_ids: string[];
  
  // Performance features
  enable_caching: boolean;
  enable_parallel_tools: boolean;
  enable_context_compression: boolean;
  
  // Debug features
  verbose_logging: boolean;
  capture_metrics: boolean;
}

/**
 * Default feature flags configuration
 */
const DEFAULT_FLAGS: FeatureFlags = {
  // Start with core features disabled
  use_advanced_messages: false,
  enable_memory_system: true,
  enable_state_management: false,
  use_new_tool_framework: false,
  enable_streaming_responses: false,
  
  // Enable migration features
  maintain_dual_write: true,
  auto_migrate_messages: true,
  enable_compatibility_mode: true,
  
  // Gradual rollout
  rollout_percentage: 100,
  enabled_agent_ids: [],
  enabled_user_ids: [],
  
  // Performance features
  enable_caching: false,
  enable_parallel_tools: false,
  enable_context_compression: false,
  
  // Debug features
  verbose_logging: true,
  capture_metrics: true,
};

/**
 * Get feature flags from environment or defaults
 */
export function getFeatureFlags(): FeatureFlags {
  const flags: FeatureFlags = { ...DEFAULT_FLAGS };
  
  // Override from environment variables
  if (Deno.env.get('USE_ADVANCED_MESSAGES') === 'true') {
    flags.use_advanced_messages = true;
  }
  
  if (Deno.env.get('ENABLE_MEMORY_SYSTEM') === 'true') {
    flags.enable_memory_system = true;
  }
  
  if (Deno.env.get('ENABLE_STATE_MANAGEMENT') === 'true') {
    flags.enable_state_management = true;
  }
  
  if (Deno.env.get('USE_NEW_TOOL_FRAMEWORK') === 'true') {
    flags.use_new_tool_framework = true;
  }
  
  if (Deno.env.get('ENABLE_STREAMING') === 'true') {
    flags.enable_streaming_responses = true;
  }
  
  if (Deno.env.get('DISABLE_DUAL_WRITE') === 'true') {
    flags.maintain_dual_write = false;
  }
  
  if (Deno.env.get('DISABLE_AUTO_MIGRATE') === 'true') {
    flags.auto_migrate_messages = false;
  }
  
  if (Deno.env.get('DISABLE_COMPATIBILITY') === 'true') {
    flags.enable_compatibility_mode = false;
  }
  
  // Rollout percentage
  const rolloutPct = Deno.env.get('ROLLOUT_PERCENTAGE');
  if (rolloutPct) {
    flags.rollout_percentage = parseInt(rolloutPct, 10);
  }
  
  // Enabled agent IDs (comma-separated)
  const enabledAgents = Deno.env.get('ENABLED_AGENT_IDS');
  if (enabledAgents) {
    flags.enabled_agent_ids = enabledAgents.split(',').map(id => id.trim());
  }
  
  // Enabled user IDs (comma-separated)
  const enabledUsers = Deno.env.get('ENABLED_USER_IDS');
  if (enabledUsers) {
    flags.enabled_user_ids = enabledUsers.split(',').map(id => id.trim());
  }
  
  // Performance flags
  if (Deno.env.get('ENABLE_CACHING') === 'true') {
    flags.enable_caching = true;
  }
  
  if (Deno.env.get('ENABLE_PARALLEL_TOOLS') === 'true') {
    flags.enable_parallel_tools = true;
  }
  
  if (Deno.env.get('ENABLE_CONTEXT_COMPRESSION') === 'true') {
    flags.enable_context_compression = true;
  }
  
  // Debug flags
  if (Deno.env.get('VERBOSE_LOGGING') === 'false') {
    flags.verbose_logging = false;
  }
  
  if (Deno.env.get('CAPTURE_METRICS') === 'false') {
    flags.capture_metrics = false;
  }
  
  return flags;
}

/**
 * Check if a feature is enabled for a specific user/agent
 */
export function isFeatureEnabled(
  feature: keyof FeatureFlags,
  userId?: string,
  agentId?: string
): boolean {
  const flags = getFeatureFlags();
  
  // Check if feature is globally enabled
  const globallyEnabled = flags[feature] as boolean;
  if (!globallyEnabled) return false;
  
  // Check rollout percentage (simple random check)
  if (flags.rollout_percentage < 100) {
    const randomValue = Math.random() * 100;
    if (randomValue > flags.rollout_percentage) {
      return false;
    }
  }
  
  // Check specific user/agent allowlists
  if (userId && flags.enabled_user_ids.length > 0) {
    return flags.enabled_user_ids.includes(userId);
  }
  
  if (agentId && flags.enabled_agent_ids.length > 0) {
    return flags.enabled_agent_ids.includes(agentId);
  }
  
  return true;
}

/**
 * Log feature flag status (for debugging)
 */
export function logFeatureFlags(): void {
  const flags = getFeatureFlags();
  console.log('[FeatureFlags] Current configuration:', {
    core: {
      advanced_messages: flags.use_advanced_messages,
      memory: flags.enable_memory_system,
      state: flags.enable_state_management,
      tools: flags.use_new_tool_framework,
      streaming: flags.enable_streaming_responses,
    },
    migration: {
      dual_write: flags.maintain_dual_write,
      auto_migrate: flags.auto_migrate_messages,
      compatibility: flags.enable_compatibility_mode,
    },
    rollout: {
      percentage: flags.rollout_percentage,
      agent_count: flags.enabled_agent_ids.length,
      user_count: flags.enabled_user_ids.length,
    },
    performance: {
      caching: flags.enable_caching,
      parallel_tools: flags.enable_parallel_tools,
      compression: flags.enable_context_compression,
    },
  });
}

/**
 * Kill switch registry for emergency rollback
 */
export class KillSwitch {
  private static switches: Map<string, boolean> = new Map();
  
  /**
   * Register a kill switch
   */
  static register(name: string, defaultValue: boolean = false): void {
    this.switches.set(name, defaultValue);
  }
  
  /**
   * Check if a kill switch is activated
   */
  static isActivated(name: string): boolean {
    // Check environment override first
    const envValue = Deno.env.get(`KILL_SWITCH_${name.toUpperCase()}`);
    if (envValue === 'true') return true;
    
    // Check registered value
    return this.switches.get(name) || false;
  }
  
  /**
   * Activate a kill switch
   */
  static activate(name: string): void {
    this.switches.set(name, true);
    console.warn(`[KillSwitch] ACTIVATED: ${name}`);
  }
  
  /**
   * Deactivate a kill switch
   */
  static deactivate(name: string): void {
    this.switches.set(name, false);
    console.log(`[KillSwitch] Deactivated: ${name}`);
  }
  
  /**
   * Get all kill switch statuses
   */
  static getStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    this.switches.forEach((value, key) => {
      status[key] = value;
    });
    return status;
  }
}

// Register default kill switches
KillSwitch.register('disable_v2_messages');
KillSwitch.register('disable_memory_system');
KillSwitch.register('disable_state_management');
KillSwitch.register('disable_new_tools');
KillSwitch.register('emergency_rollback');

/**
 * Feature flag middleware for conditional execution
 */
export function withFeatureFlag<T>(
  feature: keyof FeatureFlags,
  enabledFn: () => T,
  disabledFn?: () => T
): T {
  const flags = getFeatureFlags();
  
  if (flags[feature] as boolean) {
    return enabledFn();
  } else if (disabledFn) {
    return disabledFn();
  } else {
    throw new Error(`Feature '${feature}' is disabled and no fallback provided`);
  }
}