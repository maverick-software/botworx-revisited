/**
 * MCP Retry Loop - Handles the intelligent retry loop for MCP interactive errors
 */

import type { LLMCaller } from './llm-caller.ts';
import type { ToolExecutionResult } from '../utils/tool-execution-types.ts';
import { ToolExecutor } from '../utils/tool-executor.ts';
import type { FunctionCallingManager } from '../function_calling/manager.ts';
import type { IRouter } from '../../../shared/llm/interfaces.ts';
import type OpenAI from 'npm:openai@6.1.0';

export interface MCPRetryLoopOptions {
  initialToolCalls: any[];
  initialToolExecResult: ToolExecutionResult;
  messages: any[];
  context: any;
  availableTools: any[];
  fcm: FunctionCallingManager;
  llmCaller: LLMCaller;
  openai: OpenAI;
  router?: IRouter;
  useRouter: boolean;
  normalizeTools: (tools: any[]) => any[];
  userMessage: string;
}

export interface MCPRetryLoopResult {
  toolDetails: any[];
  messages: any[];
  promptTokens: number;
  completionTokens: number;
  retryAttempts: number;
}

export class MCPRetryLoop {
  private static readonly MAX_MCP_RETRIES = 3;

  /**
   * Execute the MCP retry loop until success or max attempts
   */
  static async execute(options: MCPRetryLoopOptions): Promise<MCPRetryLoopResult> {
    const {
      initialToolCalls,
      initialToolExecResult,
      messages,
      context,
      availableTools,
      fcm,
      llmCaller,
      openai,
      router,
      useRouter,
      normalizeTools,
      userMessage,
    } = options;

    let toolExecResult = initialToolExecResult;
    let toolDetails = [...initialToolExecResult.toolDetails];
    let promptTokens = toolExecResult.tokensUsed.prompt;
    let completionTokens = toolExecResult.tokensUsed.completion;
    let mcpRetryAttempts = 0;

    console.log(`[MCPRetryLoop] Initial check - requiresLLMRetry: ${toolExecResult.requiresLLMRetry}, retryGuidanceAdded: ${toolExecResult.retryGuidanceAdded}`);

    // MCP Protocol: Handle LLM retry loop for interactive errors
    while (
      initialToolCalls.length > 0 &&
      toolExecResult.requiresLLMRetry &&
      mcpRetryAttempts < this.MAX_MCP_RETRIES
    ) {
      mcpRetryAttempts++;
      console.log(`[MCPRetryLoop] 🔄 Starting retry attempt ${mcpRetryAttempts}/${this.MAX_MCP_RETRIES}`);

      // Clean messages before sending to LLM for retry
      const cleanedMsgs = messages
        .filter((msg: any) => msg.role !== 'tool')
        .map((msg: any) => {
          const cleaned: any = { role: msg.role, content: msg.content };
          return cleaned;
        });

      // Call LLM again with MCP retry guidance
      const llmResult = await llmCaller.call({
        messages: cleanedMsgs,
        tools: availableTools,
        temperature: 0.7,
        maxTokens: 1200,
        toolChoice: 'required', // Force tool calls in retry
        userMessage: userMessage,
      });

      // Track usage
      if (llmResult.usage) {
        promptTokens += llmResult.usage.prompt;
        completionTokens += llmResult.usage.completion;
      }

      const retryToolCalls = llmResult.toolCalls || [];
      console.log(`[MCPRetryLoop] LLM retry generated ${retryToolCalls.length} tool calls`);

      if (retryToolCalls.length === 0) {
        console.log(`[MCPRetryLoop] ⚠️ No tool calls in retry, LLM returned:`, {
          hasText: !!llmResult.text,
          textLength: llmResult.text?.length,
        });
        break;
      }

      // Execute the retry tool calls
      console.log(
        `[MCPRetryLoop] Executing retry tool calls:`,
        retryToolCalls.map((tc: any) => tc.function?.name).join(', ')
      );

      toolExecResult = await ToolExecutor.executeToolCalls(
        retryToolCalls,
        messages,
        fcm,
        {
          ...context,
          originalUserMessage: userMessage,
          availableTools: availableTools,
        },
        availableTools,
        openai,
        router,
        useRouter,
        normalizeTools
      );

      // Merge tool details from retry
      toolDetails = [...toolDetails, ...toolExecResult.toolDetails];
      promptTokens += toolExecResult.tokensUsed.prompt;
      completionTokens += toolExecResult.tokensUsed.completion;

      // Check if more retries are needed
      if (!toolExecResult.requiresLLMRetry) {
        console.log(`[MCPRetryLoop] ✅ Retry successful - no more retries needed`);
        break;
      } else {
        console.log(`[MCPRetryLoop] ⚠️ Retry still requires more attempts`);
      }
    }

    if (mcpRetryAttempts >= this.MAX_MCP_RETRIES && toolExecResult.requiresLLMRetry) {
      console.log(`[MCPRetryLoop] ⚠️ Max retry attempts (${this.MAX_MCP_RETRIES}) reached, some tools may have failed`);
    }

    return {
      toolDetails,
      messages,
      promptTokens,
      completionTokens,
      retryAttempts: mcpRetryAttempts,
    };
  }
}

