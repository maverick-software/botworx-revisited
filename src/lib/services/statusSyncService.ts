import { MCPService, MCPServerStatus, EnhancedMCPServer } from './mcpService';
import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';

// Status synchronization interfaces
export interface StatusUpdate {
  serverId: string;
  previousStatus: MCPServerStatus;
  currentStatus: MCPServerStatus;
  timestamp: Date;
  source: 'dtma' | 'heartbeat' | 'manual' | 'system';
  details?: string;
}

export interface StatusSubscription {
  id: string;
  serverId?: string; // undefined for all servers
  callback: (update: StatusUpdate) => void;
  filters?: StatusUpdateFilter[];
  isActive: boolean;
  createdAt: Date;
}

export interface StatusUpdateFilter {
  type: 'status_change' | 'health_change' | 'error_state' | 'recovery';
  serverIds?: string[];
  statusStates?: string[];
  healthLevels?: string[];
}

export interface StatusCache {
  serverId: string;
  status: MCPServerStatus;
  lastUpdated: Date;
  lastChecked: Date;
  checkCount: number;
  errorCount: number;
}

export interface SyncMetrics {
  totalServers: number;
  activeServers: number;
  errorServers: number;
  lastSyncTime: Date;
  syncDuration: number;
  statusChanges: number;
  subscriptions: number;
  cacheHitRate: number;
}

export interface HeartbeatConfig {
  interval: number; // milliseconds
  timeout: number; // milliseconds
  maxRetries: number;
  backoffMultiplier: number;
  healthCheckEndpoint: string;
}

/**
 * StatusSyncService - Real-time status synchronization service
 * 
 * This service provides:
 * - Real-time DTMA-MCP status synchronization
 * - WebSocket-based notifications
 * - Heartbeat monitoring and health checks
 * - Status caching and performance optimization
 * - Comprehensive subscription management
 * 
 * Key features:
 * - Multi-layer status mapping
 * - Real-time WebSocket notifications
 * - Heartbeat monitoring with retry logic
 * - Status caching with TTL
 * - Subscription filtering and management
 * - Comprehensive error handling and recovery
 */
export class StatusSyncService extends MCPService {
  private statusCache: Map<string, StatusCache> = new Map();
  private subscriptions: Map<string, StatusSubscription> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private wsConnection: WebSocket | null = null;
  private wsHeartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private isRunning: boolean = false;
  private heartbeatConfig: HeartbeatConfig;
  private syncMetrics: SyncMetrics;

  constructor(supabaseClient?: SupabaseClient, heartbeatConfig?: Partial<HeartbeatConfig>) {
    super(supabaseClient);
    this.heartbeatConfig = {
      interval: 30000, // 30 seconds
      timeout: 10000, // 10 seconds
      maxRetries: 3,
      backoffMultiplier: 2,
      healthCheckEndpoint: '/health',
      ...heartbeatConfig
    };
    
    this.syncMetrics = {
      totalServers: 0,
      activeServers: 0,
      errorServers: 0,
      lastSyncTime: new Date(),
      syncDuration: 0,
      statusChanges: 0,
      subscriptions: 0,
      cacheHitRate: 0
    };
  }

  // ============================================================================
  // SERVICE LIFECYCLE
  // ============================================================================

