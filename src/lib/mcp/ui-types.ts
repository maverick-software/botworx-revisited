// src/lib/mcp/ui-types.ts
// UI-specific types for MCP components, extending core types

import { MCPServerConfig, MCPServerCapabilities } from './types';

// ========================================
// Server List & Display Types
// ========================================

export interface MCPServer extends MCPServerConfig {
  status: MCPServerStatus;
  health: MCPServerHealth;
  deploymentId?: string;
  lastSeen?: Date;
  resourceUsage?: MCPResourceUsage;
  tags?: string[];
}

export interface MCPServerStatus {
  state: 'running' | 'stopped' | 'error' | 'starting' | 'stopping' | 'unknown';
  uptime?: number; // seconds
  restartCount?: number;
  lastStarted?: Date;
  lastError?: string;
}

export interface MCPServerHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  checks: {
    connectivity: boolean;
    responseTime: number; // ms
    errorRate: number; // percentage
    memoryUsage: number; // percentage
    cpuUsage: number; // percentage
  };
  lastChecked: Date;
}

export interface MCPResourceUsage {
  memory: {
    used: number; // MB
    limit: number; // MB
    percentage: number;
  };
  cpu: {
    percentage: number;
    cores: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
  };
}

// ========================================
// Marketplace & Template Types
// ========================================

export interface MCPServerTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: MCPServerCategory;
  tags: string[];
  dockerImage: string;
  documentation: string;
  sourceCode?: string;
  rating: {
    average: number;
    count: number;
  };
  downloads: number;
  verified: boolean;
  configSchema: MCPConfigSchema;
  requiredCapabilities: string[];
  supportedTransports: ('stdio' | 'sse' | 'websocket')[];
  resourceRequirements: {
    memory: string; // e.g., "512Mi"
    cpu: string; // e.g., "0.5"
    storage?: string; // e.g., "1Gi"
  };
  environment?: Record<string, string>;
  previewImages?: string[];
  lastUpdated: Date;
  isActive: boolean;
}

export type MCPServerCategory = 
  | 'productivity'
  | 'development'
  | 'data-analysis'
  | 'ai-tools'
  | 'integrations'
  | 'utilities'
  | 'entertainment'
  | 'business'
  | 'other';

export interface MCPConfigSchema {
  type: 'object';
  properties: Record<string, MCPConfigProperty>;
  required?: string[];
}

export interface MCPConfigProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  title: string;
  description?: string;
  default?: any;
  enum?: any[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
  items?: MCPConfigProperty;
}

// ========================================
// Deployment & Configuration Types
// ========================================

