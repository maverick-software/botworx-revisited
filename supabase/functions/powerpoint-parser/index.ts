/**
 * PowerPoint Parser Edge Function
 * 
 * Dedicated service for extracting text from .ppt and .pptx files
 * Supports multiple extraction methods with premium API fallbacks
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PowerPointParseRequest {
  fileData: string; // Base64 encoded file data
  fileName: string;
  options?: {
    includeMetadata?: boolean;
    maxRetries?: number;
    usePremiumAPI?: boolean;
    includeSlideNumbers?: boolean;
    extractNotes?: boolean;
  };
}

interface PowerPointParseResponse {
  success: boolean;
  text?: string;
  slides?: Array<{
    slideNumber: number;
    title?: string;
    content: string;
    notes?: string;
  }>;
  metadata?: {
    slideCount: number;
    extractionMethod: string;
    fileType: string;
    hasNotes: boolean;
  };
  error?: string;
  retryable?: boolean;
}

async function extractPPTXManually(fileBuffer: Uint8Array, fileName: string, options: any = {}): Promise<{ text: string; slides: any[]; metadata: any }> {
  try {
    console.log(`[PowerPoint Parser] Manual PPTX extraction for ${fileName}`);
    
    // PPTX files are ZIP archives - we need to extract XML content
    // This is a simplified approach - in production, you'd want a proper PPTX parser
    
    // Convert to string to search for text content
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const content = decoder.decode(fileBuffer);
    
    // Look for text content in XML structure
    // PPTX stores text in various XML files within the ZIP
    const textMatches = content.match(/<a:t[^>]*>(.*?)<\/a:t>/g) || [];
    const titleMatches = content.match(/<p:ph[^>]*type="title"[^>]*>.*?<a:t[^>]*>(.*?)<\/a:t>/gs) || [];
    
    let extractedText = '';
    const slides: any[] = [];
    let slideCount = 0;
    
    // Extract titles
    const titles = titleMatches.map(match => {
      const titleMatch = match.match(/<a:t[^>]*>(.*?)<\/a:t>/);
      return titleMatch ? titleMatch[1] : '';
    });
    
    // Extract all text content
    const allText = textMatches.map(match => {
      const textMatch = match.match(/<a:t[^>]*>(.*?)<\/a:t>/);
      return textMatch ? textMatch[1] : '';
    }).filter(text => text.trim().length > 0);
    
    // Group text by slides (heuristic approach)
    let currentSlide = 1;
    let currentSlideContent = '';
    
    for (let i = 0; i < allText.length; i++) {
      const text = allText[i];
      
      // If this looks like a title (short, capitalized), start new slide
      if (text.length < 100 && text.match(/^[A-Z][^.!?]*$/)) {
        if (currentSlideContent) {
          slides.push({
            slideNumber: currentSlide,
            title: titles[currentSlide - 1] || '',
            content: currentSlideContent.trim()
          });
          currentSlide++;
          currentSlideContent = '';
        }
        currentSlideContent += `Title: ${text}\n`;
      } else {
        currentSlideContent += text + '\n';
      }
      
      extractedText += text + ' ';
    }
    
    // Add the last slide
    if (currentSlideContent) {
      slides.push({
        slideNumber: currentSlide,
        title: titles[currentSlide - 1] || '',
        content: currentSlideContent.trim()
      });
    }
    
    slideCount = slides.length || Math.max(1, Math.floor(allText.length / 5)); // Estimate
    
    return {
      text: extractedText.trim(),
      slides,
      metadata: {
        slideCount,
        extractionMethod: 'manual_pptx',
        fileType: 'pptx',
        hasNotes: false
      }
    };
    
  } catch (error) {
    console.error('[PowerPoint Parser] Manual PPTX extraction failed:', error);
    throw error;
  }
}

async function extractPPTFallback(fileBuffer: Uint8Array, fileName: string): Promise<{ text: string; slides: any[]; metadata: any }> {
  try {
    console.log(`[PowerPoint Parser] Fallback extraction for ${fileName}`);
    
    // Very basic text extraction for .ppt files
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let content = decoder.decode(fileBuffer);
    
    // Clean up binary content and extract readable text
    content = content
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract words that look like readable text
    const words = content.split(/\s+/).filter(word => {
      return word.length > 2 && 
             /^[a-zA-Z0-9\-.,!?'"()]+$/.test(word) &&
             !/^[0-9]+$/.test(word); // Skip pure numbers
    });
    
    const text = words.join(' ');
    
    return {
      text,
      slides: [{
        slideNumber: 1,
        title: 'Extracted Content',
        content: text
      }],
      metadata: {
        slideCount: 1,
        extractionMethod: 'fallback_ppt',
        fileType: 'ppt',
        hasNotes: false
      }
    };
    
  } catch (error) {
    console.error('[PowerPoint Parser] Fallback extraction failed:', error);
    throw error;
  }
}

async function extractWithPremiumAPI(fileBuffer: Uint8Array, fileName: string, supabaseClient: any): Promise<{ text: string; slides: any[]; metadata: any }> {
  try {
    console.log(`[PowerPoint Parser] Attempting premium API extraction for ${fileName}`);
    
    // Try to get premium API credentials
    const { data: credentials, error } = await supabaseClient.rpc('vault_decrypt', {
      secret_name: 'azure_document_intelligence_key'
    });
    
    if (error || !credentials) {
      throw new Error('Premium API credentials not available');
    }
    
    const formData = new FormData();
    const mimeType = fileName.toLowerCase().endsWith('.pptx') ? 
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation' :
                    'application/vnd.ms-powerpoint';
    
    formData.append('file', new Blob([fileBuffer], { type: mimeType }), fileName);
    
    const response = await fetch('https://your-region.api.cognitive.microsoft.com/formrecognizer/documentModels/prebuilt-layout:analyze?api-version=2023-07-31', {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': credentials,
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Premium API failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    return {
      text: result.analyzeResult?.content || '',
      slides: [], // Would parse from API response
      metadata: {
        extractionMethod: 'azure_document_intelligence',
        confidence: result.analyzeResult?.confidence || 0,
        slideCount: result.analyzeResult?.pages?.length || 0
      }
    };
    
  } catch (error) {
    console.error('[PowerPoint Parser] Premium API extraction failed:', error);
    throw error;
  }
}

async function parsePowerPointDocument(request: PowerPointParseRequest, supabaseClient: any): Promise<PowerPointParseResponse> {
  const { fileData, fileName, options = {} } = request;
  const maxRetries = options.maxRetries || 3;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[PowerPoint Parser] Attempt ${attempt}/${maxRetries} for ${fileName}`);
      
      // Decode base64 file data
      const fileBuffer = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));
      console.log(`[PowerPoint Parser] Processing ${fileName} (${fileBuffer.length} bytes)`);
      
      let result: { text: string; slides: any[]; metadata: any };
      
      // Try extraction methods based on file type
      try {
        if (fileName.toLowerCase().endsWith('.pptx')) {
          result = await extractPPTXManually(fileBuffer, fileName, options);
          console.log(`[PowerPoint Parser] PPTX extraction successful: ${result.text.length} characters`);
        } else {
          // For .ppt files, use fallback method
          result = await extractPPTFallback(fileBuffer, fileName);
          console.log(`[PowerPoint Parser] PPT fallback extraction: ${result.text.length} characters`);
        }
      } catch (primaryError) {
        console.error(`[PowerPoint Parser] Primary extraction failed on attempt ${attempt}:`, primaryError);
        
        if (options.usePremiumAPI) {
          try {
            // Premium API fallback
            result = await extractWithPremiumAPI(fileBuffer, fileName, supabaseClient);
            console.log(`[PowerPoint Parser] Premium API extraction successful: ${result.text.length} characters`);
          } catch (premiumError) {
            console.error(`[PowerPoint Parser] Premium API failed on attempt ${attempt}:`, premiumError);
            
            // Last resort: try the other extraction method
            if (fileName.toLowerCase().endsWith('.pptx')) {
              result = await extractPPTFallback(fileBuffer, fileName);
            } else {
              throw primaryError;
            }
          }
        } else {
          // Try fallback method
          result = await extractPPTFallback(fileBuffer, fileName);
          console.log(`[PowerPoint Parser] Fallback extraction: ${result.text.length} characters`);
        }
      }
      
      // Clean up the extracted text
      let cleanText = result.text
        .replace(/\s+/g, ' ')
        .replace(/([.!?])\s+/g, '$1\n')
        .trim();
      
      // Format slides text if requested
      if (options.includeSlideNumbers && result.slides.length > 0) {
        cleanText = result.slides.map((slide, index) => {
          let slideText = `Slide ${slide.slideNumber || index + 1}:\n`;
          if (slide.title) {
            slideText += `Title: ${slide.title}\n`;
          }
          slideText += slide.content;
          if (slide.notes && options.extractNotes) {
            slideText += `\nNotes: ${slide.notes}`;
          }
          return slideText;
        }).join('\n\n');
      }
      
      const response: PowerPointParseResponse = {
        success: true,
        text: cleanText,
        slides: options.includeMetadata ? result.slides : undefined,
        metadata: options.includeMetadata ? {
          ...result.metadata,
          fileType: fileName.toLowerCase().endsWith('.pptx') ? 'pptx' : 'ppt'
        } : undefined
      };
      
      if (cleanText.length === 0) {
        throw new Error('No text could be extracted from the presentation. The file may be corrupted, password-protected, or contain only images.');
      }
      
      return response;
      
    } catch (error: any) {
      lastError = error;
      console.error(`[PowerPoint Parser] Attempt ${attempt} failed:`, error);
      
      // If this isn't the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`[PowerPoint Parser] Waiting ${waitTime}ms before retry...`);
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
    const request = await req.json() as PowerPointParseRequest;
    
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
    
    const response = await parsePowerPointDocument(request, supabaseClient);
    
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
    console.error('[PowerPoint Parser] Error:', error);
    
    const response: PowerPointParseResponse = {
      success: false,
      error: error.message || 'Failed to parse PowerPoint document',
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
