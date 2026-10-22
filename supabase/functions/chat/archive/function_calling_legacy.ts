/**
 * ARCHIVED: Function Calling Integration for Chat System - Legacy Wrapper
 * 
 * This file was archived on 2025-01-27 during the unified MCP architecture refactor.
 * It was causing duplicate export conflicts with the new function_calling/manager.ts structure.
 * 
 * Original purpose: Simplified interface that delegates to modular providers
 * Replaced by: ./function_calling/manager.ts (unified MCP tool discovery)
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { FunctionCallingManager } from './function_calling/manager.ts';

// Re-export types for backwards compatibility
export type { OpenAIFunction, OpenAIToolCall, MCPToolResult } from './function_calling/base.ts';

/**
 * Legacy FunctionCallingManager wrapper for backwards compatibility
 * Delegates to the new modular system
 */
export class FunctionCallingManagerLegacy {
  private manager: FunctionCallingManager;

  constructor(supabaseClient: SupabaseClient, authToken: string = '') {
    this.manager = new FunctionCallingManager(supabaseClient, authToken);
  }

  /**
   * Get available tools for an agent
   */
  async getAvailableTools(agentId: string, userId: string) {
    return await this.manager.getAvailableTools(agentId, userId);
  }

  /**
   * Execute a function call
   */
  async executeFunction(
    agentId: string,
    userId: string,
    functionName: string,
    parameters: Record<string, any>
  ) {
    return await this.manager.executeFunction(agentId, userId, functionName, parameters);
  }

  /**
   * Format tool execution result
   */
  async formatResult(functionName: string, result: any): Promise<string> {
    return await this.manager.formatResult(functionName, result);
  }

  /**
   * Clear caches
   */
  clearCaches(agentId: string, userId: string): void {
    this.manager.clearCaches(agentId, userId);
  }

  /**
   * Get execution statistics
   */
  getExecutionStats() {
    return this.manager.getExecutionStats();
  }
}

// Export the new manager directly
export { FunctionCallingManager };

// Export the legacy wrapper for backwards compatibility  
export { FunctionCallingManagerLegacy };

// Default export for backwards compatibility
export default FunctionCallingManagerLegacy;