  /**
   * Start the status synchronization service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('StatusSyncService is already running');
      return;
    }

    try {
      console.log('Starting StatusSyncService...');
      
      // Initialize WebSocket connection
      await this.initializeWebSocket();
      
      // Start heartbeat monitoring
      await this.startHeartbeatMonitoring();
      
      // Start periodic status sync
      this.syncInterval = setInterval(async () => {
        try {
          await this.syncAllServerStatuses();
          await this.cleanupExpiredCache();
        } catch (error) {
          console.error('Error in periodic status sync:', error);
        }
      }, 60000); // Every minute
      
      // Perform initial sync
      await this.syncAllServerStatuses();
      
      this.isRunning = true;
      console.log('StatusSyncService started successfully');
      
    } catch (error) {
      console.error('Failed to start StatusSyncService:', error);
      await this.stop(); // Cleanup on failure
      throw error;
    }
  }

  /**
   * Stop the status synchronization service
   */
  async stop(): Promise<void> {
    console.log('Stopping StatusSyncService...');
    
    this.isRunning = false;
    
    // Stop intervals
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Stop WebSocket heartbeat
    if (this.wsHeartbeatInterval) {
      clearInterval(this.wsHeartbeatInterval);
      this.wsHeartbeatInterval = null;
    }
    
    // Close WebSocket
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
    
    // Clear subscriptions
    this.unsubscribeAll();
    
    // Clear cache
    this.clearCache();
    
    console.log('StatusSyncService stopped');
  }

  /**
   * Restart the service
   */
  async restart(): Promise<void> {
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
    await this.start();
  }

  /**
   * Check if service is active
   */
  isActive(): boolean {
    return this.isRunning;
  }

  // ============================================================================
  // STATUS SYNCHRONIZATION
  // ============================================================================

  /**
   * Sync all MCP server statuses
   */
  async syncAllServerStatuses(): Promise<StatusUpdate[]> {
    const startTime = Date.now();
    const updates: StatusUpdate[] = [];
    
    try {
      // Get all MCP server instances
      const { data: servers, error } = await this.supabase
        .from('account_tool_instances')
        .select(`
          id,
          instance_name_on_toolbox,
          status_on_toolbox,
          last_heartbeat_from_dtma,
          mcp_server_type,
          account_tool_environment:account_tool_environments(
            id,
            name,
            public_ip_address,
            region_slug,
            size_slug
          )
        `)
        .not('mcp_server_type', 'is', null);

      if (error) {
        throw new Error(`Failed to fetch MCP servers: ${error.message}`);
      }

      // Update metrics
      this.syncMetrics.totalServers = servers?.length || 0;

      // Process each server
      for (const server of servers || []) {
        try {
          const update = await this.syncServerStatus(server.id);
          if (update) {
            updates.push(update);
          }
        } catch (error) {
          console.error(`Error syncing server ${server.id}:`, error);
        }
      }

      // Update metrics
      const duration = Date.now() - startTime;
      this.syncMetrics.lastSyncTime = new Date();
      this.syncMetrics.syncDuration = duration;
      this.syncMetrics.statusChanges += updates.length;
      this.syncMetrics.activeServers = Array.from(this.statusCache.values())
        .filter(cache => cache.status.state === 'running').length;
      this.syncMetrics.errorServers = Array.from(this.statusCache.values())
        .filter(cache => cache.status.health === 'unhealthy').length;

      console.log(`Synced ${updates.length} status changes in ${duration}ms`);
      
      return updates;
      
    } catch (error) {
      console.error('Error in syncAllServerStatuses:', error);
      throw error;
    }
  }

