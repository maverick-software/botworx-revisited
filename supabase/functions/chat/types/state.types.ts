/**
 * State Management Types for Advanced Chat System
 * Version: 1.0.0
 * 
 * These types define the state architecture for managing agent state
 * across sessions, including local state, shared state, and persistence.
 */

// ============================
// Core State Types
// ============================

export interface AgentState {
  agent_id: string;
  version: string;
  
  // Core State
  local_state: LocalState;
  shared_state: SharedState;
  
  // Temporal State
  session_state: SessionState;
  persistent_state: PersistentState;
  
  // Meta Information
  checkpoints: StateCheckpoint[];
  last_modified: string;
  modification_count: number;
  state_hash: string;                  // For integrity checking
}

// ============================
// Local State (Agent-Specific)
// ============================

export interface LocalState {
  // Agent-specific preferences and settings
  preferences: AgentPreferences;
  
  // Learned patterns and behaviors
  learned_patterns: Pattern[];
  
  // Skill levels and capabilities
  skill_levels: SkillLevel[];
  
  // Error history for learning
  error_history: ErrorRecord[];
  
  // Current context and focus
  current_context: CurrentContext;
  
  // Conversation style
  conversation_style: ConversationStyle;
  
  // Custom agent data
  custom_data?: Record<string, any>;
}

export interface AgentPreferences {
  response_style: 'concise' | 'detailed' | 'balanced';
  language_preferences: {
    primary_language: string;          // ISO 639-1
    supported_languages: string[];
    formality_level: 'casual' | 'professional' | 'formal';
  };
  interaction_preferences: {
    proactive_suggestions: boolean;
    clarification_threshold: number;   // 0.0 - 1.0
    error_correction: 'immediate' | 'batch' | 'manual';
  };
  tool_preferences: {
    preferred_tools: string[];
    tool_confirmation_required: boolean;
    parallel_execution: boolean;
  };
}

export interface Pattern {
  id: string;
  pattern_type: 'behavioral' | 'linguistic' | 'task' | 'error';
  description: string;
  frequency: number;
  confidence: number;                  // 0.0 - 1.0
  examples: PatternExample[];
  learned_at: string;
  last_applied: string;
  success_rate: number;
}

export interface PatternExample {
  input: string;
  output: string;
  context: Record<string, any>;
  outcome: 'success' | 'failure' | 'partial';
}

export interface SkillLevel {
  skill_name: string;
  category: string;
  proficiency: number;                 // 0.0 - 1.0
  experience_points: number;
  sub_skills?: SkillLevel[];
  achievements?: Achievement[];
  last_used: string;
  improvement_rate: number;            // Rate of improvement
}

export interface Achievement {
  name: string;
  description: string;
  earned_at: string;
  criteria: string;
}

export interface ErrorRecord {
  id: string;
  error_type: string;
  error_message: string;
  context: Record<string, any>;
  timestamp: string;
  resolution?: string;
  prevented_recurrence: boolean;
  learned_from: boolean;
}

export interface CurrentContext {
  active_task?: TaskContext;
  working_memory: string[];            // Item IDs in working memory
  attention_focus: string[];           // Current focus areas
  conversation_phase: ConversationPhase;
  user_mood?: UserMood;
}

export interface TaskContext {
  task_id: string;
  task_type: string;
  description: string;
  status: 'planning' | 'executing' | 'reviewing' | 'completed';
  steps_completed: string[];
  steps_remaining: string[];
  started_at: string;
  estimated_completion?: string;
}

export type ConversationPhase = 
  | 'greeting'
  | 'understanding'
  | 'clarifying'
  | 'executing'
  | 'confirming'
  | 'closing';

export interface UserMood {
  detected_mood: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'confused';
  confidence: number;
  indicators: string[];
}

export interface ConversationStyle {
  tone: 'friendly' | 'professional' | 'technical' | 'educational';
  verbosity: 'minimal' | 'balanced' | 'detailed';
  personality_traits: PersonalityTrait[];
  adapted_to_user: boolean;
}

