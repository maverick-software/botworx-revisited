/**
 * Word Document Parser Edge Function
 * 
 * Dedicated service for extracting text from .doc and .docx documents
 * Supports multiple extraction methods with premium API fallbacks
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import mammoth from 'npm:mammoth@1.6.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WordParseRequest {
  fileData: string; // Base64 encoded document data
  fileName: string;
  options?: {
    includeMetadata?: boolean;
    maxRetries?: number;
    usePremiumAPI?: boolean;
  };
}

interface WordParseResponse {
  success: boolean;
  text?: string;
  metadata?: {
    wordCount: number;
    characterCount: number;
    extractionMethod: string;
    fileType: string;
  };
  error?: string;
  retryable?: boolean;
}

async function extractWithMammoth(fileBuffer: Uint8Array, fileName: string): Promise<{ text: string; metadata: any }> {
  try {
    console.log(`[Word Parser] Using Mammoth.js for ${fileName}`);
    
    const result = await mammoth.extractRawText({ 
      buffer: fileBuffer.buffer as ArrayBuffer 
    });
    
    const text = result.value || '';
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    
    return {
      text,
      metadata: {
        wordCount,
        characterCount: text.length,
        extractionMethod: 'mammoth',
        fileType: fileName.toLowerCase().endsWith('.docx') ? 'docx' : 'doc',
        warnings: result.messages || []
      }
    };
  } catch (error) {
    console.error('[Word Parser] Mammoth extraction failed:', error);
    throw error;
  }
}

async function extractWithPremiumAPI(fileBuffer: Uint8Array, fileName: string, supabaseClient: any): Promise<{ text: string; metadata: any }> {
  try {
    console.log(`[Word Parser] Attempting premium API extraction for ${fileName}`);
    
    // Try to get premium API credentials (e.g., Azure Document Intelligence, AWS Textract)
    const { data: credentials, error } = await supabaseClient.rpc('vault_decrypt', {
      secret_name: 'azure_document_intelligence_key'
    });
    
    if (error || !credentials) {
      throw new Error('Premium API credentials not available');
    }
    
    // Example: Azure Document Intelligence API call
    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer], { 
      type: fileName.toLowerCase().endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/msword'
    }), fileName);
    
    const response = await fetch('https://your-region.api.cognitive.microsoft.com/formrecognizer/documentModels/prebuilt-read:analyze?api-version=2023-07-31', {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': credentials,
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Premium API failed: ${response.status}`);
    }
    
    // This is a simplified example - actual implementation would handle the async nature of Azure Document Intelligence
    const result = await response.json();
    
    return {
      text: result.analyzeResult?.content || '',
      metadata: {
        extractionMethod: 'azure_document_intelligence',
        confidence: result.analyzeResult?.confidence || 0,
        pages: result.analyzeResult?.pages?.length || 0
      }
    };
    
  } catch (error) {
    console.error('[Word Parser] Premium API extraction failed:', error);
    throw error;
  }
}

async function extractWithFallback(fileBuffer: Uint8Array, fileName: string): Promise<{ text: string; metadata: any }> {
  try {
    console.log(`[Word Parser] Using fallback extraction for ${fileName}`);
    
    // Simple text extraction for .doc files (limited)
    if (fileName.toLowerCase().endsWith('.doc')) {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      let text = decoder.decode(fileBuffer);
      
      // Basic cleanup for .doc files
      text = text
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      return {
        text,
        metadata: {
          extractionMethod: 'fallback_doc',
          wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
          characterCount: text.length
        }
      };
    }
    
    // For .docx, we really need a proper parser
    throw new Error('Fallback extraction not available for .docx files');
    
  } catch (error) {
    console.error('[Word Parser] Fallback extraction failed:', error);
    throw error;
  }
}

async function parseWordDocument(request: WordParseRequest, supabaseClient: any): Promise<WordParseResponse> {
  const { fileData, fileName, options = {} } = request;
  const maxRetries = options.maxRetries || 3;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Word Parser] Attempt ${attempt}/${maxRetries} for ${fileName}`);
      
      // Decode base64 file data
      const fileBuffer = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));
      console.log(`[Word Parser] Processing ${fileName} (${fileBuffer.length} bytes)`);
      
      let result: { text: string; metadata: any };
      
      // Try extraction methods in order of preference
      try {
        // Primary: Mammoth.js (most reliable for Word docs)
        result = await extractWithMammoth(fileBuffer, fileName);
        console.log(`[Word Parser] Mammoth extraction successful: ${result.text.length} characters`);
      } catch (mammothError) {
        console.error(`[Word Parser] Mammoth failed on attempt ${attempt}:`, mammothError);
        
        if (options.usePremiumAPI) {
          try {
            // Premium API fallback
            result = await extractWithPremiumAPI(fileBuffer, fileName, supabaseClient);
            console.log(`[Word Parser] Premium API extraction successful: ${result.text.length} characters`);
          } catch (premiumError) {
            console.error(`[Word Parser] Premium API failed on attempt ${attempt}:`, premiumError);
            
            // Last resort: fallback method
            result = await extractWithFallback(fileBuffer, fileName);
            console.log(`[Word Parser] Fallback extraction: ${result.text.length} characters`);
          }
        } else {
          // Skip premium API, go straight to fallback
          result = await extractWithFallback(fileBuffer, fileName);
          console.log(`[Word Parser] Fallback extraction: ${result.text.length} characters`);
        }
      }
      
      // Clean up the extracted text
      const cleanText = result.text
        .replace(/\s+/g, ' ')
        .replace(/([.!?])\s+/g, '$1\n')
        .trim();
      
      const response: WordParseResponse = {
        success: true,
        text: cleanText,
        metadata: options.includeMetadata ? {
          ...result.metadata,
          wordCount: cleanText.split(/\s+/).filter(word => word.length > 0).length,
          characterCount: cleanText.length,
          fileType: fileName.toLowerCase().endsWith('.docx') ? 'docx' : 'doc'
        } : undefined
      };
      
      if (cleanText.length === 0) {
        throw new Error('No text could be extracted from the document. The file may be corrupted, password-protected, or contain only images.');
      }
      
      return response;
      
    } catch (error: any) {
      lastError = error;
      console.error(`[Word Parser] Attempt ${attempt} failed:`, error);
      
      // If this isn't the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`[Word Parser] Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // All attempts failed
  const isRetryable = lastError?.message?.includes('timeout') || 
                     lastError?.message?.includes('network') ||
                     lastError?.message?.includes('rate limit');
  
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
    const request = await req.json() as WordParseRequest;
    
    if (!request.fileData || !request.fileName) {
      throw new Error('Missing required fields: fileData and fileName');
    }
    
    // Create Supabase client for premium API credentials
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    let supabaseClient = null;
    if (supabaseUrl && supabaseServiceRoleKey) {
      supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    }
    
    const response = await parseWordDocument(request, supabaseClient);
    
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
    console.error('[Word Parser] Error:', error);
    
    const response: WordParseResponse = {
      success: false,
      error: error.message || 'Failed to parse Word document',
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
