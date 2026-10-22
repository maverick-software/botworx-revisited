// Context Compressor - Advanced Context Compression
// Applies various compression strategies to fit context within token budgets

import { ContextCandidate } from './context_retriever.ts';

// ============================
// Interfaces
// ============================

export enum CompressionStrategy {
  EXTRACTIVE_SUMMARIZATION = 'extractive_summarization',
  ABSTRACTIVE_SUMMARIZATION = 'abstractive_summarization',
  HIERARCHICAL_COMPRESSION = 'hierarchical_compression',
  SEMANTIC_COMPRESSION = 'semantic_compression',
  TEMPLATE_COMPRESSION = 'template_compression',
  TRUNCATION = 'truncation',
}

export interface CompressionOptions {
  strategy: CompressionStrategy;
  target_compression_ratio: number;
  preserve_critical_info: boolean;
  quality_threshold: number;
}

export interface CompressionResult {
  compressed_candidates: ContextCandidate[];
  compression_ratio: number;
  quality_loss: number;
  compression_time_ms: number;
}

export interface CompressionTemplate {
  name: string;
  pattern: RegExp;
  replacement: string;
  token_savings: number;
}

// ============================
// Context Compressor Implementation
// ============================

export class ContextCompressor {
  private compressionTemplates: CompressionTemplate[] = [
    {
      name: 'json_minification',
      pattern: /\s*:\s*/g,
      replacement: ':',
      token_savings: 0.1,
    },
    {
      name: 'whitespace_reduction',
      pattern: /\s+/g,
      replacement: ' ',
      token_savings: 0.15,
    },
    {
      name: 'redundant_phrases',
      pattern: /\b(the|a|an)\s+/gi,
      replacement: '',
      token_savings: 0.05,
    },
  ];
  
  /**
   * Compress context candidates to fit within target token count
   */
  async compress(
    candidates: ContextCandidate[],
    targetTokens: number,
    options: Partial<CompressionOptions> = {}
  ): Promise<ContextCandidate[]> {
    const startTime = Date.now();
    
    const compressionOptions: CompressionOptions = {
      strategy: CompressionStrategy.HIERARCHICAL_COMPRESSION,
      target_compression_ratio: 0.7,
      preserve_critical_info: true,
      quality_threshold: 0.6,
      ...options,
    };
    
    const currentTokens = candidates.reduce((sum, c) => sum + c.token_count, 0);
    
    if (currentTokens <= targetTokens) {
      // No compression needed
      return candidates;
    }
    
    const requiredRatio = targetTokens / currentTokens;
    
    // Apply compression strategy
    let compressedCandidates: ContextCandidate[];
    
    switch (compressionOptions.strategy) {
      case CompressionStrategy.HIERARCHICAL_COMPRESSION:
        compressedCandidates = await this.hierarchicalCompression(
          candidates,
          requiredRatio,
          compressionOptions
        );
        break;
        
      case CompressionStrategy.EXTRACTIVE_SUMMARIZATION:
        compressedCandidates = await this.extractiveSummarization(
          candidates,
          requiredRatio
        );
        break;
        
      case CompressionStrategy.SEMANTIC_COMPRESSION:
        compressedCandidates = await this.semanticCompression(
          candidates,
          requiredRatio
        );
        break;
        
      case CompressionStrategy.TEMPLATE_COMPRESSION:
        compressedCandidates = await this.templateCompression(
          candidates,
          requiredRatio
        );
        break;
        
      case CompressionStrategy.TRUNCATION:
        compressedCandidates = await this.truncationCompression(
          candidates,
          requiredRatio,
          compressionOptions
        );
        break;
        
      default:
        compressedCandidates = await this.defaultCompression(
          candidates,
          requiredRatio
        );
    }
    
    return compressedCandidates;
  }
  
  /**
   * Hierarchical compression - different strategies for different content types
   */
  private async hierarchicalCompression(
    candidates: ContextCandidate[],
    targetRatio: number,
    options: CompressionOptions
  ): Promise<ContextCandidate[]> {
    const compressed: ContextCandidate[] = [];
    
    for (const candidate of candidates) {
      let compressedCandidate = { ...candidate };
      
      // Apply different compression based on content type and priority
      if (candidate.priority && candidate.priority <= 2) { // CRITICAL or HIGH
        // Light compression for important content
        compressedCandidate = await this.lightCompression(candidate, 0.9);
      } else if (candidate.source === 'conversation_history') {
        // Moderate compression for conversation
        compressedCandidate = await this.moderateCompression(candidate, 0.7);
      } else {
        // Aggressive compression for less important content
        compressedCandidate = await this.aggressiveCompression(candidate, 0.5);
      }
      
      compressed.push(compressedCandidate);
    }
    
    return compressed;
  }
  
