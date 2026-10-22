// Monitoring System Component
// Tracks performance, errors, usage, and system health

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';

// ============================
// Interfaces
// ============================

export interface Metric {
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels?: Record<string, string>;
  timestamp?: string;
}

export interface Timer {
  stop(): number;
  cancel(): void;
}

export interface ErrorContext {
  user_id?: string;
  agent_id?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

export interface UsageStats {
  feature: string;
  count: number;
  unique_users: number;
  unique_agents: number;
  time_range: {
    start: string;
    end: string;
  };
  breakdown?: Record<string, number>;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, HealthCheckResult>;
  timestamp: string;
}

export interface HealthCheckResult {
  status: 'ok' | 'warning' | 'error';
  message?: string;
  latency_ms?: number;
  metadata?: Record<string, any>;
}

export interface HealthMetrics {
  uptime_seconds: number;
  memory_usage_mb: number;
  cpu_usage_percent: number;
  active_connections: number;
  queue_depth: number;
  error_rate: number;
  response_time_p50: number;
  response_time_p95: number;
  response_time_p99: number;
}

export interface PerformanceStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface TrackedError {
  id: string;
  timestamp: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  context?: ErrorContext;
  fingerprint: string;
}

export interface ErrorPattern {
  pattern: string;
  count: number;
  first_seen: string;
  last_seen: string;
  fingerprints: string[];
}

// ============================
// Monitoring System Implementation
// ============================

export class MonitoringSystem {
  private collector: MetricsCollector;
  private performanceMonitor: PerformanceMonitor;
  private errorTracker: ErrorTracker;
  private usageTracker: UsageTracker;
  private healthMonitor: HealthMonitor;
  private alerting: AlertingSystem;
  
  constructor(
    private supabase: SupabaseClient,
    private config: {
      metrics_buffer_size?: number;
      export_interval?: number;
      error_sample_rate?: number;
      health_check_interval?: number;
    }
  ) {
    this.collector = new MetricsCollector(supabase, config);
    this.performanceMonitor = new PerformanceMonitor();
    this.errorTracker = new ErrorTracker(config.error_sample_rate || 1.0);
    this.usageTracker = new UsageTracker(supabase);
    this.healthMonitor = new HealthMonitor(supabase);
    this.alerting = new AlertingSystem(supabase);
    
    // Start periodic health checks
    if (config.health_check_interval) {
      setInterval(() => this.checkHealth(), config.health_check_interval);
    }
  }
  
  /**
   * Record a metric
   */
  record(metric: Metric): void {
    this.collector.record(metric);
  }
  
  /**
   * Record multiple metrics
   */
  recordBatch(metrics: Metric[]): void {
    metrics.forEach(m => this.record(m));
  }
  
  /**
   * Start a timer for an operation
   */
  startTimer(operation: string): Timer {
    const start = Date.now();
    let stopped = false;
    
    return {
      stop: () => {
        if (stopped) return 0;
        stopped = true;
        
        const duration = Date.now() - start;
        this.trackLatency(operation, duration);
        return duration;
      },
      cancel: () => {
        stopped = true;
      },
    };
  }
  
  /**
   * Track latency for an operation
   */
  trackLatency(operation: string, duration: number): void {
    this.performanceMonitor.trackOperation(operation, duration);
    
    this.record({
      name: `${operation}_duration_ms`,
      value: duration,
      type: 'histogram',
      labels: { operation },
    });
  }
  
  /**
   * Capture an error
   */
  captureError(error: Error, context?: ErrorContext): void {
    this.errorTracker.track(error, context);
    
    this.record({
      name: 'errors_total',
      value: 1,
      type: 'counter',
      labels: {
        error_type: error.name,
        operation: context?.operation || 'unknown',
      },
    });
    
    // Check if alerting needed
    const errorRate = this.trackErrorRate(context?.operation || 'global');
    if (errorRate > 0.05) { // 5% error rate
      this.alerting.trigger('high_error_rate', {
        operation: context?.operation,
        rate: errorRate,
        error: error.message,
      });
    }
  }
  
  /**
   * Track error rate for an operation
   */
  trackErrorRate(operation: string): number {
    return this.errorTracker.getErrorRate(operation);
  }
  
  /**
   * Track feature usage
   */
  trackUsage(feature: string, metadata?: any): void {
    this.usageTracker.track(feature, metadata);
    
    this.record({
      name: 'feature_usage',
      value: 1,
      type: 'counter',
      labels: { feature },
    });
  }
  
