import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import type { ProcessingContext } from '../types.ts';

export interface AgentData {
  name?: string;
  description?: string;
  personality?: string;
  system_instructions?: string;
  assistant_instructions?: string;
}

export class PromptBuilder {
  private promptCache: Map<string, string> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastFetch: number = 0;

  constructor(private supabase: SupabaseClient) {}

  /**
   * Fetch system prompts from database with caching
   */
  private async fetchSystemPrompts(): Promise<Map<string, string>> {
    const now = Date.now();
    
    // Return cached prompts if still valid
    if (this.promptCache.size > 0 && (now - this.lastFetch) < this.cacheExpiry) {
      return this.promptCache;
    }

    try {
      const { data: prompts, error } = await this.supabase
        .from('system_prompts')
        .select('key, content')
        .eq('is_active', true);

      if (error) {
        console.error('[PromptBuilder] Error fetching system prompts:', error);
        // Return cached prompts as fallback
        if (this.promptCache.size > 0) return this.promptCache;
        // Return empty map if no cache
        return new Map();
      }

      // Update cache
      this.promptCache.clear();
      prompts?.forEach((p: any) => {
        this.promptCache.set(p.key, p.content);
      });
      this.lastFetch = now;

      console.log(`[PromptBuilder] Loaded ${this.promptCache.size} system prompts from database`);
      return this.promptCache;
    } catch (error) {
      console.error('[PromptBuilder] Exception fetching system prompts:', error);
      // Return existing cache as fallback
      return this.promptCache;
    }
  }

  /**
   * Get a specific prompt by key, with fallback to hardcoded default
   */
  private async getPrompt(key: string, fallback: string): Promise<string> {
    const prompts = await this.fetchSystemPrompts();
    return prompts.get(key) || fallback;
  }

  /**
   * Fetch agent data from database
   */
  async fetchAgentData(agentId: string): Promise<AgentData | null> {
    const { data: agent } = await this.supabase
      .from('agents')
      .select('system_instructions, assistant_instructions, description, personality, name')
      .eq('id', agentId)
      .single();
    
    return agent;
  }

  /**
   * Build agent identity section
   */
  async buildAgentIdentity(agent: AgentData | null): Promise<string[]> {
    const sections: string[] = [];
    
    // Fetch template from database
    const template = await this.getPrompt('agent_identity_template', 
      `=== AGENT IDENTITY ===
Your name is "{agent_name}".
You MUST always identify yourself by this name when asked.
{role}
{personality}
When asked "What is your name?" or "Who are you?", you MUST respond with: "My name is {agent_name}"
=== END AGENT IDENTITY ===`);
    
    // Replace placeholders
    let identityPrompt = template
      .replace(/{agent_name}/g, agent?.name || 'Assistant')
      .replace(/{role}/g, agent?.description ? `Your description/role: ${agent.description}` : '')
      .replace(/{personality}/g, agent?.personality ? `Your personality traits: ${agent.personality}\nYou MUST maintain these personality characteristics consistently in all interactions.` : '');
    
    sections.push(identityPrompt);
    sections.push(''); // Blank line
    
    return sections;
  }

  /**
   * Build system instructions section
   */
  buildSystemInstructions(agent: AgentData | null): string[] {
    const sections: string[] = [];
    
    if (agent?.system_instructions) {
      sections.push(`=== SYSTEM INSTRUCTIONS ===`);
      sections.push(agent.system_instructions);
      sections.push(`=== END SYSTEM INSTRUCTIONS ===\n`);
    }
    
    return sections;
  }

  /**
   * Build document access instructions
   */
  async buildDocumentInstructions(): Promise<string[]> {
    const prompt = await this.getPrompt('document_access',
      `=== DOCUMENT ACCESS INSTRUCTIONS ===
IMPORTANT: When users ask about uploaded documents, files, or content they've shared:
1. FIRST use 'search_documents' to find relevant documents
2. THEN use 'get_document_content' to retrieve the actual content
3. Reference the document content directly in your response
4. Always mention the document name/source when referencing content
Examples of when to use document tools:
- "What does the document say about..."
- "Summarize the uploaded file"
- "What are the key points in..."
- "Tell me about the document I uploaded"
=== END DOCUMENT ACCESS INSTRUCTIONS ===`);
    
    return [prompt, ''];
  }