  /**
   * Sync status for a specific server
   */
  async syncServerStatus(serverId: string): Promise<StatusUpdate | null> {
    try {
      // Get current database status
      const { data: server, error } = await this.supabase
        .from('account_tool_instances')
        .select(`
          id,
          instance_name_on_toolbox,
          status_on_toolbox,
          last_heartbeat_from_dtma,
          account_tool_environment:account_tool_environments(
            public_ip_address,
            region_slug,
            size_slug
          )
        `)
        .eq('id', serverId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch server ${serverId}: ${error.message}`);
      }

      // Map to MCP status
      const currentStatus = this.mapStatusToMCPStatus(
        server.status_on_toolbox,
        server.last_heartbeat_from_dtma
      );

      // Check cache for previous status
      const cached = this.getFromCache(serverId);
      const previousStatus = cached?.status;

      // Update cache
      this.updateStatusCache(serverId, currentStatus);

      // Check if status changed
      if (previousStatus && this.statusesEqual(previousStatus, currentStatus)) {
        return null; // No change
      }

      // Create status update
      const update: StatusUpdate = {
        serverId,
        previousStatus: previousStatus || {
          state: 'unknown',
          health: 'unknown',
          uptime: 0
        },
        currentStatus,
        timestamp: new Date(),
        source: 'dtma',
        details: `Status changed from ${previousStatus?.state || 'unknown'} to ${currentStatus.state}`
      };

      // Log the change
      await this.logStatusChange(update);

      // Notify subscribers
      this.notifySubscribers(update);

      return update;

    } catch (error) {
      console.error(`Error syncing server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Force a status update (for manual overrides)
   */
  async forceStatusUpdate(serverId: string, status: MCPServerStatus): Promise<void> {
    const cached = this.getFromCache(serverId);
    const previousStatus = cached?.status;

    // Update cache
    this.updateStatusCache(serverId, status);

    // Create update
    const update: StatusUpdate = {
      serverId,
              previousStatus: previousStatus || {
          state: 'unknown',
          health: 'unknown',
          uptime: 0
        },
      currentStatus: status,
      timestamp: new Date(),
      source: 'manual',
      details: 'Manual status override'
    };

    // Log and notify
    await this.logStatusChange(update);
    this.notifySubscribers(update);
  }

  // ============================================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================================

  /**
   * Subscribe to status updates with optional filters
   */
  subscribe(callback: (update: StatusUpdate) => void, filters?: StatusUpdateFilter[]): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: StatusSubscription = {
      id: subscriptionId,
      callback,
      filters,
      isActive: true,
      createdAt: new Date()
    };
    
    this.subscriptions.set(subscriptionId, subscription);
    this.syncMetrics.subscriptions = this.subscriptions.size;
    
    console.log(`Created subscription ${subscriptionId} with ${filters?.length || 0} filters`);
    
    return subscriptionId;
  }

  /**
   * Subscribe to updates for a specific server
   */
  subscribeToServer(serverId: string, callback: (update: StatusUpdate) => void): string {
    const filters: StatusUpdateFilter[] = [{
      type: 'status_change',
      serverIds: [serverId]
    }];
    
    return this.subscribe(callback, filters);
  }

  /**
   * Unsubscribe from status updates
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.isActive = false;
      this.subscriptions.delete(subscriptionId);
      this.syncMetrics.subscriptions = this.subscriptions.size;
      console.log(`Unsubscribed ${subscriptionId}`);
    }
  }

  /**
   * Unsubscribe from all status updates
   */
  unsubscribeAll(): void {
    const count = this.subscriptions.size;
    this.subscriptions.clear();
    this.syncMetrics.subscriptions = 0;
    console.log(`Unsubscribed from ${count} subscriptions`);
  }

  // ============================================================================
  // STATUS QUERIES
  // ============================================================================

  /**
   * Get current status for a specific server
   */
  async getServerStatus(serverId: string): Promise<MCPServerStatus> {
    // Try cache first
    const cached = this.getFromCache(serverId);
    if (cached && this.isCacheValid(cached)) {
      return cached.status;
    }

    // Sync from database
    const update = await this.syncServerStatus(serverId);
    if (update) {
      return update.currentStatus;
    }

         // Fallback to unknown status
     return {
       state: 'unknown',
       health: 'unknown',
       uptime: 0
     };
  }

  /**
   * Get all server statuses
   */
  async getAllServerStatuses(): Promise<Record<string, MCPServerStatus>> {
    await this.syncAllServerStatuses();
    
    const statuses: Record<string, MCPServerStatus> = {};
    for (const [serverId, cache] of this.statusCache.entries()) {
      statuses[serverId] = cache.status;
    }
    
    return statuses;
  }

  /**
   * Get servers by status state
   */
  async getServersByStatus(status: string): Promise<EnhancedMCPServer[]> {
    const servers = await this.getAllMCPServers();
    const results: EnhancedMCPServer[] = [];
    
         for (const server of servers) {
       const serverStatus = await this.getServerStatus(server.id.toString());
       if (serverStatus.state === status) {
         results.push(server);
       }
     }
    
    return results;
  }

  /**
   * Get servers by health level
   */
  async getServersByHealth(health: string): Promise<EnhancedMCPServer[]> {
    const servers = await this.getAllMCPServers();
    const results: EnhancedMCPServer[] = [];
    
    for (const server of servers) {
      const serverStatus = await this.getServerStatus(server.id.toString());
             if (serverStatus.health === health) {
         results.push(server);
       }
    }
    
    return results;
  }

  // ============================================================================
  // HEARTBEAT MONITORING
  // ============================================================================

  /**
   * Start heartbeat monitoring
   */
  async startHeartbeatMonitoring(): Promise<void> {
    if (this.heartbeatInterval) {
      console.warn('Heartbeat monitoring already running');
      return;
    }
    
    console.log(`Starting heartbeat monitoring (interval: ${this.heartbeatConfig.interval}ms)`);
    
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.performBulkHeartbeatCheck();
      } catch (error) {
        console.error('Error in heartbeat monitoring:', error);
      }
    }, this.heartbeatConfig.interval);
    
