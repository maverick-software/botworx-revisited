/**
 * MCP Retry Handler
 * Implements proper Model Context Protocol retry mechanism
 * Based on: archive/tool_use/mcp_client_error_response_protocol.md
 */

export interface MCPRetryContext {
  toolName: string;
  originalParams: Record<string, any>;
  errorMessage: string;
  attempt: number;
  maxAttempts: number;
  suggestedFix?: string; // LLM-generated fix suggestion
  userIntent?: string; // User's original request
  inferredParameterValue?: { // AI-inferred parameter value
    param: string;
    value: string;
  };
  successfulParameters?: any[]; // Previously successful parameter combinations
  successCount?: number; // Number of successful executions
}

export class MCPRetryHandler {
  /**
   * Detect if an error is an MCP interactive error that should trigger retry
   * Following MCP protocol pattern detection
   */
  static isMCPInteractiveError(errorMessage: string): boolean {
    if (!errorMessage) return false;
    
    const lowerError = errorMessage.toLowerCase();
    
    // MCP protocol patterns from documentation
    return lowerError.includes('question:') ||
           lowerError.includes('what ') ||
           lowerError.includes('please provide') ||
           lowerError.includes('which ') ||
           lowerError.includes('how ') ||
           lowerError.includes('who ') ||
           lowerError.includes('where ') ||
           lowerError.includes('missing');
  }

  /**
   * Generate MCP retry system message following protocol guidelines
   */
  static generateRetrySystemMessage(context: MCPRetryContext): string {
    // Extract parameter hints from error
    const hints = this.extractParameterHints(context.errorMessage);
    
    let parameterGuidance = '';
    if (hints.requiredParam) {
      parameterGuidance = `\n🎯 REQUIRED PARAMETER: "${hints.requiredParam}"\n`;
      if (hints.suggestedValue !== undefined) {
        parameterGuidance += `   Suggested value: "${hints.suggestedValue}"\n`;
      }
    }
    
    // Build successful parameters section if available
    let successfulParamsSection = '';
    if (context.successfulParameters && context.successfulParameters.length > 0) {
      const latestSuccess = context.successfulParameters[context.successfulParameters.length - 1];
      successfulParamsSection = `\n✅ PREVIOUSLY SUCCESSFUL PARAMETERS (${context.successCount || 0} successful executions):
${JSON.stringify(latestSuccess, null, 2)}

These parameters have worked before. Use them as a reference for the correct format and structure.

`;
    }
    
    // Build suggested fix section if available
    let suggestedFixSection = '';
    if (context.suggestedFix) {
      suggestedFixSection = `\n💡 AI-GENERATED FIX SUGGESTION:
${context.suggestedFix}

`;
    }
    
    // Build user intent section
    let userIntentSection = '';
    if (context.userIntent) {
      userIntentSection = `\n📝 USER'S ORIGINAL REQUEST: "${context.userIntent}"
`;
    }
    
    // Build inferred parameter value section
    let inferredValueSection = '';
    if (context.inferredParameterValue) {
      inferredValueSection = `\n🎯 AI-INFERRED PARAMETER VALUE:
Based on the user's request, use this value:
  ${context.inferredParameterValue.param}: "${context.inferredParameterValue.value}"

This value was intelligently inferred from the user's intent. Use it in your tool call.

`;
    }
    
    return `🔄 MCP TOOL RETRY - Attempt ${context.attempt}/${context.maxAttempts}

The tool "${context.toolName}" returned an interactive error message:

ERROR MESSAGE:
${context.errorMessage}
${parameterGuidance}${successfulParamsSection}${userIntentSection}${inferredValueSection}${suggestedFixSection}
📋 MCP PROTOCOL INSTRUCTIONS:
1. READ the error message carefully - it tells you EXACTLY what's needed
2. ${context.suggestedFix ? 'FOLLOW the AI-generated fix suggestion above' : 'Generate a BRAND NEW tool call with ONLY the correct parameters'}
3. **DO NOT include parameters mentioned as wrong in the error**
4. **ONLY use the parameter names specified in the error message**

⚠️ CRITICAL RULES:
- If error says "Use 'searchValue' parameter, NOT 'instructions'" → ONLY send searchValue, REMOVE instructions
- If error says "Use 'query' parameter, NOT 'search'" → ONLY send query, REMOVE search  
- Follow parameter names EXACTLY as mentioned in the error message
- Do NOT combine old and new parameters - use ONLY what the error specifies
- Use empty string ("") as default value if no specific value is needed

WRONG PARAMETERS TO REMOVE (from error message):
${this.extractWrongParameters(context.errorMessage).map(p => `  ❌ ${p}`).join('\n') || '  (none specified)'}

ORIGINAL PARAMETERS (DO NOT REUSE):
${JSON.stringify(context.originalParams, null, 2)}

NOW: Generate a COMPLETELY NEW tool call for ${context.toolName} using ONLY the correct parameter names from the error message.`;
  }