  /**
   * Build artifact creation instructions
   */
  async buildArtifactInstructions(): Promise<string[]> {
    const prompt = await this.getPrompt('artifact_creation',
      `=== ARTIFACT CREATION INSTRUCTIONS ===
CRITICAL: When creating artifacts with 'create_artifact', you MUST ALWAYS provide the 'content' parameter with the COMPLETE file content.

Rules for artifact creation:
1. ALWAYS generate the full content first, then call create_artifact
2. The 'content' parameter is REQUIRED and must contain the complete text/code
3. Never call create_artifact with just a title and file_type - always include content
4. Think of content as "what the user will see when they open the file"

Examples of CORRECT usage:
- create_artifact(title="California Article", file_type="txt", content="California is a state located on the West Coast...")
- create_artifact(title="API Client", file_type="javascript", content="function fetchData() { return fetch('/api/data'); }")

Examples of INCORRECT usage (missing content):
- create_artifact(title="Article", file_type="txt") ❌ WRONG
- create_artifact(title="Script", file_type="python") ❌ WRONG

When users ask you to "create a document", "write a file", or "save this as", immediately generate the full content and call create_artifact with all three parameters.
=== END ARTIFACT CREATION INSTRUCTIONS ===`);
    
    return [prompt, ''];
  }

  /**
   * Build memory handling instructions
   */
  async buildMemoryInstructions(): Promise<string[]> {
    const prompt = await this.getPrompt('memory_handling',
      `=== MEMORY HANDLING INSTRUCTIONS ===
You have access to a CONTEXT WINDOW with EPISODIC and SEMANTIC MEMORY sections injected as assistant messages.

Use these rules to apply memory to the current user request:
1) EPISODIC MEMORY (events/examples):
   - Purpose: continuity, personalization, and recent task alignment.
   - Prioritize recency and direct relevance to the current query.
   - Do NOT restate full content; summarize only what is minimally necessary.
2) SEMANTIC MEMORY (facts/entities/conclusions/concepts):
   - Purpose: factual grounding and domain knowledge.
   - Prefer higher-confidence, multi-source items; prefer well-supported conclusions/concepts derived from 3–6 connected nodes/edges.
   - If conflicts exist, resolve by (a) higher confidence, (b) greater evidence, (c) more recent; if unresolved, note uncertainty briefly.
3) SAFETY & PRIVACY:
   - Never leak raw sensitive content. Summarize and reference sources (e.g., [source: message 2025-08-12]).
4) BREVITY & RELEVANCE:
   - Extract only memory that materially improves the answer. Be concise and avoid repetition.
=== END MEMORY HANDLING INSTRUCTIONS ===`);
    
    return [prompt, ''];
  }