  /**
   * Get usage statistics
   */
  async getUsageStats(
    timeframe: { start: string; end: string }
  ): Promise<UsageStats[]> {
    return this.usageTracker.getStats(timeframe);
  }
  
  /**
   * Check system health
   */
  async checkHealth(): Promise<HealthStatus> {
    const status = await this.healthMonitor.checkHealth();
    
    // Record health metrics
    this.record({
      name: 'health_status',
      value: status.status === 'healthy' ? 1 : 0,
      type: 'gauge',
    });
    
    // Alert on unhealthy status
    if (status.status !== 'healthy') {
      this.alerting.trigger('unhealthy_system', {
        status: status.status,
        failing_checks: Object.entries(status.checks)
          .filter(([_, result]) => result.status !== 'ok')
          .map(([name]) => name),
      });
    }
    
    return status;
  }
  
  /**
   * Get health metrics
   */
  async getHealthMetrics(): Promise<HealthMetrics> {
    return this.healthMonitor.getMetrics();
  }
  
  /**
   * Get performance statistics
   */
  getPerformanceStats(operation: string): PerformanceStats {
    return this.performanceMonitor.getStats(operation);
  }
  
  /**
   * Export metrics (for external systems)
   */
  async exportMetrics(): Promise<Metric[]> {
    return this.collector.export();
  }
  
  /**
   * Flush all buffers
   */
  async flush(): Promise<void> {
    await this.collector.flush();
    await this.usageTracker.flush();
  }
}

// ============================
// Metrics Collector
// ============================

class MetricsCollector {
  private buffers: Map<string, MetricBuffer> = new Map();
  private exporters: MetricExporter[] = [];
  private lastExport = Date.now();
  
  constructor(
    private supabase: SupabaseClient,
    private config: {
      metrics_buffer_size?: number;
      export_interval?: number;
    }
  ) {
    // Add default exporters
    this.exporters.push(new ConsoleExporter());
    this.exporters.push(new SupabaseExporter(supabase));
    
    // Periodic export
    setInterval(() => this.autoExport(), config.export_interval || 60000);
  }
  
  record(metric: Metric): void {
    const key = this.getMetricKey(metric);
    
    if (!this.buffers.has(key)) {
      this.buffers.set(key, new MetricBuffer(
        this.config.metrics_buffer_size || 1000
      ));
    }
    
    const buffer = this.buffers.get(key)!;
    buffer.add(metric);
    
    if (buffer.isFull()) {
      this.exportBuffer(key, buffer);
    }
  }
  
  async export(): Promise<Metric[]> {
    const allMetrics: Metric[] = [];
    
    for (const [key, buffer] of this.buffers) {
      allMetrics.push(...buffer.getAll());
    }
    
    return allMetrics;
  }
  
  async flush(): Promise<void> {
    for (const [key, buffer] of this.buffers) {
      if (buffer.size() > 0) {
        await this.exportBuffer(key, buffer);
      }
    }
  }
  
  private getMetricKey(metric: Metric): string {
    const labels = metric.labels ? JSON.stringify(metric.labels) : '';
    return `${metric.name}:${metric.type}:${labels}`;
  }
  
  private async exportBuffer(key: string, buffer: MetricBuffer): Promise<void> {
    const metrics = buffer.flush();
    
    if (metrics.length === 0) return;
    
    await Promise.all(
      this.exporters.map(exporter => 
        exporter.export(metrics).catch(err => 
          console.error(`Export failed for ${exporter.constructor.name}:`, err)
        )
      )
    );
  }
  
  private async autoExport(): Promise<void> {
    const now = Date.now();
    
    if (now - this.lastExport < (this.config.export_interval || 60000)) {
      return;
    }
    
    this.lastExport = now;
    await this.flush();
  }
}

class MetricBuffer {
  private metrics: Metric[] = [];
  
  constructor(private maxSize: number) {}
  
  add(metric: Metric): void {
    if (!metric.timestamp) {
      metric.timestamp = new Date().toISOString();
    }
    
    this.metrics.push(metric);
    
    if (this.metrics.length > this.maxSize) {
      this.metrics.shift();
    }
  }
  
  flush(): Metric[] {
    const flushed = [...this.metrics];
    this.metrics = [];
    return flushed;
  }
  