export interface MCPDeploymentConfig {
  templateId: string;
  name: string;
  description?: string;
  environment: 'development' | 'staging' | 'production';
  configuration: Record<string, any>;
  resourceLimits: {
    memory: string;
    cpu: string;
    storage?: string;
  };
  scaling: {
    replicas: number;
    autoScale: boolean;
    minReplicas?: number;
    maxReplicas?: number;
  };
  networking: {
    expose: boolean;
    ports?: number[];
    domains?: string[];
  };
  credentials: MCPCredentialConfig[];
  healthCheck: {
    enabled: boolean;
    path?: string;
    interval: number; // seconds
    timeout: number; // seconds
    retries: number;
  };
  monitoring: {
    enabled: boolean;
    alerts: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

export interface MCPCredentialConfig {
  providerId: string;
  connectionId: string;
  scopes: string[];
  required: boolean;
}

export interface MCPDeploymentStatus {
  id: string;
  status: 'pending' | 'deploying' | 'running' | 'failed' | 'terminated';
  progress: number; // 0-100
  message: string;
  startedAt: Date;
  completedAt?: Date;
  logs: MCPDeploymentLog[];
  endpoints: MCPEndpoint[];
}

export interface MCPDeploymentLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: string;
}

export interface MCPEndpoint {
  type: 'http' | 'websocket' | 'stdio';
  url: string;
  status: 'active' | 'inactive';
}

// ========================================
// Agent Integration Types
// ========================================

export interface AgentMCPAccess {
  agentId: string;
  serverId: string;
  permissions: MCPPermissionLevel;
  grantedAt: Date;
  grantedBy: string;
  expiresAt?: Date;
  lastUsed?: Date;
  usageCount: number;
}

export type MCPPermissionLevel = 'read_only' | 'full_access' | 'custom';

export interface MCPPermissionMatrix {
  [agentId: string]: {
    [serverId: string]: MCPPermissionLevel;
  };
}

// ========================================
// Component Props Interfaces
// ========================================

export interface MCPServerListProps {
  servers: MCPServer[];
  onServerSelect?: (server: MCPServer) => void;
  onServerAction?: (action: MCPServerAction, server: MCPServer) => void;
  loading?: boolean;
  error?: string;
  filters?: MCPServerFilters;
  onFiltersChange?: (filters: MCPServerFilters) => void;
  sortBy?: MCPServerSortField;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (field: MCPServerSortField, order: 'asc' | 'desc') => void;
}

export interface MCPMarketplaceProps {
  templates: MCPServerTemplate[];
  onTemplateSelect?: (template: MCPServerTemplate) => void;
  onDeploy?: (template: MCPServerTemplate, config: MCPDeploymentConfig) => void;
  loading?: boolean;
  error?: string;
  categories?: MCPServerCategory[];
  selectedCategory?: MCPServerCategory;
  onCategoryChange?: (category: MCPServerCategory | null) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export interface MCPServerDeploymentProps {
  template: MCPServerTemplate;
  onDeploy: (config: MCPDeploymentConfig) => Promise<void>;
  onCancel: () => void;
  availableCredentials: MCPCredentialConfig[];
  defaultConfig?: Partial<MCPDeploymentConfig>;
  loading?: boolean;
  error?: string;
}

export interface MCPServerConfigProps {
  server: MCPServer;
  onSave: (config: Partial<MCPServer>) => Promise<void>;
  onCancel: () => void;
  onRestart: () => void;
  onDelete: () => void;
  loading?: boolean;
  error?: string;
  readOnly?: boolean;
}

export type MCPServerAction = 
  | 'start'
  | 'stop'
  | 'restart'
  | 'configure'
  | 'delete'
  | 'view-logs'
  | 'view-metrics'
  | 'clone';

export interface MCPServerFilters {
  status?: MCPServerStatus['state'][];
  health?: MCPServerHealth['overall'][];
  category?: MCPServerCategory[];
  tags?: string[];
  verified?: boolean;
}

export type MCPServerSortField = 
  | 'name'
  | 'status'
  | 'health'
  | 'uptime'
  | 'memoryUsage'
  | 'cpuUsage'
  | 'lastSeen'
  | 'rating';

// ========================================
// API Response Types
// ========================================

export interface MCPApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface MCPServerListResponse extends MCPApiResponse<MCPServer[]> {
  total: number;
  page: number;
  pageSize: number;
}

export interface MCPTemplateListResponse extends MCPApiResponse<MCPServerTemplate[]> {
  total: number;
  categories: MCPServerCategory[];
  popularTags: string[];
}

export interface MCPDeploymentResponse extends MCPApiResponse<MCPDeploymentStatus> {
  deploymentId: string;
}

// ========================================
// Hook Return Types
// ========================================

export interface UseMCPServersReturn {
  servers: MCPServer[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateServer: (id: string, updates: Partial<MCPServer>) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
}

export interface UseMCPDeploymentReturn {
  deploy: (config: MCPDeploymentConfig) => Promise<MCPDeploymentStatus>;
  deploymentStatus: MCPDeploymentStatus | null;
  loading: boolean;
  error: string | null;
  reset: () => void;
}

export interface UseMCPServerConfigReturn {
  config: MCPServer | null;
  loading: boolean;
  error: string | null;
  updateConfig: (updates: Partial<MCPServer>) => Promise<void>;
  resetConfig: () => void;
}

export interface UseMCPServerHealthReturn {
  health: MCPServerHealth;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startMonitoring: () => void;
  stopMonitoring: () => void;
}

// ========================================
// Context Types
// ========================================

export interface MCPContextValue {
  servers: MCPServer[];
  templates: MCPServerTemplate[];
  deployments: MCPDeploymentStatus[];
  loading: boolean;
  error: string | null;
  refetchServers: () => Promise<void>;
  refetchTemplates: () => Promise<void>;
  deployServer: (config: MCPDeploymentConfig) => Promise<MCPDeploymentStatus>;
  updateServerConfig: (id: string, config: Partial<MCPServer>) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
}

// ========================================
// Utility Types
// ========================================

export type MCPComponentSize = 'sm' | 'md' | 'lg';
export type MCPComponentVariant = 'default' | 'outline' | 'ghost' | 'destructive';

export interface MCPComponentProps {
  className?: string;
  size?: MCPComponentSize;
  variant?: MCPComponentVariant;
  disabled?: boolean;
} 