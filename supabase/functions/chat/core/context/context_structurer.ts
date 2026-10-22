// Context Structurer - Context Formatting and Organization
// Structures context for optimal AI model consumption

import {
  ContextCandidate,
  ContextSource,
  ContextPriority,
  ConversationContext,
} from './context_retriever.ts';

// ============================
// Interfaces
// ============================

export interface ContextWindow {
  sections: ContextSection[];
  total_tokens: number;
  structure_type: StructureType;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface ContextSection {
  id: string;
  title: string;
  content: string;
  source: ContextSource;
  priority: ContextPriority;
  token_count: number;
  relevance_score: number;
  metadata: Record<string, any>;
}

export enum StructureType {
  HIERARCHICAL = 'hierarchical',
  CHRONOLOGICAL = 'chronological',
  PRIORITY_BASED = 'priority_based',
  SOURCE_GROUPED = 'source_grouped',
  OPTIMIZED = 'optimized',
  FALLBACK = 'fallback',
}

export interface StructuringOptions {
  structure_type?: StructureType;
  include_metadata?: boolean;
  add_section_markers?: boolean;
  optimize_for_model?: string;
  max_section_length?: number;
}

export interface ContextTemplate {
  name: string;
  structure_type: StructureType;
  section_format: string;
  separator: string;
  header_format?: string;
  footer_format?: string;
}

// ============================
// Context Structurer Implementation
// ============================

export class ContextStructurer {
  private templates: Map<StructureType, ContextTemplate> = new Map([
    [StructureType.HIERARCHICAL, {
      name: 'Hierarchical Structure',
      structure_type: StructureType.HIERARCHICAL,
      section_format: '## {title}\n{content}\n',
      separator: '\n---\n',
      header_format: '# Context Information\n\n',
      footer_format: '\n---\n*End of Context*',
    }],
    [StructureType.PRIORITY_BASED, {
      name: 'Priority-Based Structure',
      structure_type: StructureType.PRIORITY_BASED,
      section_format: '**{title}** (Priority: {priority})\n{content}\n',
      separator: '\n\n',
    }],
    [StructureType.SOURCE_GROUPED, {
      name: 'Source-Grouped Structure',
      structure_type: StructureType.SOURCE_GROUPED,
      section_format: '### {source}: {title}\n{content}\n',
      separator: '\n',
      header_format: '# Context by Source\n\n',
    }],
    [StructureType.OPTIMIZED, {
      name: 'Optimized Structure',
      structure_type: StructureType.OPTIMIZED,
      section_format: '{content}',
      separator: ' | ',
    }],
  ]);
  
  /**
   * Structure context candidates into a formatted context window
   */
  async structure(
    candidates: ContextCandidate[],
    conversationContext: ConversationContext,
    options: StructuringOptions = {}
  ): Promise<ContextWindow> {
    const structureType = options.structure_type || StructureType.OPTIMIZED;
    
    // Convert candidates to sections
    const sections = await this.createSections(candidates, options);
    
    // Sort sections based on structure type
    const sortedSections = this.sortSections(sections, structureType);
    
    // Apply template formatting
    const formattedSections = this.applyFormatting(sortedSections, structureType, options);
    
    // Calculate total tokens
    const totalTokens = formattedSections.reduce((sum, section) => sum + section.token_count, 0);
    
    return {
      sections: formattedSections,
      total_tokens: totalTokens,
      structure_type: structureType,
      created_at: new Date().toISOString(),
      metadata: {
        conversation_id: conversationContext.conversation_id,
        agent_id: conversationContext.agent_id,
        original_candidates: candidates.length,
        structured_sections: formattedSections.length,
      },
    };
  }
  
  /**
   * Convert candidates to structured sections
   */
  private async createSections(
    candidates: ContextCandidate[],
    options: StructuringOptions
  ): Promise<ContextSection[]> {
    return candidates.map((candidate, index) => ({
      id: candidate.id || `section_${index}`,
      title: this.generateSectionTitle(candidate),
      content: this.formatSectionContent(candidate, options),
      source: candidate.source,
      priority: candidate.priority || ContextPriority.MEDIUM,
      token_count: candidate.token_count,
      relevance_score: candidate.relevance.composite_score,
      metadata: {
        ...candidate.metadata,
        original_token_count: candidate.token_count,
        compression_applied: candidate.metadata?.compression_applied,
      },
    }));
  }
  