  getAll(): Metric[] {
    return [...this.metrics];
  }
  
  size(): number {
    return this.metrics.length;
  }
  
  isFull(): boolean {
    return this.metrics.length >= this.maxSize;
  }
}

interface MetricExporter {
  export(metrics: Metric[]): Promise<void>;
}

class ConsoleExporter implements MetricExporter {
  async export(metrics: Metric[]): Promise<void> {
    console.log(`[Metrics] Exporting ${metrics.length} metrics`);
  }
}

class SupabaseExporter implements MetricExporter {
  constructor(private supabase: SupabaseClient) {}
  
  async export(metrics: Metric[]): Promise<void> {
    const { error } = await this.supabase
      .from('system_metrics')
      .insert(metrics);
    
    if (error) {
      console.error('[Metrics] Supabase export failed:', error);
    }
  }
}

// ============================
// Performance Monitor
// ============================

class PerformanceMonitor {
  private histograms: Map<string, Histogram> = new Map();
  private thresholds: Map<string, number> = new Map([
    ['chat_message', 1000],      // 1 second
    ['memory_search', 500],       // 500ms
    ['state_update', 200],        // 200ms
    ['tool_execution', 5000],     // 5 seconds
  ]);
  
  trackOperation(name: string, duration: number): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, new Histogram());
    }
    
    const histogram = this.histograms.get(name)!;
    histogram.record(duration);
  }
  
  getStats(operation: string): PerformanceStats {
    const histogram = this.histograms.get(operation);
    
    if (!histogram) {
      return {
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }
    
    return histogram.getStats();
  }
  
  getThreshold(operation: string): number {
    return this.thresholds.get(operation) || 1000;
  }
}

class Histogram {
  private values: number[] = [];
  
  record(value: number): void {
    this.values.push(value);
    
    // Keep last 10000 values
    if (this.values.length > 10000) {
      this.values.shift();
    }
  }
  
  getStats(): PerformanceStats {
    if (this.values.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }
    
    const sorted = [...this.values].sort((a, b) => a - b);
    const count = sorted.length;
    
    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      mean: sorted.reduce((sum, v) => sum + v, 0) / count,
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
    };
  }
  
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }
}

// ============================
// Error Tracker
// ============================

class ErrorTracker {
  private errors: CircularBuffer<TrackedError>;
  private errorRates: Map<string, RateTracker> = new Map();
  private patterns: Map<string, ErrorPattern> = new Map();
  
  constructor(private sampleRate: number) {
    this.errors = new CircularBuffer(10000);
  }
  
  track(error: Error, context?: ErrorContext): void {
    // Sample errors
    if (Math.random() > this.sampleRate) return;
    
    const tracked: TrackedError = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
      fingerprint: this.fingerprint(error),
    };
    
    this.errors.add(tracked);
    
    // Update error rate
    const operation = context?.operation || 'global';
    if (!this.errorRates.has(operation)) {
      this.errorRates.set(operation, new RateTracker());
    }
    this.errorRates.get(operation)!.record();
    
    // Update patterns
    this.updatePattern(tracked);
  }
  
  getErrorRate(operation: string): number {
    const tracker = this.errorRates.get(operation);
    return tracker ? tracker.getRate() : 0;
  }
  
  getRecentErrors(limit: number = 100): TrackedError[] {
    return this.errors.getRecent(limit);
  }
  
  getPatterns(): ErrorPattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.count - a.count);
  }
  
  private fingerprint(error: Error): string {
    const key = `${error.name}:${error.message}:${this.normalizeStack(error.stack)}`;
    
    // Simple hash
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(16);
  }
  
  private normalizeStack(stack?: string): string {
    if (!stack) return '';
    
    // Remove line numbers and file paths
    return stack
      .split('\n')
      .map(line => line.replace(/:\d+:\d+/g, '').replace(/\(.*\)/g, ''))
      .join('\n');
  }
  
  private updatePattern(error: TrackedError): void {
    const pattern = this.identifyPattern(error);
    
    if (!this.patterns.has(pattern)) {
      this.patterns.set(pattern, {
        pattern,
        count: 0,
        first_seen: error.timestamp,
        last_seen: error.timestamp,
        fingerprints: [],
      });
    }
    
    const p = this.patterns.get(pattern)!;
    p.count++;
    p.last_seen = error.timestamp;
    
    if (!p.fingerprints.includes(error.fingerprint)) {
      p.fingerprints.push(error.fingerprint);
    }
  }
  
  private identifyPattern(error: TrackedError): string {
    // Simple pattern identification
    if (error.error.message.includes('timeout')) return 'timeout_errors';
    if (error.error.message.includes('rate limit')) return 'rate_limit_errors';
    if (error.error.message.includes('validation')) return 'validation_errors';
    if (error.error.message.includes('network')) return 'network_errors';
    if (error.error.message.includes('database')) return 'database_errors';
    
    return 'other_errors';
  }
}