  /**
   * Build markdown formatting instructions
   */
  async buildFormattingInstructions(): Promise<string[]> {
    const prompt = await this.getPrompt('markdown_formatting',
      `CRITICAL FORMATTING INSTRUCTIONS - You MUST format your responses using proper Markdown:

1. **Paragraphs**: Add a blank line between EVERY paragraph for proper spacing.

2. **Lists**: 
   - Use bullet points (- or *) for unordered lists
   - Use numbers (1. 2. 3.) for ordered lists
   - Add a blank line before and after lists
   - Each list item should be on its own line

3. **Emphasis**:
   - Use **bold** for important terms or key points
   - Use *italics* for subtle emphasis or examples
   - Use \`inline code\` for technical terms, commands, or values

4. **Headers**:
   - Use ## for main section headers
   - Use ### for subsection headers
   - Always add a blank line before and after headers

5. **Code Blocks**:
   \`\`\`language
   // Use triple backticks for code blocks
   // Specify the language for syntax highlighting
   \`\`\`

6. **Line Breaks**:
   - ALWAYS add blank lines between different sections
   - ALWAYS add blank lines between paragraphs
   - ALWAYS add blank lines around lists, headers, and code blocks

7. **Structure**:
   - Start with a brief introduction if needed
   - Organize content into logical sections
   - Use headers to separate major topics
   - End with a summary or conclusion if appropriate

EXAMPLE of proper formatting:

## Main Topic

This is the first paragraph with some **important information**.

This is the second paragraph, separated by a blank line. It includes \`technical terms\` in inline code.

### Subsection

Here's a list of items:

- First item with **bold emphasis**
- Second item with *italic text*
- Third item with more details

Another paragraph after the list, properly spaced.

Remember: ALWAYS use blank lines between elements for readability!`);
    
    return [prompt, ''];
  }

  /**
   * Build tool usage guidance
   */
  buildToolGuidance(toolNames: string): string {
    return `You have access to the following tools that can help you complete the user's requests:\n\n${toolNames}\n\n=== TOOL USAGE GUIDELINES ===\n1. ALWAYS use tools when the user asks you to take an action (send email, search, create document, etc.)\n2. Tools have prefixes indicating their provider (gmail_, smtp_, microsoft_outlook_, clicksend_, web_search, etc.)\n3. For email-related requests, check which email tools are available and use the appropriate one\n4. For SMS requests, use the clicksend_ tools\n5. For calendar/contacts requests with Outlook, use the microsoft_outlook_ tools\n6. Use web_search tools for internet searches\n7. Only answer directly (without tools) for simple questions or when no relevant tool exists\n\n=== CRITICAL: YOU MUST USE FUNCTION CALLING ===\n❌ NEVER just say you will do something - you MUST actually call the function\n❌ NEVER respond with text like "I'll send the SMS now" without calling the tool\n❌ NEVER simulate or pretend to take action - USE THE ACTUAL TOOL\n✅ When the user asks you to send/create/search/do ANYTHING, you MUST call the appropriate tool function\n✅ Do not write conversational responses about taking action - TAKE THE ACTION by calling the tool\n\n=== CRITICAL RESPONSE FORMATTING ===\n• When using tools, DO NOT include the raw JSON parameters in your response\n• DO NOT show code blocks like { "to": "...", "message": "..." }\n• Simply state what you're doing in ONE concise sentence, then call the tool\n• After the tool executes, report the result clearly\n• NEVER repeat the same action or explanation multiple times\n\nExample GOOD response:\n"I'll send that summary to Charles now."\n[tool executes]\n"✅ SMS sent successfully to Charles Sears."\n\nExample BAD response:\n"I'll send the SMS now.\n{ \"to\": \"+1234567890\", \"message\": \"...\" }\nNow I'll proceed with sending."\n\nIMPORTANT: When a user asks you to DO something (not just ask about it), you MUST use the appropriate tool. Do not just describe what you would do - actually use the tool to do it.`;
  }

  /**
   * Build final reflection guidance (for after tool execution)
   */
  buildReflectionGuidance(): string {
    return `CRITICAL INSTRUCTION - FINAL RESPONSE FORMAT:

You have just executed tools on behalf of the user. Now provide a DIRECT, RESULTS-FOCUSED response.

✅ CORRECT FORMAT EXAMPLES:
- "I found 3 customers matching your search: [results]"
- "I searched QuickBooks but found no customer named 'Steve Hubble'. The name might be spelled differently or may not exist in your system."
- "Here are the invoice details: [data]"
- "The email has been sent successfully to john@example.com."
- "I attempted to [action] but it failed because [reason]. Would you like me to try [alternative]?"

❌ NEVER DO THIS:
- "I will search for..." (Don't say what you WILL do - you already DID it!)
- "Let's proceed with that now..." (It's already done!)
- "[Executing the search...]" (Don't narrate the process!)
- Step-by-step explanations of what you're doing
- Raw JSON dumps or technical data
- Tool execution summaries

RESPOND AS IF THE TASK IS COMPLETE. Report what happened and what was found (or not found). Be direct and professional.`;
  }

