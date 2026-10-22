/**
 * Tool Executor V2 - Clean, Modular Implementation
 * Main entry point for tool execution with intelligent retry system
 */

import type { FunctionCallingManager } from '../../function_calling/manager.ts';
import type { ToolExecutionResult, ToolExecutionContext, ExecutionEnvironment } from './tool-execution-types.ts';
import { ToolExecutionOrchestrator } from './tool-execution-orchestrator.ts';

export class ToolExecutor {
  /**
   * Execute all tool calls from completion and handle intelligent retry pattern
   */
  static async executeToolCalls(
    toolCalls: any[],
    msgs: any[],
    fcm: FunctionCallingManager,
    context: { agent_id?: string; user_id?: string },
    availableTools: any[],
    openai: any,
    router: any,
    useRouter: boolean,
    normalizeToolsFn: (tools: any[]) => any[]
  ): Promise<ToolExecutionResult> {
    
    // Create execution context
    const executionContext: ToolExecutionContext = {
      agent_id: context.agent_id,
      user_id: context.user_id
    };

    // Create execution environment
    const environment: ExecutionEnvironment = {
      openai,
      router,
      useRouter,
      normalizeToolsFn,
      availableTools
    };

    // Delegate to orchestrator
    return await ToolExecutionOrchestrator.executeToolCalls(
      toolCalls,
      msgs,
      fcm,
      executionContext,
      environment
    );
  }
}