  /**
   * Generate simplified retry guidance for automatic transformation cases
   */
  static generateAutoTransformGuidance(
    toolName: string,
    originalParams: Record<string, any>,
    transformedParams: Record<string, any>,
    errorMessage: string
  ): string {
    const changes: string[] = [];
    
    // Detect what changed
    for (const [key, value] of Object.entries(transformedParams)) {
      if (!(key in originalParams) || originalParams[key] !== value) {
        changes.push(`  - Added/Changed "${key}": ${JSON.stringify(value)}`);
      }
    }
    
    for (const key of Object.keys(originalParams)) {
      if (!(key in transformedParams)) {
        changes.push(`  - Removed "${key}"`);
      }
    }

    return `🔄 MCP AUTO-FIX APPLIED

The tool "${toolName}" had parameter issues. The system automatically corrected them:

ORIGINAL ERROR:
${errorMessage}

PARAMETER CHANGES:
${changes.join('\n')}

CORRECTED PARAMETERS:
${JSON.stringify(transformedParams, null, 2)}

✅ Please retry the tool call with these corrected parameters.`;
  }

  /**
   * Extract parameters that should NOT be used (mentioned as wrong in error)
   */
  static extractWrongParameters(errorMessage: string): string[] {
    const wrongParams: string[] = [];
    
    // Match patterns like: "not 'instructions'" or "instead of 'query'"
    const notPattern = /(?:not|instead of|don't use)\s+['"`](\w+)['"`]/gi;
    let match;
    while ((match = notPattern.exec(errorMessage)) !== null) {
      wrongParams.push(match[1]);
    }
    
    return wrongParams;
  }

  /**
   * Extract parameter hints from MCP error message
   */
  static extractParameterHints(errorMessage: string): {
    requiredParam?: string;
    suggestedValue?: string;
    parameterType?: string;
  } {
    const hints: any = {};
    
    // Try to extract parameter name from patterns like:
    // "use the 'searchValue' parameter"
    // "provide the 'to' field"
    // "missing 'subject'"
    const paramMatch = errorMessage.match(/['"`](\w+)['"`]\s*(?:parameter|field|value)/i);
    if (paramMatch) {
      hints.requiredParam = paramMatch[1];
    }

    // Try to extract suggested value from patterns like:
    // "use empty string (\"\")"
    // "provide email@example.com"
    const valueMatch = errorMessage.match(/(?:use|provide|try)\s+["']([^"']+)["']/i);
    if (valueMatch) {
      hints.suggestedValue = valueMatch[1];
    }

    // Try to extract parameter type
    if (errorMessage.toLowerCase().includes('email')) {
      hints.parameterType = 'email';
    } else if (errorMessage.toLowerCase().includes('search')) {
      hints.parameterType = 'search_query';
    } else if (errorMessage.toLowerCase().includes('phone')) {
      hints.parameterType = 'phone';
    }

    return hints;
  }

  /**
   * Build enhanced conversation context for MCP retry
   */
  static buildRetryConversationContext(
    toolName: string,
    errorMessage: string,
    attempt: number
  ): {
    userMessage: string;
    systemGuidance: string;
  } {
    const hints = this.extractParameterHints(errorMessage);
    
    let guidance = `The MCP server needs additional information for "${toolName}". `;
    
    if (hints.requiredParam) {
      guidance += `Specifically, it needs the "${hints.requiredParam}" parameter. `;
    }
    
    if (hints.suggestedValue) {
      guidance += `Suggested value: "${hints.suggestedValue}". `;
    }
    
    guidance += `Please retry with the correct parameters based on this guidance: ${errorMessage}`;

    return {
      userMessage: errorMessage,
      systemGuidance: guidance
    };
  }
}