  /**
   * Extractive summarization - select key sentences
   */
  private async extractiveSummarization(
    candidates: ContextCandidate[],
    targetRatio: number
  ): Promise<ContextCandidate[]> {
    return candidates.map(candidate => {
      const content = typeof candidate.content === 'string' 
        ? candidate.content 
        : JSON.stringify(candidate.content);
      
      const sentences = this.extractSentences(content);
      const targetSentences = Math.max(1, Math.floor(sentences.length * targetRatio));
      
      // Score sentences by importance
      const scoredSentences = sentences.map((sentence, index) => ({
        sentence,
        score: this.calculateSentenceImportance(sentence, content, index),
        index,
      }));
      
      // Select top sentences
      const selectedSentences = scoredSentences
        .sort((a, b) => b.score - a.score)
        .slice(0, targetSentences)
        .sort((a, b) => a.index - b.index) // Maintain original order
        .map(s => s.sentence);
      
      const compressedContent = selectedSentences.join(' ');
      
      return {
        ...candidate,
        content: compressedContent,
        token_count: this.estimateTokens(compressedContent),
        metadata: {
          ...candidate.metadata,
          compression_applied: 'extractive_summarization',
          original_sentences: sentences.length,
          compressed_sentences: selectedSentences.length,
        },
      };
    });
  }
  
  /**
   * Semantic compression - convert to concept representations
   */
  private async semanticCompression(
    candidates: ContextCandidate[],
    targetRatio: number
  ): Promise<ContextCandidate[]> {
    return candidates.map(candidate => {
      const content = typeof candidate.content === 'string' 
        ? candidate.content 
        : JSON.stringify(candidate.content);
      
      // Extract key concepts (simplified)
      const concepts = this.extractKeyConcepts(content);
      const targetConcepts = Math.max(1, Math.floor(concepts.length * targetRatio));
      
      // Select most important concepts
      const selectedConcepts = concepts
        .sort((a, b) => b.importance - a.importance)
        .slice(0, targetConcepts);
      
      // Convert back to text
      const compressedContent = selectedConcepts
        .map(c => c.text)
        .join('; ');
      
      return {
        ...candidate,
        content: compressedContent,
        token_count: this.estimateTokens(compressedContent),
        metadata: {
          ...candidate.metadata,
          compression_applied: 'semantic_compression',
          original_concepts: concepts.length,
          compressed_concepts: selectedConcepts.length,
        },
      };
    });
  }
  
  /**
   * Template compression - use predefined patterns
   */
  private async templateCompression(
    candidates: ContextCandidate[],
    targetRatio: number
  ): Promise<ContextCandidate[]> {
    return candidates.map(candidate => {
      let content = typeof candidate.content === 'string' 
        ? candidate.content 
        : JSON.stringify(candidate.content);
      
      let totalSavings = 0;
      
      // Apply compression templates
      for (const template of this.compressionTemplates) {
        const originalLength = content.length;
        content = content.replace(template.pattern, template.replacement);
        const newLength = content.length;
        
        if (newLength < originalLength) {
          totalSavings += template.token_savings;
        }
      }
      
      return {
        ...candidate,
        content: content,
        token_count: this.estimateTokens(content),
        metadata: {
          ...candidate.metadata,
          compression_applied: 'template_compression',
          estimated_savings: totalSavings,
        },
      };
    });
  }
  
  /**
   * Truncation compression - simple truncation with smart boundaries
   */
  private async truncationCompression(
    candidates: ContextCandidate[],
    targetRatio: number,
    options: CompressionOptions
  ): Promise<ContextCandidate[]> {
    return candidates.map(candidate => {
      const content = typeof candidate.content === 'string' 
        ? candidate.content 
        : JSON.stringify(candidate.content);
      
      const targetLength = Math.floor(content.length * targetRatio);
      
      // Find smart truncation point (end of sentence, word boundary, etc.)
      const truncationPoint = this.findSmartTruncationPoint(content, targetLength);
      const truncatedContent = content.substring(0, truncationPoint);
      
      return {
        ...candidate,
        content: truncatedContent,
        token_count: this.estimateTokens(truncatedContent),
        metadata: {
          ...candidate.metadata,
          compression_applied: 'truncation',
          original_length: content.length,
          truncated_length: truncatedContent.length,
        },
      };
    });
  }
  
