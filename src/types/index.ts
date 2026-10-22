import { Database } from './database.types'; // Import generated types

// Export specific table types using Supabase helpers
export type Agent = Database['public']['Tables']['agents']['Row'];
export type Datastore = Database['public']['Tables']['datastores']['Row'];
export type AgentDiscordConnection = Database['public']['Tables']['agent_discord_connections']['Row'];
export type Team = Database['public']['Tables']['teams']['Row'];
export type TeamMember = Database['public']['Tables']['team_members']['Row'] & {
  agent?: Agent;
};

// Extended team type with hierarchy information
export type TeamWithHierarchy = Team & {
  child_teams?: TeamWithHierarchy[];
  parent_team?: Team;
  child_count?: number;
};

// Keep existing Message type if needed
export interface Message {
  role: 'user' | 'assistant' | 'thinking';
  content: string;
  timestamp: Date;
  agentId?: string | null;
  userId?: string | null;
  agentName?: string | null;
  userName?: string | null;
  userAvatar?: string | null;
  metadata?: any;
  // AI processing details
  aiProcessDetails?: {
    steps: Array<{
      state: string;
      label: string;
      duration?: number;
      details?: string;
      response?: string;
      toolCall?: string;
      toolResult?: any;
      completed: boolean;
    }>;
    totalDuration?: number;
    toolsUsed?: string[];
  };
} 