    // Perform initial check
    await this.performBulkHeartbeatCheck();
  }

  /**
   * Stop heartbeat monitoring
   */
  async stopHeartbeatMonitoring(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('Stopped heartbeat monitoring');
    }
  }

  /**
   * Perform heartbeat check for a single server
   */
  async performHeartbeatCheck(serverId: string): Promise<boolean> {
    try {
      // Get server details
      const server = await this.getMCPServerById(serverId);
      if (!server) {
        return false;
      }
      
      // Build health check URL
      const healthUrl = `${server.endpoint}${this.heartbeatConfig.healthCheckEndpoint}`;
      
      // Perform health check with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.heartbeatConfig.timeout);
      
      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Gofr-Agents-StatusSync/1.0'
          }
        });
        
        clearTimeout(timeoutId);
        
        const isHealthy = response.ok;
        
        // Update status based on health check
        if (!isHealthy) {
          const currentStatus = this.getFromCache(serverId)?.status;
          if (currentStatus && currentStatus.health !== 'unhealthy') {
            await this.forceStatusUpdate(serverId, {
              ...currentStatus,
              health: 'unhealthy',
              lastError: `Health check failed: HTTP ${response.status}`
            });
          }
        }
        
        return isHealthy;
        
      } catch (error) {
        clearTimeout(timeoutId);
        
        // Update status to unhealthy
        const currentStatus = this.getFromCache(serverId)?.status;
        if (currentStatus && currentStatus.health !== 'unhealthy') {
          await this.forceStatusUpdate(serverId, {
            ...currentStatus,
            health: 'unhealthy',
            lastError: `Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
        
        return false;
      }
      
    } catch (error) {
      console.error(`Error in heartbeat check for server ${serverId}:`, error);
      return false;
    }
  }

  /**
   * Perform bulk heartbeat checks for all servers
   */
  async performBulkHeartbeatCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    try {
      // Get all running MCP servers
      const servers = await this.getRunningMCPServers();
      
      // Perform checks in parallel (with concurrency limit)
      const concurrencyLimit = 5;
      const chunks = [];
      
      for (let i = 0; i < servers.length; i += concurrencyLimit) {
        chunks.push(servers.slice(i, i + concurrencyLimit));
      }
      
      for (const chunk of chunks) {
        const promises = chunk.map(async (server) => {
          const result = await this.performHeartbeatCheck(server.id.toString());
          results[server.id.toString()] = result;
          return result;
        });
        
        await Promise.all(promises);
      }
      
      const healthyCount = Object.values(results).filter(Boolean).length;
      console.log(`Heartbeat check completed: ${healthyCount}/${servers.length} servers healthy`);
      
      return results;
      
    } catch (error) {
      console.error('Error in bulk heartbeat check:', error);
      return results;
    }
  }

  // ============================================================================
  // WEBSOCKET MANAGEMENT
  // ============================================================================

  /**
   * Initialize WebSocket connection for real-time updates
   */
  private async initializeWebSocket(): Promise<void> {
    try {
      // Get WebSocket URL from environment or construct from Supabase URL
      const wsUrl = this.getWebSocketUrl();
      
      console.log(`Connecting to WebSocket: ${wsUrl}`);
      
      this.wsConnection = new WebSocket(wsUrl);
      
      this.wsConnection.onopen = () => {
        console.log('WebSocket connected');
        
        // Subscribe to MCP server status changes
        this.wsConnection?.send(JSON.stringify({
          type: 'subscribe',
          channel: 'mcp_server_status',
          filters: {
            table: 'account_tool_instances',
            filter: 'mcp_server_type=not.is.null'
          }
        }));
      };
      
      this.wsConnection.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.wsConnection.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
        
        // Attempt reconnection if service is still running
        if (this.isRunning) {
          setTimeout(() => {
            this.reconnectWebSocket();
          }, 5000);
        }
      };
      
      this.wsConnection.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);
        
        if (this.wsConnection) {
          this.wsConnection.onopen = () => {
            clearTimeout(timeout);
            resolve();
          };
          
          this.wsConnection.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('WebSocket connection failed'));
          };
        }
      });
      
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      // Don't throw - WebSocket is optional for basic functionality
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(message: any): void {
    try {
      if (message.type === 'status_update' && message.data) {
        const { server_id } = message.data;
        
        // Process the status change
        this.syncServerStatus(server_id).catch(error => {
          console.error(`Error processing WebSocket status update for ${server_id}:`, error);
        });
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * Reconnect WebSocket connection
   */
  private async reconnectWebSocket(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    
    try {
      console.log('Attempting WebSocket reconnection...');
      
      // Close existing connection
      if (this.wsConnection) {
        this.wsConnection.close();
        this.wsConnection = null;
      }
      
      // Wait a moment before reconnecting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Initialize new connection
      await this.initializeWebSocket();
      
      console.log('WebSocket reconnected successfully');
      
    } catch (error) {
      console.error('WebSocket reconnection failed:', error);
      
      // Schedule another reconnection attempt
      setTimeout(() => {
        this.reconnectWebSocket();
      }, 10000);
    }
  }

  /**
   * Get WebSocket URL for real-time connections
   */
  private getWebSocketUrl(): string {
    // Use environment variable or construct from current location
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    
    // Try to use Supabase realtime if available
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    if (supabaseUrl) {
      const wsUrl = supabaseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
      return `${wsUrl}/realtime/v1/websocket`;
    }
    
    // Fallback to local WebSocket endpoint
    return `${wsProtocol}//${wsHost}/ws/mcp-status`;
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * Update status cache
   */
  private updateStatusCache(serverId: string, status: MCPServerStatus): void {
    const existing = this.statusCache.get(serverId);
    const now = new Date();
    
    this.statusCache.set(serverId, {
      serverId,
      status,
      lastUpdated: now,
      lastChecked: now,
      checkCount: (existing?.checkCount || 0) + 1,
      errorCount: status.health === 'unhealthy' ? (existing?.errorCount || 0) + 1 : 0
    });
  }

  /**
   * Get status from cache
   */
  private getFromCache(serverId: string): StatusCache | null {
    return this.statusCache.get(serverId) || null;
  }

  /**
   * Clear cache (all or specific server)
   */
  private clearCache(serverId?: string): void {
    if (serverId) {
      this.statusCache.delete(serverId);
    } else {
      this.statusCache.clear();
    }
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupExpiredCache(): void {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    
    for (const [serverId, cache] of this.statusCache.entries()) {
      if (now - cache.lastUpdated.getTime() > maxAge) {
        this.statusCache.delete(serverId);
      }
    }
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheValid(cache: StatusCache): boolean {
    const maxAge = 2 * 60 * 1000; // 2 minutes
    return Date.now() - cache.lastUpdated.getTime() < maxAge;
  }

  // ============================================================================
  // METRICS AND MONITORING
  // ============================================================================

  /**
   * Get synchronization metrics
   */
  async getSyncMetrics(): Promise<SyncMetrics> {
    // Calculate cache hit rate
    const totalCacheChecks = Array.from(this.statusCache.values())
      .reduce((sum, cache) => sum + cache.checkCount, 0);
    const cacheHits = this.statusCache.size;
    this.syncMetrics.cacheHitRate = totalCacheChecks > 0 ? cacheHits / totalCacheChecks : 0;
    
    return { ...this.syncMetrics };
  }

  /**
   * Get status history for a server
   */
  async getStatusHistory(serverId: string, hours: number = 24): Promise<StatusUpdate[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    try {
      const { data, error } = await this.supabase
        .from('mcp_server_status_logs')
        .select('*')
        .eq('server_id', serverId)
        .gte('timestamp', since.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch status history: ${error.message}`);
      }

      return (data || []).map(log => ({
        serverId: log.server_id,
        previousStatus: log.previous_status,
        currentStatus: log.current_status,
        timestamp: new Date(log.timestamp),
        source: log.source,
        details: log.details
      }));
    } catch (error) {
      console.error(`Error fetching status history for ${serverId}:`, error);
      return [];
    }
  }

  // ============================================================================
  // PRIVATE UTILITIES
  // ============================================================================

  /**
   * Notify all relevant subscribers of a status update
   */
  private notifySubscribers(update: StatusUpdate): void {
    let notifiedCount = 0;
    
    for (const subscription of this.subscriptions.values()) {
      if (subscription.isActive && this.shouldNotifySubscriber(subscription, update)) {
        try {
          subscription.callback(update);
          notifiedCount++;
        } catch (error) {
          console.error(`Error notifying subscriber ${subscription.id}:`, error);
        }
      }
    }
    
    if (notifiedCount > 0) {
      console.log(`Notified ${notifiedCount} subscribers of status update for server ${update.serverId}`);
    }
  }

  /**
   * Check if a subscriber should be notified of an update
   */
  private shouldNotifySubscriber(subscription: StatusSubscription, update: StatusUpdate): boolean {
    // If no filters, notify all
    if (!subscription.filters || subscription.filters.length === 0) {
      return true;
    }
    
    // Check each filter
    for (const filter of subscription.filters) {
      // Check server ID filter
      if (filter.serverIds && !filter.serverIds.includes(update.serverId)) {
        continue;
      }
      
      // Check status state filter
      if (filter.statusStates && !filter.statusStates.includes(update.currentStatus.state)) {
        continue;
      }
      
      // Check health level filter
      if (filter.healthLevels && !filter.healthLevels.includes(update.currentStatus.health)) {
        continue;
      }
      
      // Check update type filter
      if (filter.type === 'status_change' && update.previousStatus.state === update.currentStatus.state) {
        continue;
      }
      
      if (filter.type === 'health_change' && update.previousStatus.health === update.currentStatus.health) {
        continue;
      }
      
      if (filter.type === 'error_state' && update.currentStatus.health !== 'unhealthy') {
        continue;
      }
      
      if (filter.type === 'recovery' && (update.previousStatus.health !== 'unhealthy' || update.currentStatus.health === 'unhealthy')) {
        continue;
      }
      
      // If we get here, the filter matches
      return true;
    }
    
    return false;
  }

  /**
   * Log status changes for audit trail
   */
  private async logStatusChange(update: StatusUpdate): Promise<void> {
    try {
      await this.supabase
        .from('mcp_server_status_logs')
        .insert({
          server_id: update.serverId,
          previous_status: update.previousStatus,
          current_status: update.currentStatus,
          timestamp: update.timestamp.toISOString(),
          source: update.source,
          details: update.details
        });
    } catch (error) {
      console.error('Failed to log status change:', error);
      // Don't throw - logging failures shouldn't break the main operation
    }
  }

  /**
   * Compare two status objects for equality
   */
  private statusesEqual(status1: MCPServerStatus, status2: MCPServerStatus): boolean {
    return status1.state === status2.state && 
           status1.health === status2.health;
  }

  /**
   * Get all running MCP servers
   */
  private async getRunningMCPServers(): Promise<EnhancedMCPServer[]> {
    return this.getServersByStatus('running');
  }

  /**
   * Get all MCP servers
   */
  private async getAllMCPServers(): Promise<EnhancedMCPServer[]> {
    const { data, error } = await this.supabase
      .from('account_tool_instances')
      .select(`
        id,
        instance_name_on_toolbox,
        status_on_toolbox,
        last_heartbeat_from_dtma,
        created_at,
        updated_at,
        mcp_server_type,
        mcp_transport_type,
        mcp_endpoint_path,
        mcp_server_capabilities,
        mcp_discovery_metadata,
        account_tool_environment:account_tool_environments(
          id,
          name,
          public_ip_address,
          region_slug,
          size_slug
        )
      `)
      .not('mcp_server_type', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch MCP servers: ${error.message}`);
    }

    return (data || []).map(this.transformToEnhancedMCPServer.bind(this));
  }

  /**
   * Get MCP server by ID
   */
  private async getMCPServerById(serverId: string): Promise<EnhancedMCPServer | null> {
    const { data, error } = await this.supabase
      .from('account_tool_instances')
      .select(`
        id,
        instance_name_on_toolbox,
        status_on_toolbox,
        last_heartbeat_from_dtma,
        created_at,
        updated_at,
        mcp_server_type,
        mcp_transport_type,
        mcp_endpoint_path,
        mcp_server_capabilities,
        mcp_discovery_metadata,
        account_tool_environment:account_tool_environments(
          id,
          name,
          public_ip_address,
          region_slug,
          size_slug
        )
      `)
      .eq('id', serverId)
      .not('mcp_server_type', 'is', null)
      .single();

    if (error) {
      return null;
    }

    return this.transformToEnhancedMCPServer(data);
  }

  /**
   * Start WebSocket heartbeat
   */
  private startWebSocketHeartbeat(): void {
    this.wsHeartbeatInterval = setInterval(() => {
      if (this.wsConnection?.readyState === WebSocket.OPEN) {
        this.wsConnection.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop WebSocket heartbeat
   */
  private stopWebSocketHeartbeat(): void {
    if (this.wsHeartbeatInterval) {
      clearInterval(this.wsHeartbeatInterval);
      this.wsHeartbeatInterval = null;
    }
  }

  /**
   * Schedule WebSocket reconnection with exponential backoff
   */
  private scheduleWebSocketReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.isRunning) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      setTimeout(() => {
        this.reconnectAttempts++;
        console.log(`Attempting WebSocket reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.reconnectWebSocket();
      }, delay);
    }
  }

  /**
   * Publish status update to WebSocket subscribers
   */
  public publishStatusUpdate(topic: string, data: any): void {
    if (this.wsConnection?.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify({
        type: 'publish',
        topic: topic,
        data: data,
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * Get WebSocket connection status
   */
  public getWebSocketStatus(): 'connected' | 'connecting' | 'disconnected' | 'error' {
    if (!this.wsConnection) return 'disconnected';
    
    switch (this.wsConnection.readyState) {
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'error';
    }
  }
} 