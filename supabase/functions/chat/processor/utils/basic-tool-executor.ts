/**
 * Basic Tool Execution Handler
 * Handles individual tool execution without retry logic
 */

import type { FunctionCallingManager } from '../../function_calling/manager.ts';
import type { ToolDetail, ToolCall, ToolExecutionContext } from './tool-execution-types.ts';
import { createLogger } from '../../../shared/utils/logger.ts';

const logger = createLogger('BasicToolExecutor');

export class BasicToolExecutor {
  /**
   * Execute a single tool call
   */
  static async executeSingleTool(
    toolCall: ToolCall,
    fcm: FunctionCallingManager,
    context: ToolExecutionContext
  ): Promise<ToolDetail> {
    const started = Date.now();
    
    try {
      // Parse arguments - handle both string and object formats
      let args: Record<string, any> = {};
      if (toolCall.function?.arguments) {
        if (typeof toolCall.function.arguments === 'string') {
          args = JSON.parse(toolCall.function.arguments);
        } else if (typeof toolCall.function.arguments === 'object') {
          args = toolCall.function.arguments;
        }
      }
      
      const result = await fcm.executeFunction(
        context.agent_id || '', 
        context.user_id || '', 
        toolCall.function.name, 
        args
      );
      
      // Check if this tool needs retry - prioritize explicit requires_retry flag from edge functions
      const explicitRetryFlag = result.requires_retry === true;
      const isMCPQuestion = !result.success && 
        result.error && 
        (result.error.toLowerCase().includes('question:') || 
         result.error.toLowerCase().includes('what') ||
         result.error.toLowerCase().includes('please provide') ||
         result.error.toLowerCase().includes('missing') ||
         result.error.toLowerCase().includes('required field') ||
         result.error.toLowerCase().includes('search value'));
      
      // Use explicit retry flag if set, otherwise fall back to heuristic detection
      const needsRetry = explicitRetryFlag || isMCPQuestion;
      
      // DEBUG: Retry detection details
      logger.debug(`Tool ${toolCall.function.name} - success: ${result.success}, needs_retry: ${needsRetry}`);
      
      if (needsRetry) {
        console.log(`[BasicToolExecutor] 🔄 Tool ${toolCall.function.name} FLAGGED FOR RETRY - will be processed in retry loop`);
      }
      
      return {
        name: toolCall.function.name,
        execution_time_ms: Date.now() - started,
        success: !!result.success,
        input_params: args,
        output_result: result.data || null,
        error: result.success ? undefined : result.error,
        requires_retry: needsRetry
      };
      
    } catch (err: any) {
      console.error(`[BasicToolExecutor] Exception executing ${toolCall.function.name}:`, err);
      
      return {
        name: toolCall.function?.name,
        execution_time_ms: Date.now() - started,
        success: false,
        input_params: {},
        output_result: null,
        error: err?.message || 'Tool execution error',
        requires_retry: false
      };
    }
  }

  /**
   * Execute multiple tool calls in sequence
   */
  static async executeToolCalls(
    toolCalls: ToolCall[],
    fcm: FunctionCallingManager,
    context: ToolExecutionContext
  ): Promise<ToolDetail[]> {
    logger.debug(`Executing ${toolCalls.length} tool call(s)`);
    
    const toolDetails: ToolDetail[] = [];
    
    for (const toolCall of toolCalls) {
      const detail = await this.executeSingleTool(toolCall, fcm, context);
      toolDetails.push(detail);
    }
    
    return toolDetails;
  }

  /**
   * Format tool results for conversation messages
   */
  static async formatToolResults(
    toolDetails: ToolDetail[],
    fcm: FunctionCallingManager,
    msgs: any[]
  ): Promise<void> {
    for (const detail of toolDetails) {
      // Create a mock result object for formatting
      const mockResult = {
        success: detail.success,
        data: detail.output_result,
        error: detail.error
      };
      
      const formattedContent = await fcm.formatResult(detail.name, mockResult);
      
      msgs.push({
        role: 'tool',
        content: formattedContent,
        tool_call_id: `${detail.name}_${Date.now()}`,
      });
    }
  }
}
