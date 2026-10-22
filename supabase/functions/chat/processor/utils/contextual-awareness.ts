/**
 * Contextual Awareness Layer
 * 
 * Interprets user messages in the context of conversation history, summary, and agent personality
 * to understand what the user is ACTUALLY asking for, not just the literal text.
 * 
 * This layer runs BEFORE intent classification to enrich the understanding of user intent.
 */

// Import type from shared location
type SupabaseClient = any;

import { ModelResolver } from './model-resolver.ts';
import { callOpenAIResponsesAPI } from './openai-responses-caller.ts';

export interface ContextualInterpretation {
  /** The user's original message */
  originalMessage: string;
  
  /** Interpreted meaning in context */
  interpretedMeaning: string;
  
  /** What the user is actually asking for */
  userIntent: string;
  
  /** Key contextual factors that informed the interpretation */
  contextualFactors: string[];
  
  /** Confidence in the interpretation */
  confidence: 'high' | 'medium' | 'low';
  
  /** Any implicit references resolved (e.g., "that contact" -> "John Doe") */
  resolvedReferences?: Record<string, string>;
  
  /** Suggested clarifications if intent is ambiguous */
  suggestedClarifications?: string[];
  
  /** Time taken for contextual analysis */
  analysisTimeMs: number;
  
  /** Whether this was cached */
  fromCache: boolean;
  
  /** Token usage for this LLM call */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ConversationSummary {
  summary?: string;
  keyFacts?: any[];
  actionItems?: any[];
  topics?: string[];
  entities?: Record<string, string[]>;
}

interface RecentMessage {
  role: string;
  content: string;
}

/**
 * System prompt for contextual awareness analysis
 */
const CONTEXTUAL_AWARENESS_SYSTEM_PROMPT = `You are a contextual awareness analyzer for an AI agent conversation system.

Your job is to interpret what the user is ACTUALLY asking for, considering:
1. **Conversation history** - What was discussed recently?
2. **Conversation summary** - What are the key facts, topics, and entities?
3. **Implicit references** - Does the user refer to something from earlier? ("that contact", "the email", "it", "them")
4. **Agent personality** - What does this agent specialize in?
5. **Contextual clues** - Are there time references ("yesterday", "last week"), pronouns, or vague terms?

CRITICAL RULES:
- If the user says "send it" after discussing an email → they mean "send the email we discussed"
- If the user says "find them" after mentioning contacts → they mean "find those specific contacts"
- If the user says "that one" → identify what "that one" refers to from context
- If the user uses pronouns (it, that, them, he, she) → resolve them to specific entities
- If the message is vague but follows a clear topic → respond by asking for clarification

OUTPUT FORMAT (JSON only):
{
  "interpretedMeaning": "Clear statement of what the user means in context",
  "userIntent": "What the user wants to accomplish",
  "contextualFactors": ["factor1", "factor2", "..."],
  "confidence": "high|medium|low",
  "resolvedReferences": {
    "it": "the draft email to john@example.com",
    "them": "contacts John Doe and Jane Smith"
  },
  "suggestedClarifications": ["optional clarification question if ambiguous"]
}

EXAMPLES:

Example 1:
Recent messages: User discussed finding contact "John Doe"
Current message: "Send him an email"
Output:
{
  "interpretedMeaning": "Send an email to John Doe (the contact just discussed)",
  "userIntent": "Compose and send an email to John Doe",
  "contextualFactors": ["Recent discussion about John Doe", "Pronoun 'him' refers to John Doe"],
  "confidence": "high",
  "resolvedReferences": { "him": "John Doe" }
}

Example 2:
Summary: User is working on a sales proposal for Acme Corp
Current message: "What's the status?"
Output:
{
  "interpretedMeaning": "What's the status of the sales proposal for Acme Corp?",
  "userIntent": "Get an update on the Acme Corp sales proposal",
  "contextualFactors": ["Active topic: Acme Corp sales proposal", "Implied reference to ongoing work"],
  "confidence": "high",
  "resolvedReferences": { "the status": "status of Acme Corp sales proposal" }
}

Example 3:
Recent messages: No relevant context
Current message: "Schedule a meeting"
Output:
{
  "interpretedMeaning": "User wants to schedule a meeting but hasn't specified with whom or when",
  "userIntent": "Schedule a new meeting",
  "contextualFactors": ["No prior context", "Request is clear but lacks details"],
  "confidence": "medium",
  "suggestedClarifications": ["Who should attend the meeting?", "When should the meeting be scheduled?"]
}`;

/**
 * Contextual Awareness Analyzer
 */
export class ContextualAwarenessAnalyzer {
  private cache: Map<string, ContextualInterpretation> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly CACHE_MAX_SIZE = 500;
  
