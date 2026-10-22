/**
 * OpenAI Responses API Caller
 * 
 * Unified caller that uses OpenAI's Responses API for ALL models.
 * This replaces direct calls to chat.completions.create() which use the old Chat Completions API.
 * 
 * Created: October 27, 2025
 */

import OpenAI from 'npm:openai@6.1.0';

export interface ResponsesAPICallOptions {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: string };
}

export interface ResponsesAPIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call OpenAI using the Responses API format
 * This is the NEW format that works with GPT-4o, GPT-5, and future models
 */
export async function callOpenAIResponsesAPI(
  apiKey: string,
  options: ResponsesAPICallOptions
): Promise<ResponsesAPIResponse> {
  // Create OpenAI client
  const openai = new OpenAI({ apiKey });
  
  // Separate system messages (instructions) from user/assistant messages
  const systemMessages = options.messages.filter(m => m.role === 'system');
  const otherMessages = options.messages.filter(m => m.role !== 'system');
  
  // Combine system messages into instructions
  const instructions = systemMessages.length > 0 
    ? systemMessages.map(m => m.content).join('\n') 
    : undefined;
  
  // If only one user message, use string input
  const input = otherMessages.length === 1 && otherMessages[0].role === 'user'
    ? otherMessages[0].content
    : otherMessages;
  
  // Build Responses API request
  const requestBody: any = {
    model: options.model,
    input,
    store: false, // Disable storage for privacy
  };
  
  if (instructions) {
    requestBody.instructions = instructions;
  }
  
  // Temperature is not supported for reasoning models
  const isReasoningModel = options.model.startsWith('gpt-5') || 
                           options.model.startsWith('gpt-4.1') ||
                           options.model.startsWith('o1-') ||
                           options.model.startsWith('o3-');
  
  // Reasoning models don't support temperature
  if (options.temperature !== undefined && !isReasoningModel) {
    requestBody.temperature = options.temperature;
  }
  
  if (options.maxTokens) {
    requestBody.max_output_tokens = options.maxTokens;
  }
  
  // Handle structured output (JSON responses)
  if (options.responseFormat && options.responseFormat.type === 'json_object') {
    if (!isReasoningModel) {
      // Non-reasoning models support text.format but REQUIRE "json" in the prompt
      requestBody.text = {
        format: {
          type: 'json_object'
        }
      };
      // CRITICAL: OpenAI requires the word "json" in instructions when using json_object format
      if (requestBody.instructions && !requestBody.instructions.toLowerCase().includes('json')) {
        requestBody.instructions += '\n\nRespond with valid JSON format.';
      }
    } else {
      // Reasoning models don't support text.format - use prompt instructions only
      if (requestBody.instructions) {
        requestBody.instructions += '\n\nIMPORTANT: Respond ONLY with valid JSON. Do not include any text before or after the JSON object.';
      }
    }
  }
  
  console.log('[ResponsesAPI] Calling with:', {
    model: requestBody.model,
    hasInstructions: !!requestBody.instructions,
    inputType: typeof requestBody.input,
    temperature: requestBody.temperature,
    maxOutputTokens: requestBody.max_output_tokens
  });
  
  // Call Responses API using SDK
  const res = await openai.responses.create(requestBody);
  
  // Parse output items
  let content = '';
  
  for (const item of res.output || []) {
    // Skip reasoning output (GPT-5, o1, o3 models include this)
    if (item.type === 'reasoning') {
      continue;
    }
    
    if (item.type === 'message') {
      // Extract text from message content
      for (const contentBlock of item.content || []) {
        if (contentBlock.type === 'output_text') {
          content = contentBlock.text;
        }
      }
    }
  }
  
  // Log if we got an empty response for debugging
  if (!content) {
    console.warn('[ResponsesAPI] Empty content in response, output items:', 
      res.output?.map((item: any) => ({ type: item.type, hasContent: !!item.content })) || []
    );
  }
  
  // Build response
  return {
    content: content || '',
    usage: res.usage ? {
      prompt_tokens: res.usage.input_tokens || 0,
      completion_tokens: res.usage.output_tokens || 0,
      total_tokens: res.usage.total_tokens || 0
    } : undefined
  };
}