  /**
   * Sort sections based on structure type
   */
  private sortSections(
    sections: ContextSection[],
    structureType: StructureType
  ): ContextSection[] {
    switch (structureType) {
      case StructureType.PRIORITY_BASED:
        return sections.sort((a, b) => a.priority - b.priority);
        
      case StructureType.CHRONOLOGICAL:
        return sections.sort((a, b) => {
          const aTime = a.metadata.timestamp || a.metadata.created_at || '0';
          const bTime = b.metadata.timestamp || b.metadata.created_at || '0';
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
        
      case StructureType.SOURCE_GROUPED:
        return sections.sort((a, b) => {
          if (a.source !== b.source) {
            return a.source.localeCompare(b.source);
          }
          return b.relevance_score - a.relevance_score;
        });
        
      case StructureType.HIERARCHICAL:
        return sections.sort((a, b) => {
          // First by priority, then by relevance
          if (a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          return b.relevance_score - a.relevance_score;
        });
        
      case StructureType.OPTIMIZED:
      default:
        // Sort by relevance score (highest first)
        return sections.sort((a, b) => b.relevance_score - a.relevance_score);
    }
  }
  
  /**
   * Apply template formatting to sections
   */
  private applyFormatting(
    sections: ContextSection[],
    structureType: StructureType,
    options: StructuringOptions
  ): ContextSection[] {
    const template = this.templates.get(structureType);
    
    if (!template) {
      return sections; // Return unformatted if no template
    }
    
    return sections.map(section => {
      let formattedContent = section.content;
      
      // Apply section formatting
      if (template.section_format) {
        formattedContent = this.applyTemplate(template.section_format, {
          title: section.title,
          content: section.content,
          source: this.formatSourceName(section.source),
          priority: this.formatPriorityName(section.priority),
          relevance: section.relevance_score.toFixed(2),
        });
      }
      
      // Add metadata if requested
      if (options.include_metadata) {
        formattedContent += this.formatMetadata(section.metadata);
      }
      
      // Add section markers if requested
      if (options.add_section_markers) {
        formattedContent = `[SECTION_START:${section.id}]\n${formattedContent}\n[SECTION_END:${section.id}]`;
      }
      
      return {
        ...section,
        content: formattedContent,
        token_count: this.estimateTokens(formattedContent),
      };
    });
  }
  
  /**
   * Generate appropriate section title
   */
  private generateSectionTitle(candidate: ContextCandidate): string {
    // Use existing title if available
    if (candidate.metadata?.title) {
      return candidate.metadata.title;
    }
    
    // Generate title based on source
    switch (candidate.source) {
      case ContextSource.CONVERSATION_HISTORY:
        const role = candidate.metadata?.role || 'Message';
        const timestamp = candidate.metadata?.timestamp;
        return timestamp 
          ? `${role} (${new Date(timestamp).toLocaleTimeString()})`
          : role;
        
      case ContextSource.EPISODIC_MEMORY:
        const memoryType = candidate.metadata?.memory_type || 'Memory';
        return `${memoryType} Memory`;
        
      case ContextSource.SEMANTIC_MEMORY:
        return 'Knowledge';
        
      case ContextSource.AGENT_STATE:
        const stateType = candidate.metadata?.state_type || 'State';
        return `Agent ${stateType}`;
        
      case ContextSource.KNOWLEDGE_BASE:
        return 'Knowledge Base';
        
      case ContextSource.TOOL_CONTEXT:
        return 'Tool Context';
        
      default:
        return 'Context';
    }
  }
  
  /**
   * Format section content
   */
  private formatSectionContent(
    candidate: ContextCandidate,
    options: StructuringOptions
  ): string {
    let content = typeof candidate.content === 'string' 
      ? candidate.content 
      : JSON.stringify(candidate.content, null, 2);
    
    // Apply max section length if specified
    if (options.max_section_length && content.length > options.max_section_length) {
      content = content.substring(0, options.max_section_length) + '...';
    }
    
    // Clean up content
    content = content.trim();
    
    // Remove excessive whitespace
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return content;
  }
  
  /**
   * Apply template with variable substitution
   */
  private applyTemplate(template: string, variables: Record<string, string>): string {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }
    
    return result;
  }
  
  /**
   * Format source name for display
   */
  private formatSourceName(source: ContextSource): string {
    switch (source) {
      case ContextSource.CONVERSATION_HISTORY:
        return 'Conversation';
      case ContextSource.EPISODIC_MEMORY:
        return 'Episodic Memory';
      case ContextSource.SEMANTIC_MEMORY:
        return 'Semantic Memory';
      case ContextSource.AGENT_STATE:
        return 'Agent State';
      case ContextSource.KNOWLEDGE_BASE:
        return 'Knowledge Base';
      case ContextSource.TOOL_CONTEXT:
        return 'Tool Context';
      default:
        return 'Unknown';
    }
  }
  
  /**
   * Format priority name for display
   */
  private formatPriorityName(priority: ContextPriority): string {
    switch (priority) {
      case ContextPriority.CRITICAL:
        return 'Critical';
      case ContextPriority.HIGH:
        return 'High';
      case ContextPriority.MEDIUM:
        return 'Medium';
      case ContextPriority.LOW:
        return 'Low';
      case ContextPriority.OPTIONAL:
        return 'Optional';
      default:
        return 'Medium';
    }
  }
  
  /**
   * Format metadata for display
   */
  private formatMetadata(metadata: Record<string, any>): string {
    const relevantMetadata = Object.entries(metadata)
      .filter(([key, value]) => 
        !['title', 'original_token_count'].includes(key) && 
        value !== undefined && 
        value !== null
      )
      .slice(0, 3); // Limit to top 3 metadata items
    
    if (relevantMetadata.length === 0) {
      return '';
    }
    
    const metadataString = relevantMetadata
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    
    return `\n*Metadata: ${metadataString}*`;
  }
  
  /**
   * Create a context window from raw text (fallback)
   */
  createFallbackContext(
    text: string,
    source: ContextSource = ContextSource.CONVERSATION_HISTORY
  ): ContextWindow {
    const section: ContextSection = {
      id: 'fallback_section',
      title: 'Context',
      content: text,
      source: source,
      priority: ContextPriority.MEDIUM,
      token_count: this.estimateTokens(text),
      relevance_score: 0.5,
      metadata: {
        fallback: true,
        created_at: new Date().toISOString(),
      },
    };
    
    return {
      sections: [section],
      total_tokens: section.token_count,
      structure_type: StructureType.FALLBACK,
      created_at: new Date().toISOString(),
      metadata: {
        fallback: true,
      },
    };
  }
  
  /**
   * Optimize context structure for specific model
   */
  optimizeForModel(
    contextWindow: ContextWindow,
    modelName: string
  ): ContextWindow {
    // Model-specific optimizations
    switch (modelName.toLowerCase()) {
      case 'gpt-4':
      case 'gpt-4-turbo':
        return this.optimizeForGPT4(contextWindow);
        
      case 'claude':
      case 'claude-3':
        return this.optimizeForClaude(contextWindow);
        
      case 'llama':
        return this.optimizeForLlama(contextWindow);
        
      default:
        return contextWindow;
    }
  }
  
  private optimizeForGPT4(contextWindow: ContextWindow): ContextWindow {
    // GPT-4 optimizations: clear structure, markdown formatting
    const optimizedSections = contextWindow.sections.map(section => ({
      ...section,
      content: `## ${section.title}\n\n${section.content}\n`,
    }));
    
    return {
      ...contextWindow,
      sections: optimizedSections,
      structure_type: StructureType.HIERARCHICAL,
    };
  }
  
  private optimizeForClaude(contextWindow: ContextWindow): ContextWindow {
    // Claude optimizations: XML-like tags, clear separation
    const optimizedSections = contextWindow.sections.map(section => ({
      ...section,
      content: `<section title="${section.title}" source="${section.source}">\n${section.content}\n</section>`,
    }));
    
    return {
      ...contextWindow,
      sections: optimizedSections,
      structure_type: StructureType.OPTIMIZED,
    };
  }
  
  private optimizeForLlama(contextWindow: ContextWindow): ContextWindow {
    // Llama optimizations: simple structure, minimal formatting
    const optimizedSections = contextWindow.sections.map(section => ({
      ...section,
      content: `${section.title}: ${section.content}`,
    }));
    
    return {
      ...contextWindow,
      sections: optimizedSections,
      structure_type: StructureType.OPTIMIZED,
    };
  }
  
  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Get structure template
   */
  getTemplate(structureType: StructureType): ContextTemplate | undefined {
    return this.templates.get(structureType);
  }
  
  /**
   * Register custom template
   */
  registerTemplate(template: ContextTemplate): void {
    this.templates.set(template.structure_type, template);
  }
}