export interface PersonalityTrait {
  trait: string;
  strength: number;                    // 0.0 - 1.0
  expression_examples: string[];
}

// ============================
// Shared State (Cross-Agent)
// ============================

export interface SharedState {
  // Knowledge shared across agents
  shared_knowledge: SharedKnowledge;
  
  // Coordination between agents
  coordination_state: CoordinationState;
  
  // Workspace-level context
  workspace_context: WorkspaceContext;
  
  // Shared resources
  shared_resources: SharedResource[];
  
  // Global settings
  global_settings: GlobalSettings;
}

export interface SharedKnowledge {
  facts: Fact[];
  definitions: Definition[];
  procedures: SharedProcedure[];
  last_sync: string;
  version: number;
}

export interface Fact {
  id: string;
  statement: string;
  confidence: number;
  sources: string[];
  verified: boolean;
  expires_at?: string;
}

export interface Definition {
  term: string;
  definition: string;
  context: string;
  alternatives?: string[];
  related_terms?: string[];
}

export interface SharedProcedure {
  id: string;
  name: string;
  description: string;
  applicable_scenarios: string[];
  success_rate: number;
  shared_by: string;                   // Agent ID who shared it
}

export interface CoordinationState {
  active_collaborations: Collaboration[];
  shared_tasks: SharedTask[];
  synchronization_points: SyncPoint[];
  communication_channels: CommunicationChannel[];
}

export interface Collaboration {
  id: string;
  participants: string[];              // Agent IDs
  purpose: string;
  status: 'active' | 'paused' | 'completed';
  started_at: string;
  coordination_protocol: string;
  shared_memory_pool?: string;         // Shared memory ID
}

export interface SharedTask {
  id: string;
  description: string;
  assigned_agents: TaskAssignment[];
  dependencies: string[];              // Other task IDs
  status: 'pending' | 'in_progress' | 'blocked' | 'completed';
  priority: number;
  deadline?: string;
}

export interface TaskAssignment {
  agent_id: string;
  role: string;
  responsibilities: string[];
  status: 'assigned' | 'accepted' | 'working' | 'completed';
}

export interface SyncPoint {
  id: string;
  name: string;
  participants: string[];
  trigger_condition: string;
  last_sync: string;
  next_sync?: string;
  data_to_sync: string[];             // State paths
}

export interface CommunicationChannel {
  id: string;
  type: 'broadcast' | 'multicast' | 'unicast';
  participants: string[];
  protocol: 'async' | 'sync';
  message_types: string[];
}

export interface WorkspaceContext {
  workspace_id: string;
  active_projects: Project[];
  shared_goals: Goal[];
  workspace_memory?: string;           // Shared memory bank ID
  cultural_context: CulturalContext;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed';
  participants: string[];
  milestones: Milestone[];
}

export interface Milestone {
  id: string;
  name: string;
  target_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'missed';
  completion_criteria: string[];
}

export interface Goal {
  id: string;
  description: string;
  priority: number;
  metrics: GoalMetric[];
  deadline?: string;
}

export interface GoalMetric {
  name: string;
  current_value: number;
  target_value: number;
  unit: string;
}

export interface CulturalContext {
  language: string;
  timezone: string;
  working_hours?: {
    start: string;                     // HH:mm
    end: string;                       // HH:mm
    days: string[];                    // ['monday', 'tuesday', ...]
  };
  communication_norms?: string[];
}

export interface SharedResource {
  id: string;
  type: 'data' | 'tool' | 'model' | 'api';
  name: string;
  access_level: 'read' | 'write' | 'admin';
  shared_by: string[];                 // Agent IDs with access
  usage_quota?: ResourceQuota;
}

export interface ResourceQuota {
  limit: number;
  used: number;
  unit: string;
  reset_period: 'hourly' | 'daily' | 'monthly';
  last_reset: string;
}

export interface GlobalSettings {
  default_language: string;
  default_timezone: string;
  collaboration_mode: 'cooperative' | 'competitive' | 'mixed';
  resource_sharing: 'open' | 'restricted' | 'request-based';
  conflict_resolution: 'consensus' | 'authority' | 'voting';
}

