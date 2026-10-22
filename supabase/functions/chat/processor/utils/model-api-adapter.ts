/**
 * Model API Adapter - Handles Model-Specific API Formatting
 * 
 * Different model families (GPT-4o, o1/o3, Claude, Gemini) have different API requirements.
 * This adapter ensures the correct parameters are used for each model type.
 * 
 * Created: October 24, 2025
 */

export interface LLMCallOptions {
  model: string;
  messages: Array<{ role: string; content: string }>;
  tools?: Array<any>;
  tool_choice?: string | object;
  temperature?: number;
  maxTokens?: number;
  response_format?: { type: string };
}

export interface AdaptedLLMParams {
  model: string;
  messages: Array<{ role: string; content: string }>;
  tools?: Array<any>;
  tool_choice?: string | object;
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  response_format?: { type: string };
}

/**
 * Model categories with specific API requirements
 */
export const ModelCategories = {
  /**
   * GPT-4o family - Uses max_completion_tokens instead of max_tokens
   */
  GPT4O: {
    patterns: ['gpt-4o', 'gpt-4o-mini', 'gpt-4o-2024'],
    supportsTools: true,
    supportsTemperature: true,
    supportsResponseFormat: true,
    tokenParam: 'max_completion_tokens'
  },
  
  /**
   * o1/o3 reasoning models - Highly restricted API
   * - NO temperature parameter
   * - NO response_format
   * - NO tools/tool_choice
   * - Uses max_completion_tokens
   */
  REASONING: {
    patterns: ['o1-', 'o1-preview', 'o1-mini', 'o3-', 'o3-mini'],
    supportsTools: false,
    supportsTemperature: false,
    supportsResponseFormat: false,
    tokenParam: 'max_completion_tokens'
  },
  
  /**
   * Legacy GPT-4 models - Uses max_tokens
   */
  GPT4_LEGACY: {
    patterns: ['gpt-4-turbo', 'gpt-4-0', 'gpt-4-1', 'gpt-3.5-turbo'],
    supportsTools: true,
    supportsTemperature: true,
    supportsResponseFormat: true,
    tokenParam: 'max_tokens'
  },
  
  /**
   * Claude models - Uses max_tokens
   */
  CLAUDE: {
    patterns: ['claude-'],
    supportsTools: true,
    supportsTemperature: true,
    supportsResponseFormat: false,
    tokenParam: 'max_tokens'
  },
  
  /**
   * Gemini models - Uses max_tokens
   */
  GEMINI: {
    patterns: ['gemini-'],
    supportsTools: true,
    supportsTemperature: true,
    supportsResponseFormat: false,
    tokenParam: 'max_tokens'
  }
};

/**
 * Detect which model category a model belongs to
 */
export function detectModelCategory(model: string): keyof typeof ModelCategories {
  const modelLower = model.toLowerCase();
  
  // Check reasoning models first (most restrictive)
  if (ModelCategories.REASONING.patterns.some(p => modelLower.startsWith(p))) {
    return 'REASONING';
  }
  
  // Check GPT-4o (second most restrictive)
  if (ModelCategories.GPT4O.patterns.some(p => modelLower.includes(p))) {
    return 'GPT4O';
  }
  
  // Check Claude
  if (ModelCategories.CLAUDE.patterns.some(p => modelLower.includes(p))) {
    return 'CLAUDE';
  }
  
  // Check Gemini
  if (ModelCategories.GEMINI.patterns.some(p => modelLower.includes(p))) {
    return 'GEMINI';
  }
  
  // Default to legacy GPT-4
  return 'GPT4_LEGACY';
}

/**
 * Adapt LLM call options to the specific model's API requirements
 */
export function adaptLLMParams(options: LLMCallOptions): AdaptedLLMParams {
  const category = detectModelCategory(options.model);
  const categoryConfig = ModelCategories[category];
  
  const adapted: AdaptedLLMParams = {
    model: options.model,
    messages: options.messages
  };
  
  // Add token limit parameter (model-specific)
  if (options.maxTokens) {
    if (categoryConfig.tokenParam === 'max_completion_tokens') {
      adapted.max_completion_tokens = options.maxTokens;
    } else {
      adapted.max_tokens = options.maxTokens;
    }
  }
  
  // Add temperature if supported
  if (options.temperature !== undefined && categoryConfig.supportsTemperature) {
    adapted.temperature = options.temperature;
  }
  
  // Add tools if supported
  if (options.tools && categoryConfig.supportsTools) {
    adapted.tools = options.tools;
  }
  
  // Add tool_choice if supported
  if (options.tool_choice && categoryConfig.supportsTools) {
    adapted.tool_choice = options.tool_choice;
  }
  
  // Add response_format if supported
  if (options.response_format && categoryConfig.supportsResponseFormat) {
    adapted.response_format = options.response_format;
  }
  
  // Log if we stripped out unsupported parameters
  if (options.temperature !== undefined && !categoryConfig.supportsTemperature) {
    console.warn(`[ModelAPIAdapter] Model ${options.model} does not support temperature parameter - stripping`);
  }
  if (options.tools && !categoryConfig.supportsTools) {
    console.warn(`[ModelAPIAdapter] Model ${options.model} does not support tools - stripping`);
  }
  if (options.response_format && !categoryConfig.supportsResponseFormat) {
    console.warn(`[ModelAPIAdapter] Model ${options.model} does not support response_format - stripping`);
  }
  
  return adapted;
}

/**
 * Check if a model supports function calling
 */
export function supportsTools(model: string): boolean {
  const category = detectModelCategory(model);
  return ModelCategories[category].supportsTools;
}

/**
 * Check if a model supports structured output (response_format)
 */
export function supportsResponseFormat(model: string): boolean {
  const category = detectModelCategory(model);
  return ModelCategories[category].supportsResponseFormat;
}

/**
 * Get the appropriate default model for o1/o3 reasoning tasks
 * (Since these models don't support tools, we need a fallback)
 */
export function getReasoningFallback(model: string): string {
  const category = detectModelCategory(model);
  
  if (category === 'REASONING') {
    // If user selected reasoning model but we need tools,
    // fallback to best available model
    return 'gpt-4o'; // Best balance of capability and speed
  }
  
  return model;
}

