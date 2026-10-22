/**
 * Retry Coordinator
 * Orchestrates intelligent retry logic for failed tool executions
 * Implements MCP (Model Context Protocol) retry pattern
 */

import type { FunctionCallingManager } from '../../function_calling/manager.ts';
import { IntelligentRetrySystem, type ToolExecutionContext as RetryContext } from './intelligent-retry-system.ts';
import { MCPRetryHandler } from './mcp-retry-handler.ts';
import type { ToolDetail, ToolExecutionContext } from './tool-execution-types.ts';

export class RetryCoordinator {
  private static readonly MAX_RETRY_ATTEMPTS = 3;

  /**
   * Process all tools that need retry using intelligent retry system
   */
  static async processRetries(
    toolDetails: ToolDetail[],
    fcm: FunctionCallingManager,
    context: ToolExecutionContext,
    openai: any,
    msgs: any[]
  ): Promise<{
    successfulRetries: number;
    failedRetries: number;
    totalAttempts: number;
    requiresLLMRetry: boolean;
    retryGuidanceAdded: boolean;
  }> {
    const toolsNeedingRetry = toolDetails.filter(td => td.requires_retry);
    let retryAttempts = 0;
    let successfulRetries = 0;
    let failedRetries = 0;
    let requiresLLMRetry = false;
    let retryGuidanceAdded = false;
    
    console.log(`[RetryCoordinator] 🔍 Checking for tools needing retry: ${toolsNeedingRetry.length} found`);
    if (toolsNeedingRetry.length > 0) {
      console.log(`[RetryCoordinator] 🔄 Tools flagged for retry:`, toolsNeedingRetry.map(t => t.name));
    }
    
    // Process each tool that needs retry using intelligent retry system
    for (const toolDetail of toolsNeedingRetry) {
      if (retryAttempts >= this.MAX_RETRY_ATTEMPTS) {
        console.log(`[RetryCoordinator] Max retry attempts (${this.MAX_RETRY_ATTEMPTS}) reached, stopping`);
        break;
      }

      retryAttempts++;
      console.log(`[RetryCoordinator] 🚀 INTELLIGENT RETRY ${retryAttempts}/${this.MAX_RETRY_ATTEMPTS} for ${toolDetail.name}`);
      
      // Use LLM to analyze if this error is retryable
      const retryAnalysis = await IntelligentRetrySystem.isRetryableError(
        toolDetail.name, 
        toolDetail.error || '', 
        openai
      );
      
      console.log(`[RetryCoordinator] LLM retry analysis for ${toolDetail.name}:`, retryAnalysis);
      
      if (!retryAnalysis.isRetryable) {
        console.log(`[RetryCoordinator] LLM determined ${toolDetail.name} is not retryable: ${retryAnalysis.reasoning}`);
        failedRetries++;
        
        // Add system message explaining why it's not retryable
        msgs.push({
          role: 'system',
          content: `❌ RETRY SKIPPED: ${toolDetail.name} - ${retryAnalysis.reasoning} (Confidence: ${Math.round(retryAnalysis.confidence * 100)}%)`
        });
        
        continue;
      }

      console.log(`[RetryCoordinator] LLM approved retry for ${toolDetail.name}: ${retryAnalysis.reasoning} (Confidence: ${Math.round(retryAnalysis.confidence * 100)}%)`);
      
      // Check if this is an MCP interactive error
      const isMCPError = MCPRetryHandler.isMCPInteractiveError(toolDetail.error || '');
      
      console.log(`[RetryCoordinator] ⚠️ CRITICAL CHECK - isMCPError: ${isMCPError}, error: "${toolDetail.error}"`);
      
      if (isMCPError) {
        console.log(`[RetryCoordinator] 🎯 🎯 🎯 MCP INTERACTIVE ERROR DETECTED - USING MCP PROTOCOL RETRY`);
        
        // Try to infer missing parameter value from user intent
        let inferredValue: string | null = null;
        let inferredParam: string | null = null;
        
        if (context.originalUserMessage) {
          inferredParam = IntelligentRetrySystem.extractMissingParamName(toolDetail.error || '');
          
          if (inferredParam) {
            console.log(`[RetryCoordinator] 🧠 Attempting to infer value for parameter: ${inferredParam}`);
            
            // Get tool description from available tools if possible
            const toolDescription = context.availableTools?.find(t => t.name === toolDetail.name)?.description || '';
            
            inferredValue = await IntelligentRetrySystem.inferMissingParameterValue(
              toolDetail.name,
              inferredParam,
              context.originalUserMessage,
              toolDescription,
              openai
            );
            
            if (inferredValue) {
              console.log(`[RetryCoordinator] 💡 Successfully inferred value for ${inferredParam}: "${inferredValue}"`);
            }
          }
        }
        
        // Get successful parameters from tool metadata if available
        const toolMetadata = context.availableTools?.find(t => t.name === toolDetail.name);
        const successfulParams = (toolMetadata as any)?._mcp_metadata?.successful_parameters;
        const successCount = (toolMetadata as any)?._mcp_metadata?.success_count;
        
        // Add MCP retry system message following protocol
        const mcpRetryMessage = MCPRetryHandler.generateRetrySystemMessage({
          toolName: toolDetail.name,
          originalParams: toolDetail.input_params || {},
          errorMessage: toolDetail.error || '',
          attempt: retryAttempts,
          maxAttempts: this.MAX_RETRY_ATTEMPTS,
          suggestedFix: retryAnalysis.suggestedFix, // Include LLM's suggested fix!
          userIntent: context.originalUserMessage, // Include user's original request
          inferredParameterValue: (inferredValue && inferredParam) ? {
            param: inferredParam,
            value: inferredValue
          } : undefined,
          successfulParameters: successfulParams,
          successCount: successCount
        });
        
        msgs.push({
          role: 'system',
          content: mcpRetryMessage
        });
        
        console.log(`[RetryCoordinator] Added MCP retry guidance to conversation with ${inferredValue ? 'INFERRED VALUE' : 'no inference'}`);
        
        // Signal that LLM needs to be called again with retry guidance
        requiresLLMRetry = true;
        retryGuidanceAdded = true;
        
        // Don't execute anything - let the LLM make a NEW tool call
        continue;
      }
      
      // For non-MCP errors, add suggested fix if available
      if (retryAnalysis.suggestedFix) {
        msgs.push({
          role: 'system',
          content: `🔧 RETRY GUIDANCE for ${toolDetail.name}: ${retryAnalysis.suggestedFix}`
        });
      }

      // Create execution context for intelligent retry
      const executionContext: RetryContext = {
        toolName: toolDetail.name,
        originalParams: toolDetail.input_params || {},
        error: toolDetail.error || '',
        agentId: context.agent_id || '',
        userId: context.user_id || '',
        attempt: retryAttempts,
        maxAttempts: this.MAX_RETRY_ATTEMPTS
      };

      try {
        // Execute intelligent retry
        const retryResult = await IntelligentRetrySystem.executeIntelligentRetry(
          executionContext,
          fcm,
          openai
        );

        if (retryResult.success && retryResult.result) {
          console.log(`[RetryCoordinator] ✅ Intelligent retry successful for ${toolDetail.name}`);
          
          // Update the tool detail with successful result
          this.updateToolDetailWithSuccess(toolDetail, retryResult, retryAttempts);
          
          // Add successful tool observation to conversation
          await this.addSuccessMessage(toolDetail, retryResult, retryAttempts, fcm, msgs);
          
          successfulRetries++;

        } else {
          console.log(`[RetryCoordinator] ❌ Intelligent retry failed for ${toolDetail.name}: ${retryResult.error}`);
          
          // Update tool detail with retry failure info
          this.updateToolDetailWithFailure(toolDetail, retryResult, retryAttempts);
          
          // Add failure message to conversation
          this.addFailureMessage(toolDetail, retryResult, msgs);
          
          failedRetries++;
        }

      } catch (retryError: any) {
        console.error(`[RetryCoordinator] Exception during intelligent retry for ${toolDetail.name}:`, retryError);
        
        // Add error message to conversation
        msgs.push({
          role: 'system',
          content: `❌ RETRY ERROR: Failed to process retry for ${toolDetail.name}: ${retryError.message}`
        });
        
        failedRetries++;
      }
    }
    
    // Final summary
    if (successfulRetries > 0) {
      console.log(`[RetryCoordinator] ✅ ${successfulRetries} tools successfully retried`);
    }
    
    if (failedRetries > 0) {
      console.log(`[RetryCoordinator] ❌ ${failedRetries} tools failed retry`);
    }

    return {
      successfulRetries,
      failedRetries,
      totalAttempts: retryAttempts,
      requiresLLMRetry,
      retryGuidanceAdded
    };
  }

