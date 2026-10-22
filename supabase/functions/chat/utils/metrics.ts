// Metrics Utility
// Performance and usage metrics collection

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

export class Metrics {
  private static instance: Metrics;
  private metrics: Map<string, Metric[]> = new Map();
  private timers: Map<string, number> = new Map();
  
  static getInstance(): Metrics {
    if (!Metrics.instance) {
      Metrics.instance = new Metrics();
    }
    return Metrics.instance;
  }
  
  increment(
    name: string,
    labels?: Record<string, string>,
    value: number = 1
  ): void {
    this.record({
      name,
      value,
      type: 'counter',
      labels,
      timestamp: new Date().toISOString(),
    });
  }
  
  gauge(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    this.record({
      name,
      value,
      type: 'gauge',
      labels,
      timestamp: new Date().toISOString(),
    });
  }
  
  histogram(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    this.record({
      name,
      value,
      type: 'histogram',
      labels,
      timestamp: new Date().toISOString(),
    });
  }
  
  startTimer(name: string, labels?: Record<string, string>): Timer {
    const key = this.getKey(name, labels);
    const start = Date.now();
    
    this.timers.set(key, start);
    
    return {
      stop: () => {
        const duration = Date.now() - start;
        this.timers.delete(key);
        this.histogram(`${name}_duration_ms`, duration, labels);
        return duration;
      },
      cancel: () => {
        this.timers.delete(key);
      },
    };
  }
  
  async time<T>(
    name: string,
    fn: () => Promise<T>,
    labels?: Record<string, string>
  ): Promise<T> {
    const timer = this.startTimer(name, labels);
    
    try {
      const result = await fn();
      timer.stop();
      return result;
    } catch (error) {
      timer.stop();
      this.increment(`${name}_errors`, labels);
      throw error;
    }
  }
  
  record(metric: Metric): void {
    const key = this.getKey(metric.name, metric.labels);
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    this.metrics.get(key)!.push(metric);
    
    // Keep only last 1000 metrics per key
    const metrics = this.metrics.get(key)!;
    if (metrics.length > 1000) {
      metrics.shift();
    }
  }
  
  getMetrics(name?: string): Metric[] {
    if (name) {
      const results: Metric[] = [];
      
      for (const [key, metrics] of this.metrics) {
        if (key.startsWith(name)) {
          results.push(...metrics);
        }
      }
      
      return results;
    }
    
    const allMetrics: Metric[] = [];
    
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }
    
    return allMetrics;
  }
  
  getSummary(name: string): {
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
    p50?: number;
    p95?: number;
    p99?: number;
  } | null {
    const metrics = this.getMetrics(name);
    
    if (metrics.length === 0) return null;
    
    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count,
      sum,
      min: values[0],
      max: values[count - 1],
      avg: sum / count,
      p50: this.percentile(values, 0.5),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99),
    };
  }
  
  clear(): void {
    this.metrics.clear();
    this.timers.clear();
  }
  
  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    
    const sortedLabels = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    
    return `${name}{${sortedLabels}}`;
  }
  
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }
}

// Global metrics instance
export const metrics = Metrics.getInstance();

// Convenience decorators
export function timed(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function (...args: any[]) {
    const className = target.constructor.name;
    const metricName = `${className}.${propertyKey}`;
    
    return metrics.time(metricName, () => originalMethod.apply(this, args));
  };
  
  return descriptor;
}

export function counted(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function (...args: any[]) {
    const className = target.constructor.name;
    const metricName = `${className}.${propertyKey}_calls`;
    
    metrics.increment(metricName);
    
    try {
      return await originalMethod.apply(this, args);
    } catch (error) {
      metrics.increment(`${metricName}_errors`);
      throw error;
    }
  };
  
  return descriptor;
}