// ============================
// Session State
// ============================

export interface SessionState {
  session_id: string;
  started_at: string;
  last_active: string;
  conversation_history: ConversationTurn[];
  active_tools: string[];
  temporary_preferences?: Record<string, any>;
  session_goals?: string[];
  interruption_context?: InterruptionContext;
}

export interface ConversationTurn {
  turn_number: number;
  timestamp: string;
  message_ids: string[];               // Message IDs in this turn
  tokens_used: number;
  tools_invoked?: string[];
  outcome?: 'successful' | 'clarification_needed' | 'failed';
}

export interface InterruptionContext {
  last_position: string;               // Where conversation was interrupted
  pending_actions: string[];
  partial_results?: any;
  resume_strategy: 'continue' | 'summarize' | 'restart';
}

// ============================
// Persistent State
// ============================

export interface PersistentState {
  user_relationships: UserRelationship[];
  long_term_goals: LongTermGoal[];
  accumulated_knowledge: AccumulatedKnowledge;
  performance_history: PerformanceHistory;
  evolution_track: EvolutionTrack;
}

export interface UserRelationship {
  user_id: string;
  relationship_quality: number;        // 0.0 - 1.0
  interaction_count: number;
  first_interaction: string;
  last_interaction: string;
  preferences_learned: Record<string, any>;
  trust_level: number;                 // 0.0 - 1.0
  communication_style: string;
}

export interface LongTermGoal {
  id: string;
  description: string;
  created_at: string;
  target_date?: string;
  progress: number;                    // 0.0 - 1.0
  milestones_completed: string[];
  blockers?: string[];
}

export interface AccumulatedKnowledge {
  domains: KnowledgeDomain[];
  total_facts_learned: number;
  knowledge_graph_size: number;
  last_consolidation: string;
}

export interface KnowledgeDomain {
  name: string;
  expertise_level: number;             // 0.0 - 1.0
  key_concepts: string[];
  learning_sources: string[];
  last_updated: string;
}

export interface PerformanceHistory {
  total_interactions: number;
  success_rate: number;
  average_response_time_ms: number;
  error_rate: number;
  user_satisfaction: number;           // 0.0 - 1.0
  improvement_trend: 'improving' | 'stable' | 'declining';
}

export interface EvolutionTrack {
  version_history: VersionEntry[];
  capability_additions: CapabilityAddition[];
  behavioral_changes: BehavioralChange[];
  learning_milestones: LearningMilestone[];
}

export interface VersionEntry {
  version: string;
  timestamp: string;
  changes: string[];
  performance_impact: number;          // -1.0 to 1.0
}

export interface CapabilityAddition {
  capability: string;
  added_at: string;
  proficiency_growth: Array<{
    timestamp: string;
    proficiency: number;
  }>;
}

