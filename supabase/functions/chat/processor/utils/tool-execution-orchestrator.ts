/**
 * Tool Execution Orchestrator
 * Main coordinator for tool execution with intelligent retry system
 */

import type { FunctionCallingManager } from '../../function_calling/manager.ts';
import type { 
  ToolExecutionResult, 
  ToolCall, 
  ToolExecutionContext, 
  ExecutionEnvironment,
  TokenUsage 
} from './tool-execution-types.ts';
import { BasicToolExecutor } from './basic-tool-executor.ts';
import { RetryCoordinator } from './retry-coordinator.ts';
import { ConversationHandler } from './conversation-handler.ts';
import { createLogger } from '../../../shared/utils/logger.ts';

const logger = createLogger('ToolExecutionOrchestrator');

export class ToolExecutionOrchestrator {
  /**
   * Execute all tool calls with intelligent retry handling
   */
  static async executeToolCalls(
    toolCalls: any[],
    msgs: any[],
    fcm: FunctionCallingManager,
    context: ToolExecutionContext,
    environment: ExecutionEnvironment
  ): Promise<ToolExecutionResult> {
    // Single consolidated log for tool execution start
    const toolNames = toolCalls.map(tc => tc.function?.name || tc.name).join(', ');
    logger.info(`🚀 Executing ${toolCalls.length} tool(s): ${toolNames}`);
    
    let promptTokens = 0;
    let completionTokens = 0;
    
    if (toolCalls.length === 0) {
      console.log(`[ToolExecutionOrchestrator] No tool calls to execute, returning empty result`);
      return {
        toolDetails: [],
        msgs,
        tokensUsed: { prompt: 0, completion: 0, total: 0 }
      };
    }

    // Add assistant message with tool calls to conversation
    ConversationHandler.addAssistantToolCallMessage(msgs, toolCalls);

    // Execute all tool calls
    const toolDetails = await BasicToolExecutor.executeToolCalls(toolCalls, fcm, context);

    // Add tool results to conversation
    await ConversationHandler.addToolResults(msgs, toolDetails, toolCalls, fcm);

    // OPTIMIZATION: Skip retry processing if all tools succeeded
    const failedTools = toolDetails.filter(td => !td.success);
    let retryStats = { totalAttempts: 0, successfulRetries: 0, failedRetries: 0, requiresLLMRetry: false };
    
    if (failedTools.length > 0) {
      // Process intelligent retries only for failed tools
      logger.debug(`Processing retries for ${failedTools.length} failed tool(s)`);
      retryStats = await RetryCoordinator.processRetries(
        toolDetails,
        fcm,
        context,
        environment.openai,
        msgs
      );
    } else {
      logger.debug(`All tools succeeded, skipping retry checks`);
    }

    // Add retry summary to conversation (only if not requiring LLM retry)
    if (!retryStats.requiresLLMRetry) {
      ConversationHandler.addRetrySummary(
        msgs,
        retryStats.successfulRetries,
        retryStats.failedRetries,
        retryStats.totalAttempts
      );
    }

    // Log final execution summary
    this.logExecutionSummary(toolDetails, retryStats);

    return {
      toolDetails,
      msgs,
      tokensUsed: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens
      },
      requiresLLMRetry: retryStats.requiresLLMRetry,
      retryGuidanceAdded: retryStats.retryGuidanceAdded
    };
  }

  /**
   * Log execution summary
   */
  private static logExecutionSummary(
    toolDetails: any[],
    retryStats: { successfulRetries: number; failedRetries: number; totalAttempts: number }
  ): void {
    const totalTools = toolDetails.length;
    const successfulTools = toolDetails.filter(td => td.success).length;
    const failedTools = totalTools - successfulTools;
    
    // Consolidated execution summary (single log)
    logger.info(`📊 Summary: ${successfulTools}/${totalTools} succeeded, ${failedTools} failed, ${retryStats.totalAttempts} retries`);
    
    if (failedTools > 0) {
      const failedToolNames = toolDetails.filter(td => !td.success).map(td => td.name);
      console.log(`[ToolExecutionOrchestrator] Failed tools: ${failedToolNames.join(', ')}`);
    }
  }
}
