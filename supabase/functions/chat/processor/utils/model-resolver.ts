/**
 * Model Resolver - Centralized Agent Model Resolution
 * 
 * Resolves the correct LLM model for an agent based on their UI selection in agent_llm_preferences.
 * Provides intelligent fallbacks and caching to prevent excessive database queries.
 * 
 * Created: October 22, 2025
 */

type SupabaseClient = any;

export interface ModelResolutionResult {
  model: string;
  provider: string;
  fromCache: boolean;
}

/**
 * Context for model resolution - determines fallback strategy
 */
export type ModelContext = 
  | 'fast'        // Quick operations (contextual awareness, intent classification)
  | 'main'        // Main LLM call
  | 'embedding';  // Embedding operations

/**
 * Model Resolver - Resolves agent models with caching and intelligent fallbacks
 */
export class ModelResolver {
  private modelCache: Map<string, { model: string; provider: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute cache
  
  constructor(private supabase: SupabaseClient) {}
  
  /**
   * Get the agent's selected model with intelligent fallbacks
   * 
   * @param agentId - Agent ID
   * @param context - Context for model selection (fast, main, embedding)
   * @returns Model string (e.g., 'gpt-4o', 'claude-3-5-sonnet')
   */
  async getAgentModel(
    agentId: string | undefined,
    context: ModelContext = 'main'
  ): Promise<ModelResolutionResult> {
    // If no agent ID, use context-appropriate default
    if (!agentId) {
      return this.getDefaultModel(context);
    }
    
    // Check cache first
    const cacheKey = `${agentId}:${context}`;
    const cached = this.modelCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return {
        model: cached.model,
        provider: cached.provider,
        fromCache: true
      };
    }
    
    // Fetch from database
    try {
      const { data, error } = await this.supabase
        .from('agent_llm_preferences')
        .select('model, provider')
        .eq('agent_id', agentId)
        .maybeSingle();
      
      if (error) {
        console.warn(`[ModelResolver] Error fetching preferences for agent ${agentId}:`, error);
        return this.getDefaultModel(context);
      }
      
      if (!data) {
        console.log(`[ModelResolver] No preferences found for agent ${agentId}, using defaults`);
        return this.getDefaultModel(context);
      }
      
      // Agent has preferences - determine appropriate model based on context
      console.log(`[ModelResolver] Agent preferences: model=${data.model}, provider=${data.provider}, context=${context}`);
      
      const model = this.resolveModelForContext(data.model, data.provider, context);
      const provider = data.provider || 'openai';
      
      // Cache the result
      this.modelCache.set(cacheKey, {
        model,
        provider,
        timestamp: Date.now()
      });
      
      // Clean up old cache entries periodically
      if (this.modelCache.size > 100) {
        this.cleanupCache();
      }
      
      console.log(`[ModelResolver] Resolved model for agent ${agentId} (${context}): ${data.model} → ${model} (${provider})`);
      
      return {
        model,
        provider,
        fromCache: false
      };
      
    } catch (err) {
      console.error(`[ModelResolver] Unexpected error:`, err);
      return this.getDefaultModel(context);
    }
  }
  
  /**
   * Resolve the appropriate model based on context
   * For "fast" context, may substitute a faster model if agent selected a slow one
   */
  private resolveModelForContext(
    agentModel: string,
    provider: string,
    context: ModelContext
  ): string {
    // For fast contexts (contextual awareness, intent classification)
    // Use a faster model if the agent selected a slow one
    if (context === 'fast') {
      const slowModels = [
        'gpt-4',
        'gpt-4-turbo',
        'claude-3-opus-20240229',
        'claude-3-5-sonnet-20241022',
        'claude-3-7-sonnet-20250219',
        'gemini-1.5-pro'
      ];
      
      if (slowModels.includes(agentModel)) {
        // Use provider-appropriate fast model
        if (provider === 'anthropic') {
          return 'claude-3-haiku-20240307'; // Fast Claude model
        } else if (provider === 'google') {
          return 'gemini-1.5-flash';
        } else {
          return 'gpt-4o-mini'; // Fast OpenAI model
        }
      }
    }
    
    // For embedding context, use embedding-specific models
    if (context === 'embedding') {
      if (provider === 'openai') {
        return 'text-embedding-3-small';
      }
      // Other providers would return their embedding models
    }
    
    // For main context or already fast models, return as-is
    return agentModel;
  }
  
  /**
   * Get default model based on context
   */
  private getDefaultModel(context: ModelContext): ModelResolutionResult {
    switch (context) {
      case 'fast':
        return {
          model: 'gpt-4o-mini',
          provider: 'openai',
          fromCache: false
        };
      case 'embedding':
        return {
          model: 'text-embedding-3-small',
          provider: 'openai',
          fromCache: false
        };
      case 'main':
      default:
        return {
          model: 'gpt-4',
          provider: 'openai',
          fromCache: false
        };
    }
  }
  
  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.modelCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.modelCache.delete(key);
      }
    }
  }
  
  /**
   * Clear all cached models
   */
  clearCache(): void {
    this.modelCache.clear();
  }
  
  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.modelCache.size,
      ttl: this.CACHE_TTL
    };
  }
}

/**
 * Helper function to create a singleton ModelResolver instance
 */
export function createModelResolver(supabase: SupabaseClient): ModelResolver {
  return new ModelResolver(supabase);
}