  // System prompt caching
  private systemPrompt: string | null = null;
  private promptLastFetched: number = 0;
  private readonly PROMPT_CACHE_TTL = 300000; // 5 minutes
  
  // Model resolver
  private modelResolver: ModelResolver;
  
  constructor(
    private openai: any,
    private supabase: SupabaseClient
  ) {
    this.modelResolver = new ModelResolver(supabase);
  }
  
  /**
   * Fetch the contextual awareness prompt from database with caching
   */
  private async getSystemPrompt(): Promise<string> {
    const now = Date.now();
    
    // Return cached prompt if still valid
    if (this.systemPrompt && (now - this.promptLastFetched) < this.PROMPT_CACHE_TTL) {
      return this.systemPrompt;
    }
    
    // Try to fetch from database
    try {
      const { data, error } = await this.supabase
        .from('system_prompts')
        .select('content')
        .eq('key', 'contextual_awareness')
        .eq('is_active', true)
        .single();
      
      if (!error && data?.content) {
        this.systemPrompt = data.content;
        this.promptLastFetched = now;
        console.log('[ContextualAwareness] ✅ Loaded prompt from database');
        return data.content; // Return the content directly to satisfy TypeScript
      }
    } catch (error) {
      console.warn('[ContextualAwareness] ⚠️ Error fetching prompt from database, using hardcoded fallback:', error);
    }
    
    // Fallback to hardcoded prompt
    this.systemPrompt = CONTEXTUAL_AWARENESS_SYSTEM_PROMPT;
    this.promptLastFetched = now;
    console.log('[ContextualAwareness] Using hardcoded fallback prompt');
    return this.systemPrompt;
  }
  
