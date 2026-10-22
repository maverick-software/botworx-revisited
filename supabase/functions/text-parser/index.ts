/**
 * Text Parser Edge Function
 * 
 * Dedicated service for extracting text from .txt files
 * Handles various encodings and text formats
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TextParseRequest {
  fileData: string; // Base64 encoded file data
  fileName: string;
  options?: {
    includeMetadata?: boolean;
    maxRetries?: number;
    encoding?: string;
    preserveFormatting?: boolean;
  };
}

interface TextParseResponse {
  success: boolean;
  text?: string;
  metadata?: {
    encoding: string;
    lineCount: number;
    wordCount: number;
    characterCount: number;
    detectedLanguage?: string;
    fileType: string;
  };
  error?: string;
  retryable?: boolean;
}

function detectEncoding(buffer: Uint8Array): string {
  // Check for BOM (Byte Order Mark)
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return 'utf-8-bom';
  }
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return 'utf-16le';
  }
  if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    return 'utf-16be';
  }
  
  // Simple heuristic for UTF-8 vs other encodings
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    decoder.decode(buffer);
    return 'utf-8';
  } catch {
    // If UTF-8 fails, try common encodings
    const highByteCount = Array.from(buffer).filter(byte => byte > 127).length;
    const ratio = highByteCount / buffer.length;
    
    if (ratio > 0.3) {
      return 'latin1'; // Likely binary or non-UTF-8 text
    }
    return 'ascii';
  }
}

function detectLanguage(text: string): string {
  const sample = text.substring(0, 1000).toLowerCase();
  
  // Simple language detection based on common words
  const patterns = {
    english: /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/g,
    spanish: /\b(el|la|de|que|y|en|un|es|se|no|te|lo)\b/g,
    french: /\b(le|de|et|à|un|il|être|et|en|avoir|que|pour)\b/g,
    german: /\b(der|die|und|in|den|von|zu|das|mit|sich|des|auf)\b/g,
    italian: /\b(il|di|che|e|la|per|in|un|è|da|non|con)\b/g
  };
  
  let maxMatches = 0;
  let detectedLang = 'unknown';
  
  for (const [lang, pattern] of Object.entries(patterns)) {
    const matches = (sample.match(pattern) || []).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      detectedLang = lang;
    }
  }
  
  return maxMatches > 3 ? detectedLang : 'unknown';
}

async function extractTextWithEncoding(fileBuffer: Uint8Array, encoding: string, preserveFormatting: boolean): Promise<{ text: string; metadata: any }> {
  try {
    console.log(`[Text Parser] Extracting text with encoding: ${encoding}`);
    
    let text: string;
    
    switch (encoding) {
      case 'utf-8-bom':
        // Remove BOM and decode as UTF-8
        text = new TextDecoder('utf-8').decode(fileBuffer.slice(3));
        break;
      case 'utf-16le':
        text = new TextDecoder('utf-16le').decode(fileBuffer.slice(2));
        break;
      case 'utf-16be':
        text = new TextDecoder('utf-16be').decode(fileBuffer.slice(2));
        break;
      case 'latin1':
        text = new TextDecoder('latin1').decode(fileBuffer);
        break;
      case 'ascii':
      case 'utf-8':
      default:
        text = new TextDecoder('utf-8', { fatal: false }).decode(fileBuffer);
        break;
    }
    
    // Clean up text if not preserving formatting
    if (!preserveFormatting) {
      // Normalize line endings
      text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      // Remove excessive whitespace but preserve paragraph structure
      text = text
        .replace(/[ \t]+/g, ' ') // Multiple spaces/tabs to single space
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Multiple newlines to double newline
        .trim();
    }
    
    const lines = text.split('\n');
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const detectedLanguage = detectLanguage(text);
    
    return {
      text,
      metadata: {
        encoding,
        lineCount: lines.length,
        wordCount: words.length,
        characterCount: text.length,
        detectedLanguage,
        fileType: 'txt'
      }
    };
    
  } catch (error) {
    console.error(`[Text Parser] Extraction with encoding ${encoding} failed:`, error);
    throw error;
  }
}

async function parseTextDocument(request: TextParseRequest): Promise<TextParseResponse> {
  const { fileData, fileName, options = {} } = request;
  const maxRetries = options.maxRetries || 3;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Text Parser] Attempt ${attempt}/${maxRetries} for ${fileName}`);
      
      // Decode base64 file data
      const fileBuffer = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));
      console.log(`[Text Parser] Processing ${fileName} (${fileBuffer.length} bytes)`);
      
      // Detect encoding if not specified
      const encoding = options.encoding || detectEncoding(fileBuffer);
      console.log(`[Text Parser] Detected/using encoding: ${encoding}`);
      
      // Extract text
      const result = await extractTextWithEncoding(
        fileBuffer, 
        encoding, 
        options.preserveFormatting || false
      );
      
      console.log(`[Text Parser] Extraction successful: ${result.text.length} characters`);
      
      const response: TextParseResponse = {
        success: true,
        text: result.text,
        metadata: options.includeMetadata ? result.metadata : undefined
      };
      
      if (result.text.length === 0) {
        throw new Error('No text could be extracted from the file. The file may be empty or corrupted.');
      }
      
      return response;
      
    } catch (error: any) {
      lastError = error;
      console.error(`[Text Parser] Attempt ${attempt} failed:`, error);
      
      // If this isn't the last attempt, try different encoding
      if (attempt < maxRetries) {
        const waitTime = 500 * attempt; // Short wait between encoding attempts
        console.log(`[Text Parser] Waiting ${waitTime}ms before retry with different encoding...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Try different encodings on subsequent attempts
        if (attempt === 2 && !options.encoding) {
          options.encoding = 'latin1';
        } else if (attempt === 3 && !options.encoding) {
          options.encoding = 'ascii';
        }
      }
    }
  }
  
  // All attempts failed
  const isRetryable = lastError?.message?.includes('timeout') || 
                     lastError?.message?.includes('network');
  
  return {
    success: false,
    error: `Failed to extract text after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
    retryable: isRetryable
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const request = await req.json() as TextParseRequest;
    
    if (!request.fileData || !request.fileName) {
      throw new Error('Missing required fields: fileData and fileName');
    }
    
    const response = await parseTextDocument(request);
    
    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
    
  } catch (error: any) {
    console.error('[Text Parser] Error:', error);
    
    const response: TextParseResponse = {
      success: false,
      error: error.message || 'Failed to parse text document',
      retryable: false
    };
    
    return new Response(
      JSON.stringify(response),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