class CircularBuffer<T> {
  private buffer: T[] = [];
  private index = 0;
  
  constructor(private size: number) {}
  
  add(item: T): void {
    if (this.buffer.length < this.size) {
      this.buffer.push(item);
    } else {
      this.buffer[this.index] = item;
      this.index = (this.index + 1) % this.size;
    }
  }
  
  getRecent(limit: number): T[] {
    const items: T[] = [];
    const start = this.buffer.length < this.size ? 0 : this.index;
    
    for (let i = 0; i < Math.min(limit, this.buffer.length); i++) {
      const idx = (start + this.buffer.length - i - 1) % this.buffer.length;
      items.push(this.buffer[idx]);
    }
    
    return items;
  }
}

class RateTracker {
  private windows: Map<number, number> = new Map();
  private windowSize = 60000; // 1 minute windows
  
  record(): void {
    const now = Date.now();
    const window = Math.floor(now / this.windowSize);
    
    this.windows.set(window, (this.windows.get(window) || 0) + 1);
    
    // Clean old windows
    const oldWindow = window - 5;
    for (const [w] of this.windows) {
      if (w < oldWindow) {
        this.windows.delete(w);
      }
    }
  }
  
  getRate(): number {
    const now = Date.now();
    const currentWindow = Math.floor(now / this.windowSize);
    const count = this.windows.get(currentWindow) || 0;
    
    return count / (this.windowSize / 1000); // Per second
  }
}

// ============================
// Usage Tracker
// ============================

class UsageTracker {
  private buffer: Map<string, UsageEvent[]> = new Map();
  
  constructor(private supabase: SupabaseClient) {}
  
  track(feature: string, metadata?: any): void {
    if (!this.buffer.has(feature)) {
      this.buffer.set(feature, []);
    }
    
    this.buffer.get(feature)!.push({
      timestamp: new Date().toISOString(),
      user_id: metadata?.user_id,
      agent_id: metadata?.agent_id,
      metadata,
    });
  }
  
  async getStats(timeframe: { start: string; end: string }): Promise<UsageStats[]> {
    const stats: UsageStats[] = [];
    
    for (const [feature, events] of this.buffer) {
      const filtered = events.filter(e => 
        e.timestamp >= timeframe.start && e.timestamp <= timeframe.end
      );
      
      const uniqueUsers = new Set(filtered.map(e => e.user_id).filter(Boolean));
      const uniqueAgents = new Set(filtered.map(e => e.agent_id).filter(Boolean));
      
      stats.push({
        feature,
        count: filtered.length,
        unique_users: uniqueUsers.size,
        unique_agents: uniqueAgents.size,
        time_range: timeframe,
      });
    }
    
    return stats;
  }
  
  async flush(): Promise<void> {
    const allEvents: any[] = [];
    
    for (const [feature, events] of this.buffer) {
      allEvents.push(...events.map(e => ({
        feature,
        ...e,
      })));
    }
    
    if (allEvents.length > 0) {
      await this.supabase
        .from('usage_events')
        .insert(allEvents);
      
      this.buffer.clear();
    }
  }
}

interface UsageEvent {
  timestamp: string;
  user_id?: string;
  agent_id?: string;
  metadata?: any;
}

// ============================
// Health Monitor
// ============================

class HealthMonitor {
  private checks: Map<string, HealthCheck> = new Map();
  private startTime = Date.now();
  
  constructor(private supabase: SupabaseClient) {
    // Register default checks
    this.checks.set('database', new DatabaseHealthCheck(supabase));
    this.checks.set('memory', new MemoryHealthCheck());
    this.checks.set('api', new APIHealthCheck());
  }
  