  /**
   * Analyze user message in full conversation context
   * 
   * @param userMessage - The current user message
   * @param conversationId - Conversation ID for fetching summary
   * @param agentId - Agent ID for personality context
   * @param recentMessages - Recent conversation history (last 5-10 messages)
   * @returns Contextual interpretation with resolved references
   */
  async analyzeContext(
    userMessage: string,
    conversationId: string | undefined,
    agentId: string | undefined,
    recentMessages?: RecentMessage[]
  ): Promise<ContextualInterpretation> {
    const startTime = Date.now();
    
    // Quick validation
    if (!userMessage || userMessage.trim().length === 0) {
      console.log('[ContextualAwareness] Empty message - no context needed');
      return {
        originalMessage: '',
        interpretedMeaning: '',
        userIntent: 'empty_message',
        contextualFactors: [],
        confidence: 'high',
        analysisTimeMs: Date.now() - startTime,
        fromCache: false
      };
    }
    
    // Check cache
    const cacheKey = this.generateCacheKey(userMessage, conversationId, recentMessages);
    const cached = this.getCached(cacheKey);
    if (cached) {
      console.log('[ContextualAwareness] ✅ Cache hit');
      return { ...cached, fromCache: true };
    }
    
    console.log('[ContextualAwareness] 🔍 Analyzing contextual meaning...');
    
    try {
      // Gather contextual data in parallel
      const [summary, agentInfo] = await Promise.all([
        this.getConversationSummary(conversationId),
        this.getAgentInfo(agentId)
      ]);
      
      // Build context-rich prompt for LLM
      const contextPrompt = this.buildContextPrompt(
        userMessage,
        recentMessages || [],
        summary,
        agentInfo
      );
      
      // Call LLM for contextual interpretation
      const interpretation = await this.performContextualAnalysis(
        userMessage,
        contextPrompt,
        agentId
      );
      
      interpretation.analysisTimeMs = Date.now() - startTime;
      interpretation.fromCache = false;
      
      console.log('[ContextualAwareness] ✅ Interpretation complete:', {
        intent: interpretation.userIntent,
        confidence: interpretation.confidence,
        resolvedRefs: Object.keys(interpretation.resolvedReferences || {}).length,
        timeMs: interpretation.analysisTimeMs
      });
      
      // Cache result
      this.setCached(cacheKey, interpretation);
      
      return interpretation;
      
    } catch (error: any) {
      console.error('[ContextualAwareness] ❌ Analysis failed:', error.message);
      
      // Fallback: return original message as-is
      return {
        originalMessage: userMessage,
        interpretedMeaning: userMessage,
        userIntent: 'context_analysis_failed',
        contextualFactors: [`Analysis error: ${error.message}`],
        confidence: 'low',
        analysisTimeMs: Date.now() - startTime,
        fromCache: false
      };
    }
  }
  
  /**
   * Build context-rich prompt for LLM analysis
   */
  private buildContextPrompt(
    userMessage: string,
    recentMessages: RecentMessage[],
    summary: ConversationSummary | null,
    agentInfo: any
  ): string {
    const parts: string[] = [];
    
    // Agent personality context
    if (agentInfo?.name) {
      parts.push(`AGENT PROFILE:\nName: ${agentInfo.name}`);
      if (agentInfo.personality) {
        parts.push(`Personality: ${agentInfo.personality}`);
      }
      if (agentInfo.description) {
        parts.push(`Specialization: ${agentInfo.description}`);
      }
    }
    
    // Conversation summary context
    if (summary) {
      if (summary.summary) {
        parts.push(`\nCONVERSATION SUMMARY:\n${summary.summary}`);
      }
      
      if (summary.keyFacts && summary.keyFacts.length > 0) {
        parts.push(`\nKEY FACTS:\n${summary.keyFacts.map((f: any) => `- ${f.fact || f}`).join('\n')}`);
      }
      
      if (summary.topics && summary.topics.length > 0) {
        parts.push(`\nTOPICS DISCUSSED:\n${summary.topics.join(', ')}`);
      }
      
      if (summary.entities) {
        const entityList = Object.entries(summary.entities)
          .flatMap(([type, names]) => (names as string[]).map(name => `${type}: ${name}`))
          .slice(0, 10); // Limit to 10 entities
        if (entityList.length > 0) {
          parts.push(`\nKNOWN ENTITIES:\n${entityList.join('\n')}`);
        }
      }
      
      if (summary.actionItems && summary.actionItems.length > 0) {
        parts.push(`\nPENDING ACTION ITEMS:\n${summary.actionItems.map((item: any) => `- ${item.text || item}`).join('\n')}`);
      }
    }
    
    // Recent conversation history
    if (recentMessages.length > 0) {
      parts.push(`\nRECENT CONVERSATION (last ${recentMessages.length} messages):`);
      recentMessages.forEach((msg, idx) => {
        const role = msg.role === 'user' ? 'User' : 'Agent';
        const preview = msg.content.substring(0, 200);
        parts.push(`${idx + 1}. ${role}: ${preview}${msg.content.length > 200 ? '...' : ''}`);
      });
    }
    
    // Current user message
    parts.push(`\nCURRENT USER MESSAGE:\n"${userMessage}"`);
    
    parts.push(`\nNow analyze what the user ACTUALLY means in this context.`);
    
    return parts.join('\n');
  }
  
