// Logger Utility
// Structured logging for the chat system

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogContext {
  request_id?: string;
  user_id?: string;
  agent_id?: string;
  operation?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class Logger {
  private static instance: Logger;
  private level: LogLevel;
  private context: LogContext;
  
  constructor(level: LogLevel = LogLevel.INFO, context: LogContext = {}) {
    this.level = level;
    this.context = context;
  }
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  static create(context: LogContext): Logger {
    return new Logger(Logger.instance?.level || LogLevel.INFO, context);
  }
  
  setLevel(level: LogLevel): void {
    this.level = level;
  }
  
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }
  
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }
  
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }
  
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }
  
  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context, error);
  }
  
  fatal(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.FATAL, message, context, error);
  }
  
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    if (level < this.level) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
    };
    
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    
    this.output(entry);
  }
  
  private output(entry: LogEntry): void {
    const levelName = LogLevel[entry.level];
    const formatted = JSON.stringify(entry, null, 2);
    
    switch (entry.level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(`[${levelName}] ${entry.message}`, formatted);
        break;
      case LogLevel.WARN:
        console.warn(`[${levelName}] ${entry.message}`, formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(`[${levelName}] ${entry.message}`, formatted);
        break;
    }
  }
}

// Global logger instance
export const logger = Logger.getInstance();

// Convenience functions
export function createLogger(context: LogContext): Logger {
  return Logger.create(context);
}

export function logTiming<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const start = Date.now();
  const log = createLogger({ operation, ...context });
  
  log.debug(`Starting ${operation}`);
  
  return fn()
    .then(result => {
      const duration = Date.now() - start;
      log.info(`Completed ${operation}`, { duration_ms: duration });
      return result;
    })
    .catch(error => {
      const duration = Date.now() - start;
      log.error(`Failed ${operation}`, error, { duration_ms: duration });
      throw error;
    });
}