/**
 * Intelligent Retry System for MCP Tools
 * 
 * This system provides:
 * 1. Automatic parameter transformation for common issues
 * 2. LLM-powered error analysis and parameter suggestion
 * 3. Context-aware retry logic for different tool types
 * 4. Flawless retry handling for both internal and external tools
 */

import type { FunctionCallingManager } from '../function_calling/manager.ts';

export interface ToolExecutionContext {
  toolName: string;
  originalParams: Record<string, any>;
  error: string;
  agentId: string;
  userId: string;
  attempt: number;
  maxAttempts: number;
}

export interface RetryAnalysis {
  shouldRetry: boolean;
  transformedParams?: Record<string, any>;
  enhancedInstructions?: string;
  confidence: number;
  reasoning: string;
}

export interface ParameterTransformation {
  from: string;
  to: string;
  condition?: (toolName: string, error: string) => boolean;
  transformer?: (value: any, context: ToolExecutionContext) => any;
}

export class IntelligentRetrySystem {
  /**
   * Infer the appropriate value for a missing parameter based on user intent
   */
  static async inferMissingParameterValue(
    toolName: string,
    missingParam: string,
    userMessage: string,
    toolDescription: string,
    openai: any
  ): Promise<string | null> {
    console.log(`[IntelligentRetry] 🧠 Inferring value for ${missingParam} in ${toolName} from user message: "${userMessage}"`);
    
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: `You are a parameter inference system. Given a tool call that failed due to a missing parameter, infer the most appropriate value for that parameter based on the user's original request.

Tool: ${toolName}
Tool Purpose: ${toolDescription || 'General purpose tool'}
Missing Parameter: ${missingParam}
User's Request: "${userMessage}"

Your task: Infer what value the user would want for the '${missingParam}' parameter based on their request.

Examples:
- Tool: search_emails, Param: query, User: "show my emails from john" → "from:john"
- Tool: search_emails, Param: searchValue, User: "find recent messages" → ""
- Tool: api_request, Param: instructions, User: "get customer list" → "Retrieve customer list"
- Tool: api_request, Param: instructions, User: "show invoices" → "Get list of invoices"
- Tool: send_email, Param: subject, User: "email john about the meeting" → "Meeting"
- Tool: send_email, Param: to, User: "email john@example.com" → "john@example.com"

Return ONLY the inferred parameter value as a plain string. Do not include quotes, JSON, or explanations.
If you cannot infer a reasonable value, return the text "CANNOT_INFER".`
        }],
        max_tokens: 100,
        temperature: 0.3
      });
      
      const inferredValue = completion.choices[0].message.content?.trim();
      
      if (!inferredValue || inferredValue === 'CANNOT_INFER') {
        console.log(`[IntelligentRetry] ❌ Could not infer value for ${missingParam}`);
        return null;
      }
      
      console.log(`[IntelligentRetry] 💡 Inferred value for ${missingParam}: "${inferredValue}"`);
      return inferredValue;
      
    } catch (error) {
      console.error(`[IntelligentRetry] Error inferring parameter value:`, error);
      return null;
    }
  }

  /**
   * Extract the missing parameter name from an error message
   */
  static extractMissingParamName(errorMessage: string): string | null {
    if (!errorMessage) return null;
    
    const lowerError = errorMessage.toLowerCase();
    
    // Pattern 1: "parameter 'xxx' is missing"
    const pattern1 = /parameter ['"`](\w+)['"`].*(?:missing|required|undefined)/i;
    let match = errorMessage.match(pattern1);
    if (match) return match[1];
    
    // Pattern 2: "'xxx' parameter is missing"
    const pattern2 = /['"`](\w+)['"`]\s*parameter.*(?:missing|required|undefined)/i;
    match = errorMessage.match(pattern2);
    if (match) return match[1];
    
    // Pattern 3: "field 'xxx' is missing"
    const pattern3 = /field ['"`](\w+)['"`].*(?:missing|required|undefined)/i;
    match = errorMessage.match(pattern3);
    if (match) return match[1];
    
    // Pattern 4: "'xxx' is missing" or "'xxx' field is missing"
    const pattern4 = /['"`](\w+)['"`].*(?:is missing|is required|is undefined|missing|required)/i;
    match = errorMessage.match(pattern4);
    if (match) return match[1];
    
    // Pattern 5: "missing 'xxx'"
    const pattern5 = /missing ['"`](\w+)['"`]/i;
    match = errorMessage.match(pattern5);
    if (match) return match[1];
    
    console.log(`[IntelligentRetry] Could not extract parameter name from: "${errorMessage}"`);
    return null;
  }

  private static parameterTransformations: ParameterTransformation[] = [
    // Zapier MCP Outlook Tools - Handle undefined instructions
    {
      from: 'instructions',
      to: 'instructions',
      condition: (toolName, error) => 
        toolName.includes('microsoft_outlook_find_emails') && 
        (error.toLowerCase().includes('instructions') && error.toLowerCase().includes('undefined')),
      transformer: (value: string) => value || "" // Provide empty string as default
    },
    {
      from: 'instructions',
      to: 'searchValue',
      condition: (toolName, error) => 
        toolName.includes('microsoft_outlook_find_emails') && 
        error.toLowerCase().includes('searchvalue'),
      transformer: (value: string) => value || ""
    },
    {
      from: 'query',
      to: 'searchValue',
      condition: (toolName, error) => 
        toolName.includes('microsoft_outlook_find_emails') && 
        error.toLowerCase().includes('searchvalue')
    },
    {
      from: 'search',
      to: 'searchValue',
      condition: (toolName, error) => 
        toolName.includes('microsoft_outlook_find_emails') && 
        error.toLowerCase().includes('searchvalue')
    },
    
    // Gmail Tools
    {
      from: 'instructions',
      to: 'query',
      condition: (toolName, error) => 
        toolName.includes('gmail_search_emails') && 
        error.toLowerCase().includes('query')
    },
    {
      from: 'search',
      to: 'query',
      condition: (toolName, error) => 
        toolName.includes('gmail_search_emails') && 
        error.toLowerCase().includes('query')
    },
    
    // Contact Tools
    {
      from: 'instructions',
      to: 'query',
      condition: (toolName, error) => 
        toolName === 'search_contacts' && 
        error.toLowerCase().includes('query')
    },
    {
      from: 'search',
      to: 'query',
      condition: (toolName, error) => 
        toolName === 'search_contacts' && 
        error.toLowerCase().includes('query')
    },
    
    // SMS Tools
    {
      from: 'message',
      to: 'message_text',
      condition: (toolName, error) => 
        toolName.includes('clicksend_send_sms') && 
        error.toLowerCase().includes('message_text')
    },
    {
      from: 'phone',
      to: 'to',
      condition: (toolName, error) => 
        toolName.includes('send_sms') && 
        error.toLowerCase().includes('to')
    },
    
    // Web Search Tools
    {
      from: 'instructions',
      to: 'query',
      condition: (toolName, error) => 
        toolName.includes('web_search') && 
        error.toLowerCase().includes('query')
    },
    {
      from: 'search',
      to: 'query',
      condition: (toolName, error) => 
        toolName.includes('web_search') && 
        error.toLowerCase().includes('query')
    }
  ];

  /**
   * Analyze tool execution error and determine retry strategy
   */
  static async analyzeError(context: ToolExecutionContext, openai: any): Promise<RetryAnalysis> {
    console.log(`[IntelligentRetry] Analyzing error for ${context.toolName} (attempt ${context.attempt}/${context.maxAttempts})`);
    console.log(`[IntelligentRetry] Error: ${context.error}`);
    console.log(`[IntelligentRetry] Original params:`, context.originalParams);

    // First, try automatic parameter transformation
    const transformedParams = this.tryParameterTransformation(context);
    if (transformedParams) {
      console.log(`[IntelligentRetry] ✅ Automatic parameter transformation successful`);
      console.log(`[IntelligentRetry] Transformed params:`, transformedParams);
      
      return {
        shouldRetry: true,
        transformedParams,
        confidence: 0.9,
        reasoning: 'Automatic parameter transformation applied based on known patterns',
        enhancedInstructions: this.generateEnhancedInstructions(context, transformedParams)
      };
    }

    // If automatic transformation fails, use LLM analysis
    console.log(`[IntelligentRetry] No automatic transformation found, using LLM analysis...`);
    return await this.llmAnalyzeError(context, openai);
  }

  /**
   * Try automatic parameter transformation based on known patterns
   */
  private static tryParameterTransformation(context: ToolExecutionContext): Record<string, any> | null {
    const { toolName, error, originalParams } = context;
    
    for (const transformation of this.parameterTransformations) {
      // Check if transformation condition matches
      if (transformation.condition && !transformation.condition(toolName, error)) {
        continue;
      }
      
      // Check if the source parameter exists in original params
      if (!(transformation.from in originalParams)) {
        continue;
      }
      
      console.log(`[IntelligentRetry] Applying transformation: ${transformation.from} → ${transformation.to}`);
      
      // Create transformed parameters
      const transformedParams = { ...originalParams };
      
      // Get the value to transform
      let value = originalParams[transformation.from];
      
      // Apply custom transformer if provided
      if (transformation.transformer) {
        value = transformation.transformer(value, context);
      }
      
      // Apply transformation
      transformedParams[transformation.to] = value;
      delete transformedParams[transformation.from];
      
      return transformedParams;
    }
    
    return null;
  }

  /**
   * Use LLM to analyze error and suggest parameter fixes with enhanced intelligence
   */
  private static async llmAnalyzeError(context: ToolExecutionContext, openai: any): Promise<RetryAnalysis> {
    try {
      const prompt = `You are an expert at analyzing tool execution errors and fixing parameter issues automatically.

TOOL: ${context.toolName}
ERROR: ${context.error}
ORIGINAL PARAMETERS: ${JSON.stringify(context.originalParams, null, 2)}
ATTEMPT: ${context.attempt}/${context.maxAttempts}

Analyze this error intelligently and provide a comprehensive fix:

1. **Error Classification**: What type of error is this?
   - Parameter missing/wrong name
   - Format/validation issue  
   - Authentication/permission issue
   - Network/temporary issue
   - Service-specific issue

2. **Intelligent Parameter Analysis**: Look at the original parameters and error message:
   - Are there parameter name mismatches? (e.g., "instructions" vs "searchValue", "message" vs "body")
   - Are there format issues? (phone numbers, emails, etc.)
   - Are required parameters missing?
   - Are there extra/unwanted parameters?

3. **Smart Fixes**: Provide specific parameter transformations:
   - Rename parameters to match API expectations
   - Transform formats (e.g., phone number formatting)
   - Add missing required parameters with sensible defaults
   - Remove problematic parameters

4. **Tool-Specific Knowledge**: Apply knowledge about common issues:
   - Zapier MCP tools often need "searchValue" instead of "instructions"
   - ClickSend SMS needs "to" (phone) and "message" parameters
   - Gmail tools need "query" for searches
   - Outlook tools have specific parameter naming conventions

Common transformation patterns:
- "instructions" → "searchValue" (for Zapier Outlook tools)
- "instructions" → "query" (for search tools)
- "message" → "body" or "message_text" (for messaging tools)
- "phone" → "to" (for SMS tools)
- Phone number formatting: ensure international format (+1234567890)

Respond with JSON:
{
  "shouldRetry": boolean,
  "transformedParams": { "corrected": "parameters" } or null,
  "confidence": 0.0-1.0,
  "reasoning": "detailed explanation of the analysis and fix",
  "errorType": "parameter_mismatch|format_issue|missing_required|authentication|network|service_error",
  "specificFixes": ["list of specific changes made"]
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 800
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from LLM');
      }

      // Parse JSON response
      const analysis = JSON.parse(content);
      
      console.log(`[IntelligentRetry] Enhanced LLM analysis result:`, analysis);
      
      return {
        shouldRetry: analysis.shouldRetry && context.attempt < context.maxAttempts,
        transformedParams: analysis.transformedParams,
        confidence: analysis.confidence || 0.5,
        reasoning: analysis.reasoning || 'Enhanced LLM analysis',
        enhancedInstructions: analysis.transformedParams ? 
          this.generateEnhancedInstructions(context, analysis.transformedParams, analysis.specificFixes || []) : undefined
      };

    } catch (error) {
      console.error(`[IntelligentRetry] Enhanced LLM analysis failed:`, error);
      
      // Fallback to heuristic analysis
      return this.heuristicAnalysis(context);
    }
  }

  /**
   * Fallback heuristic analysis when LLM fails
   */
  private static heuristicAnalysis(context: ToolExecutionContext): RetryAnalysis {
    const { toolName, error, originalParams, attempt, maxAttempts } = context;
    const lowerError = error.toLowerCase();
    
    // Check for common fixable errors
    const isParameterError = lowerError.includes('missing') || 
                            lowerError.includes('required') || 
                            lowerError.includes('invalid') ||
                            lowerError.includes('parameter');
    
    if (!isParameterError || attempt >= maxAttempts) {
      return {
        shouldRetry: false,
        confidence: 0.8,
        reasoning: 'Not a fixable parameter error or max attempts reached'
      };
    }

    // Try to suggest common fixes
    let transformedParams = { ...originalParams };
    let reasoning = 'Heuristic parameter fix attempt';

    // Common transformations
    if (lowerError.includes('searchvalue') && 'instructions' in originalParams) {
      transformedParams.searchValue = originalParams.instructions || "";
      delete transformedParams.instructions;
      reasoning = 'Transformed instructions to searchValue';
    } else if (lowerError.includes('query') && 'instructions' in originalParams) {
      transformedParams.query = originalParams.instructions || "";
      delete transformedParams.instructions;
      reasoning = 'Transformed instructions to query';
    } else if (lowerError.includes('to') && 'phone' in originalParams) {
      transformedParams.to = originalParams.phone;
      delete transformedParams.phone;
      reasoning = 'Transformed phone to to';
    }

    return {
      shouldRetry: true,
      transformedParams: transformedParams,
      confidence: 0.6,
      reasoning: reasoning,
      enhancedInstructions: this.generateEnhancedInstructions(context, transformedParams)
    };
  }

  /**
   * Generate enhanced instructions for the retry attempt with specific fixes listed
   */
  private static generateEnhancedInstructions(
    context: ToolExecutionContext, 
    transformedParams: Record<string, any>,
    specificFixes: string[] = []
  ): string {
    const { toolName, error, attempt } = context;
    
    const fixesList = specificFixes.length > 0 
      ? `\n\nSPECIFIC FIXES APPLIED:\n${specificFixes.map(fix => `• ${fix}`).join('\n')}`
      : '';
    
    return `🔧 INTELLIGENT RETRY ATTEMPT ${attempt}: The previous tool call failed with error: "${error}"

🤖 LLM ANALYSIS: The error has been analyzed using AI and the following corrected parameters have been generated:
${JSON.stringify(transformedParams, null, 2)}${fixesList}

✅ CRITICAL INSTRUCTIONS: You MUST retry the tool call immediately using these EXACT AI-corrected parameters. 

🎯 FOR ${toolName}:
- The AI has analyzed the error and transformed the parameters automatically
- Use the corrected parameter names and values exactly as provided above
- Do not modify these parameters or ask for user input
- The system has applied intelligent fixes based on tool-specific knowledge

🚀 RETRY NOW with the AI-corrected parameters - the system is confident this will resolve the issue.`;
  }

  /**
   * Execute intelligent retry with parameter transformation
   */
  static async executeIntelligentRetry(
    context: ToolExecutionContext,
    fcm: FunctionCallingManager,
    openai: any
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    finalParams?: Record<string, any>;
  }> {
    console.log(`[IntelligentRetry] Starting intelligent retry for ${context.toolName}`);
    
    // Analyze the error and get retry strategy
    const analysis = await this.analyzeError(context, openai);
    
    if (!analysis.shouldRetry) {
      console.log(`[IntelligentRetry] Analysis determined retry should not be attempted: ${analysis.reasoning}`);
      return {
        success: false,
        error: `Retry analysis failed: ${analysis.reasoning}`,
        finalParams: context.originalParams
      };
    }

    if (!analysis.transformedParams) {
      console.log(`[IntelligentRetry] No parameter transformation suggested`);
      return {
        success: false,
        error: 'No parameter transformation could be determined',
        finalParams: context.originalParams
      };
    }

    console.log(`[IntelligentRetry] Retrying with transformed parameters (confidence: ${analysis.confidence})`);
    console.log(`[IntelligentRetry] Reasoning: ${analysis.reasoning}`);
    console.log(`[IntelligentRetry] Transformed params:`, analysis.transformedParams);

    try {
      // Execute the tool with transformed parameters
      const result = await fcm.executeFunction(
        context.agentId,
        context.userId,
        context.toolName,
        analysis.transformedParams
      );

      if (result.success) {
        console.log(`[IntelligentRetry] ✅ Retry successful after parameter transformation`);
        return {
          success: true,
          result: result,
          finalParams: analysis.transformedParams
        };
      } else {
        console.log(`[IntelligentRetry] ❌ Retry failed even with transformed parameters: ${result.error}`);
        return {
          success: false,
          error: result.error,
          finalParams: analysis.transformedParams
        };
      }

    } catch (error: any) {
      console.error(`[IntelligentRetry] Exception during retry:`, error);
      return {
        success: false,
        error: error.message || 'Retry execution failed',
        finalParams: analysis.transformedParams
      };
    }
  }

  /**
   * Check if an error is retryable using LLM intelligence
   */
  static async isRetryableError(toolName: string, error: string, openai: any): Promise<{
    isRetryable: boolean;
    confidence: number;
    reasoning: string;
    suggestedFix?: string;
  }> {
    try {
      const prompt = `You are an expert at analyzing tool execution errors and determining if they can be fixed automatically.

TOOL: ${toolName}
ERROR: ${error}

Analyze this error and determine:
1. Is this error fixable through parameter adjustment or retry?
2. How confident are you (0.0-1.0)?
3. What type of error is this?
4. Can you suggest a specific fix?

Consider these error types:
- RETRYABLE: Missing parameters, wrong parameter names, format issues, temporary network issues
- NOT RETRYABLE: Authentication failures, permissions denied, service unavailable, rate limits exceeded

Common retryable patterns:
- "missing", "required", "invalid parameter", "please provide"
- Parameter name mismatches (e.g., "searchValue" vs "query")
- Format issues (phone numbers, emails, etc.)
- Temporary connectivity issues

NOT retryable patterns:
- "unauthorized", "forbidden", "authentication failed"
- "rate limit", "quota exceeded", "service unavailable"
- "not found" (for resources that don't exist)

Respond with JSON:
{
  "isRetryable": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "detailed explanation",
  "suggestedFix": "specific suggestion if retryable"
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.warn(`[IntelligentRetry] No LLM response for retry analysis, falling back to heuristic`);
        return this.heuristicRetryCheck(toolName, error);
      }

      try {
        const analysis = JSON.parse(content);
        console.log(`[IntelligentRetry] LLM retry analysis for ${toolName}:`, analysis);
        
        return {
          isRetryable: analysis.isRetryable || false,
          confidence: analysis.confidence || 0.5,
          reasoning: analysis.reasoning || 'LLM analysis',
          suggestedFix: analysis.suggestedFix
        };
      } catch (parseError) {
        console.error(`[IntelligentRetry] Failed to parse LLM response:`, parseError);
        return this.heuristicRetryCheck(toolName, error);
      }

    } catch (llmError) {
      console.error(`[IntelligentRetry] LLM retry analysis failed:`, llmError);
      return this.heuristicRetryCheck(toolName, error);
    }
  }

  /**
   * Fallback heuristic retry check when LLM fails
   */
  private static heuristicRetryCheck(toolName: string, error: string): {
    isRetryable: boolean;
    confidence: number;
    reasoning: string;
    suggestedFix?: string;
  } {
    const lowerError = error.toLowerCase();
    
    // Parameter-related errors are retryable
    if (lowerError.includes('missing') || 
        lowerError.includes('required') || 
        lowerError.includes('invalid parameter') ||
        lowerError.includes('invalid arguments') ||
        lowerError.includes('mcp error -32602') ||
        lowerError.includes('searchvalue') ||
        lowerError.includes('question:') ||
        lowerError.includes('please provide') ||
        lowerError.includes('correct parameters') ||
        lowerError.includes('undefined')) {
      return {
        isRetryable: true,
        confidence: 0.9,
        reasoning: 'Heuristic: Parameter validation error detected (missing, invalid, or undefined parameters)',
        suggestedFix: 'Check parameter names, required fields, and ensure all parameters are defined'
      };
    }

    // Authentication errors are not retryable
    if (lowerError.includes('unauthorized') || 
        lowerError.includes('forbidden') || 
        lowerError.includes('authentication')) {
      return {
        isRetryable: false,
        confidence: 0.9,
        reasoning: 'Heuristic: Authentication error - not retryable'
      };
    }

    // Network/temporary errors are retryable
    if (lowerError.includes('timeout') || 
        lowerError.includes('network') || 
        lowerError.includes('connection') ||
        lowerError.includes('non-2xx')) {
      return {
        isRetryable: true,
        confidence: 0.7,
        reasoning: 'Heuristic: Network/temporary error detected',
        suggestedFix: 'Retry with same parameters or check service status'
      };
    }

    // Default: not retryable with low confidence
    return {
      isRetryable: false,
      confidence: 0.3,
      reasoning: 'Heuristic: Unknown error type, defaulting to not retryable'
    };
  }
}
