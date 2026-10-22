/**
 * Logging Utility with Level Support
 * Provides structured logging with configurable log levels
 * 
 * Usage:
 *   const logger = createLogger('MyComponent');
 *   logger.debug('Detailed info', { data });
 *   logger.info('Important milestone');
 *   logger.warn('Warning message');
 *   logger.error('Error occurred', error);
 * 
 * Environment Variables:
 *   LOG_LEVEL=DEBUG|INFO|WARN|ERROR (default: INFO)
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerConfig {
  level: LogLevel;
  context?: string;
}

export class Logger {
  private level: LogLevel;
  private context: string;

  constructor(config: LoggerConfig) {
    this.level = config.level;
    this.context = config.context || 'App';
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${this.context}]`;
    
    if (args.length > 0) {
      const argsStr = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      return `${prefix} ${message} ${argsStr}`;
    }
    
    return `${prefix} ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('DEBUG', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('INFO', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, ...args));
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message, ...args));
    }
  }
}

/**
 * Get current log level from environment
 */
export function getLogLevel(): LogLevel {
  const envLevel = (typeof Deno !== 'undefined' && Deno.env) 
    ? Deno.env.get('LOG_LEVEL')?.toUpperCase() 
    : 'INFO';
  
  switch (envLevel) {
    case 'DEBUG':
      return LogLevel.DEBUG;
    case 'INFO':
      return LogLevel.INFO;
    case 'WARN':
      return LogLevel.WARN;
    case 'ERROR':
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO; // Default to INFO
  }
}

/**
 * Create a logger instance with context
 */
export function createLogger(context: string): Logger {
  return new Logger({
    level: getLogLevel(),
    context,
  });
}

/**
 * Global logger instance (for backward compatibility)
 */
export const logger = createLogger('Global');
