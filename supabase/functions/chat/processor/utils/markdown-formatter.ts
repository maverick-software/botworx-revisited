/**
 * Markdown Formatting Utilities
 * 
 * Ensures AI responses have proper Markdown formatting with:
 * - Consistent spacing between elements
 * - Proper line breaks
 * - Clean paragraph separation
 * - Well-formatted lists and headers
 */

export class MarkdownFormatter {
  /**
   * Ensure proper Markdown formatting for AI responses
   * Post-processes LLM output to add consistent spacing and structure
   */
  static ensureProperFormatting(text: string): string {
    // Split text into lines
    let lines = text.split('\n');
    let formattedLines: string[] = [];
    let inCodeBlock = false;
    let previousWasList = false;
    let previousWasHeader = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Check if we're entering/exiting a code block
      if (trimmed.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        // Add spacing around code blocks
        if (i > 0 && formattedLines[formattedLines.length - 1] !== '') {
          formattedLines.push('');
        }
        formattedLines.push(line);
        if (!inCodeBlock && i < lines.length - 1) {
          formattedLines.push('');
        }
        previousWasList = false;
        previousWasHeader = false;
        continue;
      }
      
      // Don't format inside code blocks
      if (inCodeBlock) {
        formattedLines.push(line);
        continue;
      }
      
      // Check if this is a header
      const isHeader = /^#{1,6}\s/.test(trimmed);
      
      // Check if this is a list item
      const isList = /^[-*+]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed);
      
      // Add spacing before headers
      if (isHeader) {
        if (i > 0 && formattedLines[formattedLines.length - 1] !== '') {
          formattedLines.push('');
        }
        formattedLines.push(line);
        // Add space after header
        if (i < lines.length - 1 && lines[i + 1].trim() !== '') {
          formattedLines.push('');
        }
        previousWasHeader = true;
        previousWasList = false;
        continue;
      }
      
      // Handle list items
      if (isList) {
        // Add space before list if previous wasn't a list
        if (!previousWasList && i > 0 && formattedLines[formattedLines.length - 1] !== '') {
          formattedLines.push('');
        }
        formattedLines.push(line);
        previousWasList = true;
        previousWasHeader = false;
        continue;
      }
      
      // Handle regular paragraphs
      if (trimmed !== '') {
        // Add space after list ends
        if (previousWasList && formattedLines[formattedLines.length - 1] !== '') {
          formattedLines.push('');
        }
        
        // Add space between paragraphs
        if (i > 0 && !previousWasHeader && !previousWasList) {
          const prevLine = formattedLines[formattedLines.length - 1];
          if (prevLine !== '' && prevLine.trim() !== '') {
            formattedLines.push('');
          }
        }
        
        formattedLines.push(line);
        previousWasList = false;
        previousWasHeader = false;
      } else {
        // Preserve empty lines but don't add duplicates
        if (formattedLines[formattedLines.length - 1] !== '') {
          formattedLines.push('');
        }
        previousWasList = false;
        previousWasHeader = false;
      }
    }
    
    // Clean up any trailing empty lines
    while (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] === '') {
      formattedLines.pop();
    }
    
    return formattedLines.join('\n');
  }

  /**
   * Normalize tool definitions - drops malformed tools
   */
  static normalizeTools(tools: any[]): Array<{ name: string; description?: string; parameters: any }> {
    const normalized: Array<{ name: string; description?: string; parameters: any }> = [];
    for (const t of tools || []) {
      const name = t?.name;
      const params = t?.parameters;
      if (typeof name === 'string' && params && typeof params === 'object') {
        normalized.push({ name, description: t?.description || '', parameters: params });
      } else {
        try { 
          console.log('[DEBUG] Dropping malformed tool before OpenAI:', JSON.stringify(t)); 
        } catch {}
      }
    }
    return normalized;
  }
}