  /**
   * Build reasoning context integration
   */
  buildReasoningContext(reasoningContext: any): string {
    if (!reasoningContext || !reasoningContext.enabled || !reasoningContext.steps?.length) {
      return '';
    }

    let reasoningPrompt = `=== ADVANCED REASONING ANALYSIS ===\n`;
    reasoningPrompt += `The user's query has been analyzed using ${reasoningContext.style?.toUpperCase() || 'ANALYTICAL'} reasoning.\n`;
    reasoningPrompt += `Analysis Confidence: ${(reasoningContext.score * 100).toFixed(1)}% (threshold: ${(reasoningContext.threshold * 100).toFixed(0)}%)\n\n`;
    
    reasoningPrompt += `REASONING CHAIN (${reasoningContext.steps.length} steps):\n`;
    reasoningContext.steps.forEach((step: any, index: number) => {
      const stepNum = index + 1;
      const state = step.state?.toUpperCase() || 'ANALYSIS';
      const confidence = step.confidence ? ` [${(step.confidence * 100).toFixed(0)}% confidence]` : '';
      
      if (step.question) {
        reasoningPrompt += `${stepNum}. [${state}] Question: ${step.question}${confidence}\n`;
      }
      if (step.hypothesis) {
        reasoningPrompt += `${stepNum}. [${state}] Analysis: ${step.hypothesis}${confidence}\n`;
      }
      if (step.description && !step.hypothesis && !step.question) {
        reasoningPrompt += `${stepNum}. [${state}] ${step.description}${confidence}\n`;
      }
      
      if (step.memory_insights?.length > 0) {
        reasoningPrompt += `   → Memory Context: ${step.memory_insights.join(', ')}\n`;
      }
      
      if (step.episodic_count > 0 || step.semantic_count > 0) {
        reasoningPrompt += `   → Memories Referenced: ${step.episodic_count} episodic, ${step.semantic_count} semantic\n`;
      }
    });
    
    const finalStep = reasoningContext.steps[reasoningContext.steps.length - 1];
    if (finalStep && (finalStep.state === 'conclude' || finalStep.type === 'decision')) {
      reasoningPrompt += `\nREASONING CONCLUSION:\n`;
      reasoningPrompt += `${finalStep.hypothesis || finalStep.description}\n`;
      if (finalStep.confidence) {
        reasoningPrompt += `Final Confidence: ${(finalStep.confidence * 100).toFixed(0)}%\n`;
      }
    }
    
    reasoningPrompt += `\nINSTRUCTIONS FOR RESPONSE:\n`;
    reasoningPrompt += `• Build upon the reasoning analysis above\n`;
    reasoningPrompt += `• Incorporate the insights and conclusions reached\n`;
    reasoningPrompt += `• Address any uncertainties identified in the analysis\n`;
    reasoningPrompt += `• Maintain appropriate confidence level based on the reasoning\n`;
    reasoningPrompt += `• Reference the reasoning process when it adds value to your response\n`;
    reasoningPrompt += `=== END REASONING ANALYSIS ===`;
    
    return reasoningPrompt;
  }

  /**
   * Build context window injection
   */
  buildContextWindow(contextWindow: any): string {
    const sections = Array.isArray(contextWindow?.sections) ? contextWindow.sections : [];
    if (sections.length === 0) {
      return '';
    }

    const toLabel = (s: any): string => {
      if (s?.source === 'episodic_memory') return 'EPISODIC MEMORY';
      if (s?.source === 'semantic_memory') return 'SEMANTIC MEMORY';
      return s?.title || 'Context';
    };

    const top = sections
      .slice(0, 4)
      .map((s: any) => `${toLabel(s)}:\n${String(s.content || '').slice(0, 2000)}`);
    
    return [
      '=== CONTEXT WINDOW ===',
      ...top,
      '=== END CONTEXT WINDOW ===\n',
    ].join('\n\n');
  }

