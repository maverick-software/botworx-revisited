/**
 * Excel/CSV Parser Edge Function
 * 
 * Dedicated service for extracting text from .csv, .xlsx, and .xls files
 * Supports multiple extraction methods with premium API fallbacks
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExcelParseRequest {
  fileData: string; // Base64 encoded file data
  fileName: string;
  options?: {
    includeMetadata?: boolean;
    maxRetries?: number;
    usePremiumAPI?: boolean;
    sheetName?: string;
    includeHeaders?: boolean;
    maxRows?: number;
  };
}

interface ExcelParseResponse {
  success: boolean;
  text?: string;
  data?: any[][];
  metadata?: {
    sheets: string[];
    rowCount: number;
    columnCount: number;
    extractionMethod: string;
    fileType: string;
  };
  error?: string;
  retryable?: boolean;
}

async function extractWithSheetJS(fileBuffer: Uint8Array, fileName: string, options: any = {}): Promise<{ text: string; data: any[][]; metadata: any }> {
  try {
    console.log(`[Excel Parser] Using SheetJS for ${fileName}`);
    
    // Parse the workbook
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    
    const sheetNames = workbook.SheetNames;
    const targetSheet = options.sheetName || sheetNames[0];
    
    if (!sheetNames.includes(targetSheet)) {
      throw new Error(`Sheet "${targetSheet}" not found. Available sheets: ${sheetNames.join(', ')}`);
    }
    
    const worksheet = workbook.Sheets[targetSheet];
    
    // Convert to array of arrays
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      raw: false,
      defval: ''
    }) as any[][];
    
    // Limit rows if specified
    const limitedData = options.maxRows ? data.slice(0, options.maxRows) : data;
    
    // Convert to text
    let text = '';
    const includeHeaders = options.includeHeaders !== false;
    
    limitedData.forEach((row, index) => {
      if (index === 0 && includeHeaders) {
        text += 'Headers: ' + row.join(' | ') + '\n\n';
      } else {
        text += row.join(' | ') + '\n';
      }
    });
    
    const metadata = {
      sheets: sheetNames,
      rowCount: limitedData.length,
      columnCount: limitedData[0]?.length || 0,
      extractionMethod: 'sheetjs',
      fileType: fileName.toLowerCase().endsWith('.csv') ? 'csv' : 
               fileName.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'xls',
      activeSheet: targetSheet
    };
    
    return { text: text.trim(), data: limitedData, metadata };
    
  } catch (error) {
    console.error('[Excel Parser] SheetJS extraction failed:', error);
    throw error;
  }
}

async function extractCSVManually(fileBuffer: Uint8Array, fileName: string): Promise<{ text: string; data: any[][]; metadata: any }> {
  try {
    console.log(`[Excel Parser] Manual CSV extraction for ${fileName}`);
    
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let csvText = decoder.decode(fileBuffer);
    
    // Try different encodings if UTF-8 fails
    if (csvText.includes('�')) {
      const latin1Decoder = new TextDecoder('latin1');
      csvText = latin1Decoder.decode(fileBuffer);
    }
    
    // Simple CSV parsing (handles basic cases)
    const lines = csvText.split(/\r?\n/);
    const data: any[][] = [];
    
    for (const line of lines) {
      if (line.trim()) {
        // Basic CSV parsing - handles quoted fields
        const row = line.split(',').map(cell => {
          let cleaned = cell.trim();
          if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.slice(1, -1);
          }
          return cleaned;
        });
        data.push(row);
      }
    }
    
    // Convert to readable text
    let text = '';
    data.forEach((row, index) => {
      if (index === 0) {
        text += 'Headers: ' + row.join(' | ') + '\n\n';
      } else {
        text += row.join(' | ') + '\n';
      }
    });
    
    return {
      text: text.trim(),
      data,
      metadata: {
        sheets: ['Sheet1'],
        rowCount: data.length,
        columnCount: data[0]?.length || 0,
        extractionMethod: 'manual_csv',
        fileType: 'csv'
      }
    };
    
  } catch (error) {
    console.error('[Excel Parser] Manual CSV extraction failed:', error);
    throw error;
  }
}

async function extractWithPremiumAPI(fileBuffer: Uint8Array, fileName: string, supabaseClient: any): Promise<{ text: string; data: any[][]; metadata: any }> {
  try {
    console.log(`[Excel Parser] Attempting premium API extraction for ${fileName}`);
    
    // Try to get premium API credentials (e.g., Azure Document Intelligence)
    const { data: credentials, error } = await supabaseClient.rpc('vault_decrypt', {
      secret_name: 'azure_document_intelligence_key'
    });
    
    if (error || !credentials) {
      throw new Error('Premium API credentials not available');
    }
    
    const formData = new FormData();
    const mimeType = fileName.toLowerCase().endsWith('.csv') ? 'text/csv' :
                    fileName.toLowerCase().endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                    'application/vnd.ms-excel';
    
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
      data: [], // Would need to parse the API response structure
      metadata: {
        extractionMethod: 'azure_document_intelligence',
        confidence: result.analyzeResult?.confidence || 0
      }
    };
    
  } catch (error) {
    console.error('[Excel Parser] Premium API extraction failed:', error);
    throw error;
  }
}

async function parseExcelDocument(request: ExcelParseRequest, supabaseClient: any): Promise<ExcelParseResponse> {
  const { fileData, fileName, options = {} } = request;
  const maxRetries = options.maxRetries || 3;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Excel Parser] Attempt ${attempt}/${maxRetries} for ${fileName}`);
      
      // Decode base64 file data
      const fileBuffer = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));
      console.log(`[Excel Parser] Processing ${fileName} (${fileBuffer.length} bytes)`);
      
      let result: { text: string; data: any[][]; metadata: any };
      
      // Try extraction methods based on file type
      try {
        if (fileName.toLowerCase().endsWith('.csv')) {
          // For CSV files, try manual parsing first, then SheetJS
          try {
            result = await extractCSVManually(fileBuffer, fileName);
            console.log(`[Excel Parser] Manual CSV extraction successful: ${result.text.length} characters`);
          } catch (csvError) {
            console.log(`[Excel Parser] Manual CSV failed, trying SheetJS`);
            result = await extractWithSheetJS(fileBuffer, fileName, options);
            console.log(`[Excel Parser] SheetJS extraction successful: ${result.text.length} characters`);
          }
        } else {
          // For Excel files, use SheetJS primarily
          result = await extractWithSheetJS(fileBuffer, fileName, options);
          console.log(`[Excel Parser] SheetJS extraction successful: ${result.text.length} characters`);
        }
      } catch (primaryError) {
        console.error(`[Excel Parser] Primary extraction failed on attempt ${attempt}:`, primaryError);
        
        if (options.usePremiumAPI) {
          try {
            // Premium API fallback
            result = await extractWithPremiumAPI(fileBuffer, fileName, supabaseClient);
            console.log(`[Excel Parser] Premium API extraction successful: ${result.text.length} characters`);
          } catch (premiumError) {
            console.error(`[Excel Parser] Premium API failed on attempt ${attempt}:`, premiumError);
            throw primaryError; // Throw original error
          }
        } else {
          throw primaryError;
        }
      }
      
      // Clean up the extracted text
      const cleanText = result.text
        .replace(/\s+/g, ' ')
        .replace(/\|\s*\|/g, '|')
        .trim();
      
      const response: ExcelParseResponse = {
        success: true,
        text: cleanText,
        data: result.data,
        metadata: options.includeMetadata ? result.metadata : undefined
      };
      
      if (cleanText.length === 0) {
        throw new Error('No data could be extracted from the file. The file may be corrupted, empty, or in an unsupported format.');
      }
      
      return response;
      
    } catch (error: any) {
      lastError = error;
      console.error(`[Excel Parser] Attempt ${attempt} failed:`, error);
      
      // If this isn't the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`[Excel Parser] Waiting ${waitTime}ms before retry...`);
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
    error: `Failed to extract data after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
    retryable: isRetryable
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const request = await req.json() as ExcelParseRequest;
    
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
    
    const response = await parseExcelDocument(request, supabaseClient);
    
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
    console.error('[Excel Parser] Error:', error);
    
    const response: ExcelParseResponse = {
      success: false,
      error: error.message || 'Failed to parse Excel/CSV document',
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
