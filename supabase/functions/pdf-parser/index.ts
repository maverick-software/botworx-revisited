/**
 * PDF Parser Edge Function
 * 
 * Dedicated service for extracting text from PDF documents
 * Supports multiple extraction methods and encodings
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import pdf from 'npm:pdf-parse@1.1.1';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PDFParseRequest {
  fileData: string; // Base64 encoded PDF data
  options?: {
    maxPages?: number;
    includeMetadata?: boolean;
    ocrFallback?: boolean;
  };
}

interface PDFParseResponse {
  success: boolean;
  text?: string;
  metadata?: {
    pages: number;
    info?: any;
    version?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
  };
  error?: string;
}

async function extractTextWithPDFParse(pdfBytes: Uint8Array): Promise<{ text: string; metadata: any }> {
  try {
    // Convert Uint8Array to Buffer for pdf-parse
    const pdfBuffer = new Uint8Array(pdfBytes);
    const data = await pdf(pdfBuffer);
    
    return {
      text: data.text || '',
      metadata: {
        pages: data.numpages,
        info: data.info,
        version: data.version,
        metadata: data.metadata
      }
    };
  } catch (error) {
    console.error('[PDF Parser] pdf-parse extraction failed:', error);
    throw error;
  }
}

async function extractTextWithPDFLib(pdfBuffer: Uint8Array): Promise<{ text: string; metadata: any }> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    
    const pages = pdfDoc.getPages();
    let extractedText = '';
    
    // Get metadata
    const metadata = {
      pages: pdfDoc.getPageCount(),
      creator: pdfDoc.getCreator(),
      producer: pdfDoc.getProducer(),
      creationDate: pdfDoc.getCreationDate()?.toISOString(),
      modificationDate: pdfDoc.getModificationDate()?.toISOString(),
    };
    
    // Note: pdf-lib doesn't have built-in text extraction
    // This is primarily for metadata and structure analysis
    // Text extraction still needs to be done via pdf-parse or manual methods
    
    return {
      text: extractedText,
      metadata
    };
  } catch (error) {
    console.error('[PDF Parser] pdf-lib extraction failed:', error);
    throw error;
  }
}

async function extractTextManually(pdfData: Uint8Array): Promise<string> {
  try {
    // Enhanced manual PDF text extraction
    let extractedText = '';
    
    // Try UTF-8 first (most modern PDFs)
    const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
    const utf8Text = utf8Decoder.decode(pdfData);
    
    // Look for text between BT and ET markers
    const btEtMatches = utf8Text.match(/BT\s+(.*?)\s+ET/gs);
    if (btEtMatches) {
      for (const match of btEtMatches) {
        // Extract Tj operators
        const tjMatches = match.match(/\((.*?)\)\s*Tj/g) || [];
        for (const tj of tjMatches) {
          const text = tj.match(/\((.*?)\)/)?.[1];
          if (text) {
            // Decode PDF escape sequences
            const decoded = text
              .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t')
              .replace(/\\\(/g, '(')
              .replace(/\\\)/g, ')')
              .replace(/\\\\/g, '\\');
            extractedText += decoded + ' ';
          }
        }
        
        // Extract TJ operators (arrays)
        const tjArrayMatches = match.match(/\[(.*?)\]\s*TJ/g) || [];
        for (const tjArray of tjArrayMatches) {
          const content = tjArray.match(/\[(.*?)\]/)?.[1];
          if (content) {
            const strings = content.match(/\((.*?)\)/g) || [];
            for (const str of strings) {
              const text = str.match(/\((.*?)\)/)?.[1];
              if (text) {
                const decoded = text
                  .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
                  .replace(/\\n/g, '\n')
                  .replace(/\\r/g, '\r')
                  .replace(/\\t/g, '\t')
                  .replace(/\\\(/g, '(')
                  .replace(/\\\)/g, ')')
                  .replace(/\\\\/g, '\\');
                extractedText += decoded + ' ';
              }
            }
          }
        }
      }
    }
    
    // Also look for text in stream objects
    const streamMatches = utf8Text.match(/stream\s+([\s\S]*?)\s+endstream/g);
    if (streamMatches && extractedText.length === 0) {
      for (const stream of streamMatches) {
        const streamTjMatches = stream.match(/\((.*?)\)\s*Tj/g) || [];
        for (const tj of streamTjMatches) {
          const text = tj.match(/\((.*?)\)/)?.[1];
          if (text) {
            extractedText += text.replace(/\\[rn]/g, '\n') + ' ';
          }
        }
      }
    }
    
    // If UTF-8 didn't work, try Latin-1
    if (extractedText.length === 0) {
      console.log('[PDF Parser] Trying Latin-1 encoding');
      const latin1Decoder = new TextDecoder('latin1');
      const latin1Text = latin1Decoder.decode(pdfData);
      
      const latin1Matches = latin1Text.match(/BT\s+(.*?)\s+ET/gs);
      if (latin1Matches) {
        for (const match of latin1Matches) {
          const tjMatches = match.match(/\((.*?)\)\s*Tj/g) || [];
          for (const tj of tjMatches) {
            const text = tj.match(/\((.*?)\)/)?.[1];
            if (text) {
              extractedText += text.replace(/\\[rn]/g, '\n') + ' ';
            }
          }
        }
      }
    }
    
    return extractedText.trim();
  } catch (error) {
    console.error('[PDF Parser] Manual extraction failed:', error);
    return '';
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { fileData, options = {} } = await req.json() as PDFParseRequest;
    
    if (!fileData) {
      throw new Error('No file data provided');
    }
    
    // Decode base64 file data
    const pdfBytes = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));
    
    console.log(`[PDF Parser] Processing PDF (${pdfBytes.length} bytes)`);
    
    let extractedText = '';
    let metadata: any = {};
    
    // Try pdf-parse first (most reliable)
    try {
      const result = await extractTextWithPDFParse(pdfBytes);
      extractedText = result.text;
      metadata = result.metadata;
      console.log(`[PDF Parser] Extracted ${extractedText.length} characters using pdf-parse`);
    } catch (pdfParseError) {
      console.error('[PDF Parser] pdf-parse failed, trying fallback methods:', pdfParseError);
      
      // Try pdf-lib for metadata
      try {
        const pdfLibResult = await extractTextWithPDFLib(pdfBytes);
        metadata = pdfLibResult.metadata;
      } catch (pdfLibError) {
        console.error('[PDF Parser] pdf-lib failed:', pdfLibError);
      }
      
      // Try manual extraction
      extractedText = await extractTextManually(pdfBytes);
      console.log(`[PDF Parser] Extracted ${extractedText.length} characters using manual method`);
    }
    
    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/([.!?])\s+/g, '$1\n')
      .trim();
    
    const response: PDFParseResponse = {
      success: true,
      text: extractedText,
      metadata: options.includeMetadata ? metadata : undefined
    };
    
    if (extractedText.length === 0) {
      response.success = false;
      response.error = 'No text could be extracted from the PDF. It may be image-based or encrypted.';
    }
    
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
    console.error('[PDF Parser] Error:', error);
    
    const response: PDFParseResponse = {
      success: false,
      error: error.message || 'Failed to parse PDF'
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