  /**
   * Build complete system messages array (old method - for backward compatibility)
   */
  async buildSystemMessages(context: ProcessingContext, message: any): Promise<Array<{ role: 'system' | 'user' | 'assistant'; content: string }>> {
    const msgs: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (!context.agent_id) {
      return msgs;
    }

    // Fetch agent data
    const agent = await this.fetchAgentData(context.agent_id);

    // Build preamble
    const preamble: string[] = [];
    preamble.push(...await this.buildAgentIdentity(agent));
    preamble.push(...this.buildSystemInstructions(agent));
    preamble.push(...await this.buildDocumentInstructions());
    preamble.push(...await this.buildMemoryInstructions());
    preamble.push(...await this.buildFormattingInstructions());

    if (preamble.length) {
      msgs.push({ role: 'system', content: preamble.join('\n') });
    }

    // Add context window as assistant message
    const ctxWin = message?.context?.context_window;
    const contextWindowContent = this.buildContextWindow(ctxWin);
    if (contextWindowContent) {
      msgs.push({ role: 'assistant', content: contextWindowContent });
    }

    // Add assistant instructions
    if (agent?.assistant_instructions) {
      msgs.push({ role: 'assistant', content: agent.assistant_instructions });
    }

    return msgs;
  }

  /**
   * Build comprehensive system prompt string with agent identity, instructions, and guidance
   */
  async buildSystemPromptString(agent: any): Promise<string> {
    const sections: string[] = [];
    const behavior = agent?.metadata?.behavior || {};
    
    // CRITICAL: Agent Identity - Fetch from database
    const identityTemplate = await this.getPrompt('agent_identity_template',
      `=== AGENT IDENTITY ===
Your name is "{agent_name}".
You MUST always identify yourself by this name when asked.
{role}
{personality}
When asked "What is your name?" or "Who are you?", you MUST respond with: "My name is {agent_name}"
=== END AGENT IDENTITY ===`);
    
    const identityRole = behavior.role || agent?.description || '';
    const identityPrompt = identityTemplate
      .replace(/{agent_name}/g, agent?.name || 'Assistant')
      .replace(/{role}/g, identityRole ? `Your role: ${identityRole}` : '')
      .replace(/{personality}/g, agent?.personality ? `Your personality traits: ${agent.personality}\nYou MUST maintain these personality characteristics consistently in all interactions.` : '');
    
    sections.push(identityPrompt);
    
    // Behavior Instructions (from metadata)
    if (behavior.instructions) {
      sections.push(`=== BEHAVIOR INSTRUCTIONS ===
${behavior.instructions}
=== END BEHAVIOR INSTRUCTIONS ===`);
    }
    
    // System instructions come after identity
    if (agent?.system_instructions) {
      sections.push(`=== SYSTEM INSTRUCTIONS ===
${agent.system_instructions}
=== END SYSTEM INSTRUCTIONS ===`);
    }
    
    // Behavior Constraints (from metadata)
    if (behavior.constraints) {
      sections.push(`=== CONSTRAINTS ===
${behavior.constraints}
=== END CONSTRAINTS ===`);
    }
    
    // Behavior Tools (from metadata) - formatted MCP tools
    if (behavior.tools) {
      sections.push(`=== AVAILABLE TOOLS ===
${behavior.tools}
=== END AVAILABLE TOOLS ===`);
    }
    
    // Custom Contexts (from metadata)
    if (behavior.custom_contexts && Array.isArray(behavior.custom_contexts)) {
      for (const context of behavior.custom_contexts) {
        if (context.name && context.content) {
          sections.push(`=== ${context.name.toUpperCase()} ===
${context.content}
=== END ${context.name.toUpperCase()} ===`);
        }
      }
    }
    
    // Rules (from metadata)
    if (behavior.rules && Array.isArray(behavior.rules)) {
      const rulesContent = behavior.rules
        .map((rule: any, idx: number) => `${idx + 1}. ${rule.content}`)
        .join('\n');
      if (rulesContent) {
        sections.push(`=== RULES ===
${rulesContent}
=== END RULES ===`);
      }
    }
    
    // Document tools guidance - fetch from database
    const documentPrompt = await this.getPrompt('document_access',
      `=== DOCUMENT ACCESS INSTRUCTIONS ===
IMPORTANT: When users ask about uploaded documents, files, or content they've shared:
1. FIRST use 'search_documents' to find relevant documents
2. THEN use 'get_document_content' to retrieve the actual content
3. Reference the document content directly in your response
4. Always mention the document name/source when referencing content
Examples of when to use document tools:
- "What does the document say about..."
- "Summarize the uploaded file"
- "What are the key points in..."
- "Tell me about the document I uploaded"
=== END DOCUMENT ACCESS INSTRUCTIONS ===`);
    sections.push(documentPrompt);
    
    // Artifact creation guidance - fetch from database
    const artifactPrompt = await this.getPrompt('artifact_creation',
      `=== ARTIFACT CREATION INSTRUCTIONS ===
CRITICAL: When creating artifacts with 'create_artifact', you MUST ALWAYS provide the 'content' parameter with the COMPLETE file content.

Rules for artifact creation:
1. ALWAYS generate the full content first, then call create_artifact
2. The 'content' parameter is REQUIRED and must contain the complete text/code
3. Never call create_artifact with just a title and file_type - always include content
4. Think of content as "what the user will see when they open the file"

Examples of CORRECT usage:
- create_artifact(title="California Article", file_type="txt", content="California is a state located on the West Coast...")
- create_artifact(title="API Client", file_type="javascript", content="function fetchData() { return fetch('/api/data'); }")

Examples of INCORRECT usage (missing content):
- create_artifact(title="Article", file_type="txt") ❌ WRONG
- create_artifact(title="Script", file_type="python") ❌ WRONG

When users ask you to "create a document", "write a file", or "save this as", immediately generate the full content and call create_artifact with all three parameters.
=== END ARTIFACT CREATION INSTRUCTIONS ===`);
    sections.push(artifactPrompt);
    
    // Memory handling guidance - fetch from database
    const memoryPrompt = await this.getPrompt('memory_handling',
      `=== MEMORY HANDLING INSTRUCTIONS ===
You have access to a CONTEXT WINDOW with EPISODIC and SEMANTIC MEMORY sections injected as assistant messages.

Use these rules to apply memory to the current user request:
1) EPISODIC MEMORY (events/examples):
   - Purpose: continuity, personalization, and recent task alignment.
   - Prioritize recency and direct relevance to the current query.
   - Do NOT restate full content; summarize only what is minimally necessary.
2) SEMANTIC MEMORY (facts/entities/conclusions/concepts):
   - Purpose: factual grounding and domain knowledge.
   - Prefer higher-confidence, multi-source items; prefer well-supported conclusions/concepts derived from 3–6 connected nodes/edges.
   - If conflicts exist, resolve by (a) higher confidence, (b) greater evidence, (c) more recent; if unresolved, note uncertainty briefly.
3) SAFETY & PRIVACY:
   - Never leak raw sensitive content. Summarize and reference sources (e.g., [source: message 2025-08-12]).
4) BREVITY & RELEVANCE:
   - Extract only memory that materially improves the answer. Be concise and avoid repetition.
=== END MEMORY HANDLING INSTRUCTIONS ===`);
    sections.push(memoryPrompt);
    
    // Output formatting guidance - fetch from database
    const formattingPrompts = await this.buildFormattingInstructions();
    sections.push(formattingPrompts.join('\n'));
    
    return sections.join('\n\n');
  }
}