  async checkHealth(): Promise<HealthStatus> {
    const results: Record<string, HealthCheckResult> = {};
    
    await Promise.all(
      Array.from(this.checks.entries()).map(async ([name, check]) => {
        try {
          results[name] = await check.execute();
        } catch (error) {
          results[name] = {
            status: 'error',
            message: error instanceof Error ? error.message : 'Check failed',
          };
        }
      })
    );
    
    const overallStatus = this.calculateOverallStatus(results);
    
    return {
      status: overallStatus,
      checks: results,
      timestamp: new Date().toISOString(),
    };
  }
  
  async getMetrics(): Promise<HealthMetrics> {
    const memoryUsage = process.memoryUsage();
    
    return {
      uptime_seconds: (Date.now() - this.startTime) / 1000,
      memory_usage_mb: memoryUsage.heapUsed / 1024 / 1024,
      cpu_usage_percent: 0, // Would need actual CPU monitoring
      active_connections: 0, // Would need connection tracking
      queue_depth: 0, // Would need queue monitoring
      error_rate: 0, // Would get from error tracker
      response_time_p50: 0, // Would get from performance monitor
      response_time_p95: 0,
      response_time_p99: 0,
    };
  }
  
  private calculateOverallStatus(
    results: Record<string, HealthCheckResult>
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(results).map(r => r.status);
    
    if (statuses.some(s => s === 'error')) {
      return 'unhealthy';
    }
    
    if (statuses.some(s => s === 'warning')) {
      return 'degraded';
    }
    
    return 'healthy';
  }
}

abstract class HealthCheck {
  abstract execute(): Promise<HealthCheckResult>;
}

class DatabaseHealthCheck extends HealthCheck {
  constructor(private supabase: SupabaseClient) {
    super();
  }
  
  async execute(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      const { error } = await this.supabase
        .from('system_health')
        .select('id')
        .limit(1);
      
      if (error) throw error;
      
      const latency = Date.now() - start;
      
      return {
        status: latency < 100 ? 'ok' : 'warning',
        latency_ms: latency,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Database unreachable',
      };
    }
  }
}

class MemoryHealthCheck extends HealthCheck {
  async execute(): Promise<HealthCheckResult> {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const percentage = (heapUsedMB / heapTotalMB) * 100;
    
    return {
      status: percentage > 90 ? 'warning' : 'ok',
      metadata: {
        heap_used_mb: heapUsedMB,
        heap_total_mb: heapTotalMB,
        percentage,
      },
    };
  }
}

class APIHealthCheck extends HealthCheck {
  async execute(): Promise<HealthCheckResult> {
    // Check if API is responsive
    // This would check actual API endpoints
    return {
      status: 'ok',
      latency_ms: 50,
    };
  }
}

// ============================
// Alerting System
// ============================

class AlertingSystem {
  private alerts: Map<string, Alert> = new Map();
  
  constructor(private supabase: SupabaseClient) {}
  
  trigger(alert_type: string, context: any): void {
    const alert: Alert = {
      id: crypto.randomUUID(),
      type: alert_type,
      severity: this.getSeverity(alert_type),
      message: this.formatMessage(alert_type, context),
      context,
      triggered_at: new Date().toISOString(),
    };
    
    this.alerts.set(alert.id, alert);
    
    // Send alert
    this.sendAlert(alert);
  }
  
  private getSeverity(alert_type: string): 'info' | 'warning' | 'critical' {
    const severities: Record<string, 'info' | 'warning' | 'critical'> = {
      high_latency: 'warning',
      high_error_rate: 'critical',
      unhealthy_system: 'critical',
      memory_pressure: 'warning',
    };
    
    return severities[alert_type] || 'info';
  }
  
  private formatMessage(alert_type: string, context: any): string {
    switch (alert_type) {
      case 'high_latency':
        return `High latency detected: ${context.operation} took ${context.duration}ms`;
      case 'high_error_rate':
        return `High error rate: ${context.rate} for ${context.operation}`;
      case 'unhealthy_system':
        return `System unhealthy: ${context.failing_checks.join(', ')} failing`;
      default:
        return `Alert: ${alert_type}`;
    }
  }
  
  private async sendAlert(alert: Alert): Promise<void> {
    // Store in database
    await this.supabase
      .from('system_alerts')
      .insert(alert);
    
    // In production, would also send to:
    // - Email
    // - Slack
    // - PagerDuty
    // - etc.
    
    console.error(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);
  }
}

interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  context: any;
  triggered_at: string;
}