  /**
   * Default compression - combination of strategies
   */
  private async defaultCompression(
    candidates: ContextCandidate[],
    targetRatio: number
  ): Promise<ContextCandidate[]> {
    // Apply template compression first
    let compressed = await this.templateCompression(candidates, 1.0);
    
    // Check if we need more compression
    const currentTokens = compressed.reduce((sum, c) => sum + c.token_count, 0);
    const originalTokens = candidates.reduce((sum, c) => sum + c.token_count, 0);
    const currentRatio = currentTokens / originalTokens;
    
    if (currentRatio > targetRatio) {
      // Apply truncation for additional compression
      const additionalRatio = targetRatio / currentRatio;
      compressed = await this.truncationCompression(compressed, additionalRatio, {
        strategy: CompressionStrategy.TRUNCATION,
        target_compression_ratio: additionalRatio,
        preserve_critical_info: true,
        quality_threshold: 0.6,
      });
    }
    
    return compressed;
  }
  
  // ============================
  // Compression Levels
  // ============================
  
  private async lightCompression(
    candidate: ContextCandidate,
    targetRatio: number
  ): Promise<ContextCandidate> {
    // Only apply template compression for light compression
    const [compressed] = await this.templateCompression([candidate], targetRatio);
    return compressed;
  }
  
  private async moderateCompression(
    candidate: ContextCandidate,
    targetRatio: number
  ): Promise<ContextCandidate> {
    // Apply template + extractive summarization
    const [templateCompressed] = await this.templateCompression([candidate], 1.0);
    const [extracted] = await this.extractiveSummarization([templateCompressed], targetRatio);
    return extracted;
  }
  
  private async aggressiveCompression(
    candidate: ContextCandidate,
    targetRatio: number
  ): Promise<ContextCandidate> {
    // Apply all compression strategies
    const [templateCompressed] = await this.templateCompression([candidate], 1.0);
    const [semanticCompressed] = await this.semanticCompression([templateCompressed], targetRatio * 1.2);
    const [finalCompressed] = await this.truncationCompression([semanticCompressed], targetRatio / 1.2, {
      strategy: CompressionStrategy.TRUNCATION,
      target_compression_ratio: targetRatio,
      preserve_critical_info: false,
      quality_threshold: 0.4,
    });
    return finalCompressed;
  }
  
  // ============================
  // Helper Methods
  // ============================
  
  private extractSentences(text: string): string[] {
    // Simple sentence splitting - would use NLP in production
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }
  
  private calculateSentenceImportance(
    sentence: string,
    fullText: string,
    position: number
  ): number {
    // Simplified importance scoring
    let score = 0;
    
    // Position bias (first and last sentences often important)
    if (position === 0) score += 0.3;
    if (position === this.extractSentences(fullText).length - 1) score += 0.2;
    
    // Length bias (not too short, not too long)
    const words = sentence.split(/\s+/).length;
    if (words >= 5 && words <= 25) score += 0.2;
    
    // Keyword density
    const importantWords = ['important', 'key', 'main', 'primary', 'essential', 'critical'];
    const hasImportantWords = importantWords.some(word => 
      sentence.toLowerCase().includes(word)
    );
    if (hasImportantWords) score += 0.3;
    
    return score;
  }
  
  private extractKeyConcepts(text: string): Array<{ text: string; importance: number }> {
    // Simplified concept extraction - would use NLP/ML in production
    const sentences = this.extractSentences(text);
    
    return sentences.map((sentence, index) => ({
      text: sentence.trim(),
      importance: this.calculateSentenceImportance(sentence, text, index),
    }));
  }
  
  private findSmartTruncationPoint(text: string, targetLength: number): number {
    if (targetLength >= text.length) return text.length;
    
    // Try to find end of sentence
    const sentenceEnd = text.lastIndexOf('.', targetLength);
    if (sentenceEnd > targetLength * 0.8) return sentenceEnd + 1;
    
    // Try to find end of word
    const wordEnd = text.lastIndexOf(' ', targetLength);
    if (wordEnd > targetLength * 0.9) return wordEnd;
    
    // Fallback to exact position
    return targetLength;
  }
  
  private estimateTokens(content: any): number {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    // Rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
}