export interface BehavioralChange {
  behavior: string;
  changed_at: string;
  reason: string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface LearningMilestone {
  milestone: string;
  achieved_at: string;
  significance: 'minor' | 'major' | 'breakthrough';
  details: string;
}

// ============================
// State Management
// ============================

export interface StateCheckpoint {
  id: string;
  timestamp: string;
  state_hash: string;
  trigger: 'manual' | 'automatic' | 'error_recovery' | 'milestone';
  size_bytes: number;
  compression_type?: 'none' | 'gzip' | 'zstd';
  restoration_time_ms?: number;
  description?: string;
  retention_policy: 'temporary' | 'permanent' | 'archive';
}

export interface StateTransition {
  from_state: string;                  // State hash
  to_state: string;                    // State hash
  transition_type: 'update' | 'merge' | 'reset' | 'restore';
  timestamp: string;
  trigger: string;
  changes: StateChange[];
  rollback_available: boolean;
}

export interface StateChange {
  path: string;                        // JSON path to changed field
  operation: 'add' | 'update' | 'delete';
  previous_value?: any;
  new_value?: any;
  change_reason?: string;
}

export interface StateDelta {
  previous_version: string;
  new_version: string;
  changes: StateChange[];
  summary?: string;
  impact_assessment?: ImpactAssessment;
}

export interface ImpactAssessment {
  affected_capabilities: string[];
  performance_impact: 'positive' | 'negative' | 'neutral';
  risk_level: 'low' | 'medium' | 'high';
  requires_retraining: boolean;
}

// ============================
// State Operations
// ============================

export interface StateQuery {
  paths?: string[];                    // Specific paths to retrieve
  include_checkpoints?: boolean;
  include_history?: boolean;
  as_of_timestamp?: string;            // Historical state
}

export interface StateMergeStrategy {
  strategy: 'override' | 'merge' | 'append' | 'custom';
  conflict_resolution: 'source' | 'target' | 'newest' | 'manual';
  preserve_paths?: string[];           // Paths to always preserve
  custom_merger?: (source: any, target: any) => any;
}

export interface StateValidation {
  schema_version: string;
  required_fields: string[];
  validation_rules: ValidationRule[];
  auto_correct: boolean;
}

export interface ValidationRule {
  path: string;
  rule: 'type' | 'range' | 'pattern' | 'custom';
  parameters: any;
  error_message: string;
}

// ============================
// Helper Functions
// ============================

export function createEmptyState(agentId: string): AgentState {
  return {
    agent_id: agentId,
    version: '1.0.0',
    local_state: createEmptyLocalState(),
    shared_state: createEmptySharedState(),
    session_state: createEmptySessionState(),
    persistent_state: createEmptyPersistentState(),
    checkpoints: [],
    last_modified: new Date().toISOString(),
    modification_count: 0,
    state_hash: ''
  };
}

export function createEmptyLocalState(): LocalState {
  return {
    preferences: {
      response_style: 'balanced',
      language_preferences: {
        primary_language: 'en',
        supported_languages: ['en'],
        formality_level: 'professional'
      },
      interaction_preferences: {
        proactive_suggestions: true,
        clarification_threshold: 0.7,
        error_correction: 'immediate'
      },
      tool_preferences: {
        preferred_tools: [],
        tool_confirmation_required: false,
        parallel_execution: true
      }
    },
    learned_patterns: [],
    skill_levels: [],
    error_history: [],
    current_context: {
      working_memory: [],
      attention_focus: [],
      conversation_phase: 'greeting'
    },
    conversation_style: {
      tone: 'professional',
      verbosity: 'balanced',
      personality_traits: [],
      adapted_to_user: false
    }
  };
}

export function createEmptySharedState(): SharedState {
  return {
    shared_knowledge: {
      facts: [],
      definitions: [],
      procedures: [],
      last_sync: new Date().toISOString(),
      version: 1
    },
    coordination_state: {
      active_collaborations: [],
      shared_tasks: [],
      synchronization_points: [],
      communication_channels: []
    },
    workspace_context: {
      workspace_id: '',
      active_projects: [],
      shared_goals: [],
      cultural_context: {
        language: 'en',
        timezone: 'UTC'
      }
    },
    shared_resources: [],
    global_settings: {
      default_language: 'en',
      default_timezone: 'UTC',
      collaboration_mode: 'cooperative',
      resource_sharing: 'open',
      conflict_resolution: 'consensus'
    }
  };
}

export function createEmptySessionState(): SessionState {
  return {
    session_id: '',
    started_at: new Date().toISOString(),
    last_active: new Date().toISOString(),
    conversation_history: [],
    active_tools: []
  };
}

export function createEmptyPersistentState(): PersistentState {
  return {
    user_relationships: [],
    long_term_goals: [],
    accumulated_knowledge: {
      domains: [],
      total_facts_learned: 0,
      knowledge_graph_size: 0,
      last_consolidation: new Date().toISOString()
    },
    performance_history: {
      total_interactions: 0,
      success_rate: 0,
      average_response_time_ms: 0,
      error_rate: 0,
      user_satisfaction: 0,
      improvement_trend: 'stable'
    },
    evolution_track: {
      version_history: [],
      capability_additions: [],
      behavioral_changes: [],
      learning_milestones: []
    }
  };
}