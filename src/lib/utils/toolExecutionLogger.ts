/**
 * Tool Execution Logger Utility
 * Provides methods to emit tool execution logs that can be captured by the UI
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';
export type LogPhase = 'init' | 'validation' | 'execution' | 'result' | 'error';

export interface ToolLogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  details?: any;
  toolName?: string;
  phase?: LogPhase;
}

/**
 * Emit a tool execution log event
 */
export function emitToolLog(entry: Omit<ToolLogEntry, 'timestamp'>) {
  const event = new CustomEvent('tool-execution-log', {
    detail: {
      ...entry,
      timestamp: new Date()
    }
  });
  
  window.dispatchEvent(event);
}

/**
 * Convenience methods for different log levels
 */
export const toolLogger = {
  info: (message: string, details?: any, toolName?: string, phase?: LogPhase) => {
    emitToolLog({ level: 'info', message, details, toolName, phase });
  },
  
  warn: (message: string, details?: any, toolName?: string, phase?: LogPhase) => {
    emitToolLog({ level: 'warn', message, details, toolName, phase });
  },
  
  error: (message: string, details?: any, toolName?: string, phase?: LogPhase) => {
    emitToolLog({ level: 'error', message, details, toolName, phase });
  },
  
  success: (message: string, details?: any, toolName?: string, phase?: LogPhase) => {
    emitToolLog({ level: 'success', message, details, toolName, phase });
  },
  
  debug: (message: string, details?: any, toolName?: string, phase?: LogPhase) => {
    emitToolLog({ level: 'debug', message, details, toolName, phase });
  },
  
  // Log a tool execution start
  startTool: (toolName: string, parameters?: any) => {
    emitToolLog({
      level: 'info',
      message: `Starting ${toolName} execution`,
      details: { parameters },
      toolName,
      phase: 'init'
    });
  },
  
  // Log tool validation
  validateTool: (toolName: string, result: boolean, details?: any) => {
    emitToolLog({
      level: result ? 'info' : 'warn',
      message: result ? `Validation passed for ${toolName}` : `Validation failed for ${toolName}`,
      details,
      toolName,
      phase: 'validation'
    });
  },
  
  // Log tool execution progress
  executingTool: (toolName: string, step: string, details?: any) => {
    emitToolLog({
      level: 'info',
      message: `${toolName}: ${step}`,
      details,
      toolName,
      phase: 'execution'
    });
  },
  
  // Log tool success
  toolSuccess: (toolName: string, result?: any, executionTime?: number) => {
    emitToolLog({
      level: 'success',
      message: `${toolName} completed successfully${executionTime ? ` in ${executionTime}ms` : ''}`,
      details: { result, executionTime },
      toolName,
      phase: 'result'
    });
  },
  
  // Log tool error
  toolError: (toolName: string, error: any, executionTime?: number) => {
    emitToolLog({
      level: 'error',
      message: `${toolName} failed: ${error.message || error}`,
      details: { 
        error: error.stack || error,
        executionTime,
        errorCode: error.code,
        errorDetails: error.details
      },
      toolName,
      phase: 'error'
    });
  }
};

/**
 * Parse backend console logs and emit them as tool logs
 * This can be used to capture and display backend logs in real-time
 */
export function parseBackendLog(logLine: string, toolName?: string) {
  // Try to parse structured logs
  try {
    // Check if it's a JSON log
    if (logLine.startsWith('{') && logLine.endsWith('}')) {
      const parsed = JSON.parse(logLine);
      if (parsed.level && parsed.message) {
        emitToolLog({
          level: parsed.level as LogLevel,
          message: parsed.message,
          details: parsed.details,
          toolName: toolName || parsed.toolName,
          phase: parsed.phase as LogPhase
        });
        return;
      }
    }
  } catch {
    // Not JSON, continue with text parsing
  }
  
  // Parse text logs
  const lowerLog = logLine.toLowerCase();
  let level: LogLevel = 'info';
  
  if (lowerLog.includes('error') || lowerLog.includes('failed')) {
    level = 'error';
  } else if (lowerLog.includes('warn') || lowerLog.includes('warning')) {
    level = 'warn';
  } else if (lowerLog.includes('success') || lowerLog.includes('completed')) {
    level = 'success';
  } else if (lowerLog.includes('debug')) {
    level = 'debug';
  }
  
  emitToolLog({
    level,
    message: logLine,
    toolName,
    phase: 'execution'
  });
}

export default toolLogger; 