  /**
   * Update tool detail with successful retry result
   */
  private static updateToolDetailWithSuccess(
    toolDetail: ToolDetail,
    retryResult: any,
    retryAttempts: number
  ): void {
    toolDetail.success = true;
    toolDetail.output_result = retryResult.result.data || retryResult.result;
    toolDetail.error = undefined;
    toolDetail.requires_retry = false;
    toolDetail.input_params = retryResult.finalParams || toolDetail.input_params;
    toolDetail.retry_attempt = retryAttempts;
    toolDetail.retry_method = 'intelligent_transformation';
  }

  /**
   * Update tool detail with failed retry result
   */
  private static updateToolDetailWithFailure(
    toolDetail: ToolDetail,
    retryResult: any,
    retryAttempts: number
  ): void {
    toolDetail.retry_attempt = retryAttempts;
    toolDetail.retry_error = retryResult.error;
    toolDetail.retry_method = 'intelligent_transformation';
  }

  /**
   * Add success message to conversation
   */
  private static async addSuccessMessage(
    toolDetail: ToolDetail,
    retryResult: any,
    retryAttempts: number,
    fcm: FunctionCallingManager,
    msgs: any[]
  ): Promise<void> {
    // Add successful tool observation to conversation
    msgs.push({
      role: 'tool',
      content: await fcm.formatResult(toolDetail.name, retryResult.result),
      tool_call_id: `retry_${toolDetail.name}_${retryAttempts}`,
    });
    
    // Add system message explaining the successful retry
    msgs.push({
      role: 'system',
      content: `✅ RETRY SUCCESS: ${toolDetail.name} was successfully executed after intelligent parameter transformation. The tool is now working correctly.`
    });
  }

  /**
   * Add failure message to conversation
   */
  private static addFailureMessage(
    toolDetail: ToolDetail,
    retryResult: any,
    msgs: any[]
  ): void {
    msgs.push({
      role: 'system',
      content: `❌ RETRY FAILED: ${toolDetail.name} could not be fixed automatically. Error: ${retryResult.error}`
    });
  }
}