  /**
   * Perform contextual analysis using LLM
   */
  private async performContextualAnalysis(
    userMessage: string,
    contextPrompt: string,
    agentId: string | undefined
  ): Promise<ContextualInterpretation> {
    // Fetch system prompt from database (with caching)
    const systemPromptContent = await this.getSystemPrompt();
    
    // Resolve model - use agent's model or fast fallback
    const { model } = await this.modelResolver.getAgentModel(agentId, 'fast');
    
    // Get API key from OpenAI instance
    const apiKey = (this.openai as any).apiKey || '';
    
    // Call OpenAI using Responses API
    const response = await callOpenAIResponsesAPI(apiKey, {
      model,
      messages: [
        { role: 'system', content: systemPromptContent },
        { role: 'user', content: contextPrompt }
      ],
      temperature: 0.3, // Lower temperature for consistent analysis
      maxTokens: 500,
      responseFormat: { type: 'json_object' }
    });
    
    const parsed = JSON.parse(response.content || '{}');
    
    // Use token usage from response
    const usage = response.usage;
    
    return {
      originalMessage: userMessage,
      usage, // Add usage stats
      interpretedMeaning: parsed.interpretedMeaning || userMessage,
      userIntent: parsed.userIntent || 'unknown',
      contextualFactors: parsed.contextualFactors || [],
      confidence: parsed.confidence || 'medium',
      resolvedReferences: parsed.resolvedReferences || {},
      suggestedClarifications: parsed.suggestedClarifications,
      analysisTimeMs: 0, // Will be set by caller
      fromCache: false
    };
  }
  
  /**
   * Get conversation summary from database
   */
  private async getConversationSummary(
    conversationId: string | undefined
  ): Promise<ConversationSummary | null> {
    if (!conversationId) return null;
    
    try {
      const { data, error } = await this.supabase
        .from('conversation_summary_boards')
        .select('current_summary, important_facts, action_items, topics, entities')
        .eq('conversation_id', conversationId)
        .maybeSingle();
      
      if (error || !data) return null;
      
      return {
        summary: data.current_summary,
        keyFacts: data.important_facts || [],
        actionItems: data.action_items || [],
        topics: data.topics || [],
        entities: data.entities || {}
      };
    } catch (err) {
      console.warn('[ContextualAwareness] Failed to fetch summary:', err);
      return null;
    }
  }
  
  /**
   * Get agent personality and specialization
   */
  private async getAgentInfo(agentId: string | undefined): Promise<any> {
    if (!agentId) return null;
    
    try {
      const { data, error } = await this.supabase
        .from('agents')
        .select('name, personality, description')
        .eq('id', agentId)
        .single();
      
      return error ? null : data;
    } catch (err) {
      console.warn('[ContextualAwareness] Failed to fetch agent info:', err);
      return null;
    }
  }
  
  /**
   * Generate cache key
   */
  private generateCacheKey(
    message: string,
    conversationId: string | undefined,
    recentMessages?: RecentMessage[]
  ): string {
    // Include last 2 messages in cache key for context sensitivity
    const recentContext = recentMessages
      ?.slice(-2)
      .map(m => `${m.role}:${m.content.substring(0, 50)}`)
      .join('|') || '';
    
    return `${conversationId || 'new'}:${message.substring(0, 100)}:${recentContext}`;
  }
  
  /**
   * Get cached interpretation
   */
  private getCached(key: string): ContextualInterpretation | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() - cached.analysisTimeMs > this.CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    
    return cached;
  }
  
  /**
   * Set cached interpretation
   */
  private setCached(key: string, interpretation: ContextualInterpretation): void {
    // Evict oldest if cache is full
    if (this.cache.size >= this.CACHE_MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, interpretation);
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.CACHE_MAX_SIZE
    };
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[ContextualAwareness] Cache cleared');
  }
}

