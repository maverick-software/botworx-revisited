/**
 * Media Library MCP Tools Edge Function
 * 
 * Self-contained document management system providing:
 * - Document upload and storage
 * - Text extraction (PDF, DOCX, TXT)
 * - Document processing and chunking
 * - Agent assignment management
 * - Search, retrieval, and management tools
 * 
 * Completely independent - no external API dependencies
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

// Import libraries for document processing
import { createWorker } from 'npm:tesseract.js@5.0.4';

// Import comprehensive document processing libraries
import * as mammoth from 'npm:mammoth@1.6.0'; // For .docx and .doc files
import * as XLSX from 'npm:xlsx@0.18.5'; // For .xlsx, .xls files

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface MCPToolRequest {
  action: string;
  agent_id: string;
  user_id: string;
  params: Record<string, any>;
  tool_name?: string;
}

interface MCPToolResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    tool_name?: string;
    execution_time_ms?: number;
    results_count?: number;
  };
}

interface UploadRequest {
  file_name: string;
  file_type: string;
  file_size: number;
  category?: string;
  description?: string;
  tags?: string[];
}

// =============================================
// Text Extraction Functions
// =============================================

// =============================================
// Parser Service Calls
// =============================================

async function callParserService(serviceName: string, fileData: Uint8Array, fileName: string, options: any = {}): Promise<string> {
  try {
    console.log(`[MediaLibrary MCP] Calling ${serviceName} service for ${fileName}`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl) {
      throw new Error(`Supabase URL not available for ${serviceName} service`);
    }
    
    // Convert file data to base64 for transmission - handle large files safely
    let base64Data: string;
    const chunkSize = 8192; // 8KB chunks to avoid call stack overflow
    const chunks: string[] = [];
    
    for (let i = 0; i < fileData.length; i += chunkSize) {
      const chunk = fileData.slice(i, i + chunkSize);
      // Convert chunk to string without spread operator to avoid stack overflow
      let binaryString = '';
      for (let j = 0; j < chunk.length; j++) {
        binaryString += String.fromCharCode(chunk[j]);
      }
      chunks.push(btoa(binaryString));
    }
    base64Data = chunks.join('');
    
    const response = await fetch(`${supabaseUrl}/functions/v1/${serviceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        fileData: base64Data,
        fileName: fileName,
        options: {
          includeMetadata: true,
          maxRetries: 3,
          ...options
        }
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.text) {
        console.log(`[MediaLibrary MCP] ${serviceName} extracted ${result.text.length} characters`);
        if (result.metadata) {
          console.log(`[MediaLibrary MCP] ${serviceName} metadata:`, result.metadata);
        }
        return result.text;
      } else {
        throw new Error(result.error || `${serviceName} service returned no text`);
      }
    } else {
      const errorText = await response.text();
      throw new Error(`${serviceName} service failed: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error(`[MediaLibrary MCP] ${serviceName} service error:`, error);
    throw error;
  }
}

async function extractTextFromWord(fileData: Uint8Array, fileName: string): Promise<string> {
  return await callParserService('word-parser', fileData, fileName, {
    usePremiumAPI: true
  });
}

async function extractTextFromExcel(fileData: Uint8Array, fileName: string): Promise<string> {
  return await callParserService('excel-parser', fileData, fileName, {
    usePremiumAPI: true,
    includeHeaders: true,
    maxRows: 1000
  });
}

async function extractTextFromText(fileData: Uint8Array, fileName: string): Promise<string> {
  return await callParserService('text-parser', fileData, fileName, {
    preserveFormatting: false
  });
}

async function extractTextFromPowerPoint(fileData: Uint8Array, fileName: string): Promise<string> {
  return await callParserService('powerpoint-parser', fileData, fileName, {
    usePremiumAPI: true,
    includeSlideNumbers: true,
    extractNotes: true
  });
}

async function extractTextFromPDF(pdfData: Uint8Array): Promise<string> {
  try {
    console.log(`[MediaLibrary MCP] Processing PDF file (${pdfData.length} bytes)`);
    
    // Call the dedicated PDF parser edge function
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (supabaseUrl) {
      try {
        // Convert PDF data to base64 for transmission
        const base64Data = btoa(String.fromCharCode(...pdfData));
        
        const response = await fetch(`${supabaseUrl}/functions/v1/pdf-parser`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            fileData: base64Data,
            options: {
              includeMetadata: true
            }
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.text) {
            console.log(`[MediaLibrary MCP] PDF parser extracted ${result.text.length} characters`);
            if (result.metadata) {
              console.log(`[MediaLibrary MCP] PDF metadata:`, result.metadata);
            }
            return result.text;
          }
        } else {
          console.error('[MediaLibrary MCP] PDF parser service failed:', await response.text());
        }
      } catch (pdfServiceError) {
        console.error('[MediaLibrary MCP] PDF parser service error:', pdfServiceError);
      }
    }
    
    // Fallback: Simple manual extraction if service is unavailable
    console.log('[MediaLibrary MCP] Falling back to manual PDF extraction');
    const textDecoder = new TextDecoder('latin1');
    const pdfText = textDecoder.decode(pdfData);
    
    // Extract text from PDF streams
    const textMatches = pdfText.match(/BT\s+(.*?)\s+ET/gs);
    let extractedText = '';
    
    if (textMatches) {
      for (const match of textMatches) {
        // Extract text from Tj and TJ operators
        const textOperators = match.match(/\((.*?)\)\s*Tj/g) || [];
        const arrayOperators = match.match(/\[(.*?)\]\s*TJ/g) || [];
        
        for (const op of textOperators) {
          const text = op.match(/\((.*?)\)/)?.[1];
          if (text) {
            extractedText += text.replace(/\\[rn]/g, '\n') + ' ';
          }
        }
        
        for (const op of arrayOperators) {
          const content = op.match(/\[(.*?)\]/)?.[1];
          if (content) {
            // Extract strings from TJ array
            const strings = content.match(/\((.*?)\)/g) || [];
            for (const str of strings) {
              const text = str.match(/\((.*?)\)/)?.[1];
              if (text) {
                extractedText += text.replace(/\\[rn]/g, '\n') + ' ';
              }
            }
          }
        }
      }
    }
    
    // Clean up the text
    extractedText = extractedText
      .replace(/\\[rn]/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`[MediaLibrary MCP] Manual extraction: ${extractedText.length} characters from PDF`);
    
    if (extractedText.length > 0) {
      return extractedText;
    } else {
      return 'This PDF document was processed but contains no extractable text. It may be an image-only PDF, encrypted document, or use unsupported text encoding. Consider using OCR for image-based PDFs.';
    }
  } catch (error: any) {
    console.error('[MediaLibrary MCP] PDF extraction error:', error);
    return `Error extracting text from PDF: ${error.message}. The document may be corrupted, encrypted, or in an unsupported format.`;
  }
}

async function extractTextFromDOCX(docxData: Uint8Array): Promise<string> {
  try {
    console.log(`[MediaLibrary MCP] Processing DOCX file (${docxData.length} bytes)`);
    
    // DOCX files are ZIP archives - extract XML text content
    const textDecoder = new TextDecoder('latin1');
    const docxText = textDecoder.decode(docxData);
    
    let extractedText = '';
    
    // Look for XML text patterns in the DOCX content
    const xmlPatterns = [
      /<w:t[^>]*>([^<]+)<\/w:t>/g,
      /<w:t>([^<]+)<\/w:t>/g,
      /<t[^>]*>([^<]+)<\/t>/g,
    ];
    
    for (const pattern of xmlPatterns) {
      let match;
      while ((match = pattern.exec(docxText)) !== null) {
        const text = match[1];
        if (text && text.trim().length > 0) {
          extractedText += text.trim() + ' ';
        }
      }
    }
    
    // Clean up and format the text
    if (extractedText.length > 0) {
      extractedText = extractedText
        .replace(/\s+/g, ' ')
        .replace(/([.!?])\s+/g, '$1\n')
        .trim();
      
      console.log(`[MediaLibrary MCP] Extracted ${extractedText.length} characters from DOCX (XML method)`);
      return extractedText;
    }
    
    // Fallback method - look for readable text patterns
    console.log(`[MediaLibrary MCP] XML extraction failed, trying fallback method for DOCX`);
    const readableChunks = [];
    const lines = docxText.split(/[\r\n]+/);
    
    for (const line of lines) {
      // Look for lines that contain readable text (letters, numbers, common punctuation)
      const cleanLine = line.replace(/[^\x20-\x7E]/g, '').trim();
      if (cleanLine.length > 10 && /[a-zA-Z]/.test(cleanLine) && !/^[<>{}[\]\\\/]+$/.test(cleanLine)) {
        readableChunks.push(cleanLine);
      }
    }
    
    if (readableChunks.length > 0) {
      extractedText = readableChunks.join('\n').trim();
      console.log(`[MediaLibrary MCP] Extracted ${extractedText.length} characters from DOCX (fallback method)`);
      return extractedText;
    }
    
    console.log(`[MediaLibrary MCP] No extractable text found in DOCX file`);
    return 'This DOCX document was processed but contains no extractable text. It may be encrypted, corrupted, contain only images, or use unsupported formatting.';
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] DOCX extraction error:', error);
    return `Error extracting text from DOCX: ${error.message}. The document may be corrupted or in an unsupported format.`;
  }
}

async function extractTextFromXLSX(fileData: Uint8Array, fileName: string): Promise<string> {
  try {
    console.log(`[MediaLibrary MCP] Extracting text from XLSX: ${fileName}`);
    
    const workbook = XLSX.read(fileData, { type: 'array' });
    const allText: string[] = [];
    
    // Process all worksheets
    for (const sheetName of workbook.SheetNames) {
      console.log(`[MediaLibrary MCP] Processing sheet: ${sheetName}`);
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert sheet to CSV format and then extract text
      const csvData = XLSX.utils.sheet_to_csv(worksheet);
      if (csvData.trim()) {
        allText.push(`=== Sheet: ${sheetName} ===\n${csvData}`);
      }
    }
    
    const extractedText = allText.join('\n\n');
    console.log(`[MediaLibrary MCP] Extracted ${extractedText.length} characters from XLSX`);
    
    return extractedText;
  } catch (error: any) {
    console.error('[MediaLibrary MCP] XLSX extraction error:', error);
    return `Error extracting text from XLSX: ${error.message}. The file may be corrupted or password-protected.`;
  }
}

async function extractTextFromPPTX(fileData: Uint8Array, fileName: string): Promise<string> {
  try {
    console.log(`[MediaLibrary MCP] Extracting text from PPTX: ${fileName}`);
    
    // PPTX files are ZIP archives - we can try to extract XML content
    // For now, return a placeholder message and use OCR as fallback
    console.log(`[MediaLibrary MCP] PPTX text extraction not fully implemented - will use OCR fallback`);
    throw new Error('PPTX text extraction requires OCR processing');
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] PPTX extraction error:', error);
    throw error; // Let it fall through to OCR processing
  }
}

async function extractTextFromDOC(fileData: Uint8Array, fileName: string): Promise<string> {
  try {
    console.log(`[MediaLibrary MCP] Extracting text from DOC/DOCX: ${fileName}`);
    
    // Mammoth can handle both .doc and .docx files
    const result = await mammoth.extractRawText({ buffer: fileData });
    
    if (result.messages && result.messages.length > 0) {
      console.log(`[MediaLibrary MCP] Mammoth messages:`, result.messages.map(m => m.message));
    }
    
    const extractedText = result.value || '';
    console.log(`[MediaLibrary MCP] Extracted ${extractedText.length} characters from DOC/DOCX`);
    
    return extractedText;
  } catch (error: any) {
    console.error('[MediaLibrary MCP] DOC extraction error:', error);
    return `Error extracting text from DOC: ${error.message}. The file may be corrupted or password-protected.`;
  }
}

async function extractTextFromTXT(fileData: Uint8Array, fileName: string): Promise<string> {
  try {
    console.log(`[MediaLibrary MCP] Extracting text from TXT: ${fileName}`);
    
    // Try different encodings
    const encodings = ['utf-8', 'utf-16le', 'latin1', 'ascii'];
    
    for (const encoding of encodings) {
      try {
        const decoder = new TextDecoder(encoding);
        const text = decoder.decode(fileData);
        
        // Check if the text looks valid (not too many null characters or weird chars)
        const nullCount = (text.match(/\0/g) || []).length;
        const validCharRatio = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').length / text.length;
        
        if (nullCount < text.length * 0.1 && validCharRatio > 0.8) {
          console.log(`[MediaLibrary MCP] Successfully decoded TXT with ${encoding}: ${text.length} characters`);
          return text;
        }
      } catch (encodingError) {
        console.log(`[MediaLibrary MCP] Failed to decode with ${encoding}:`, encodingError.message);
      }
    }
    
    // Fallback: use UTF-8 and clean up the text
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const text = decoder.decode(fileData).replace(/\0/g, '');
    console.log(`[MediaLibrary MCP] Fallback UTF-8 extraction: ${text.length} characters`);
    
    return text;
  } catch (error: any) {
    console.error('[MediaLibrary MCP] TXT extraction error:', error);
    return `Error extracting text from TXT: ${error.message}. The file may have an unsupported encoding.`;
  }
}

async function detectFileTypeFromContent(fileData: Uint8Array, fileName: string, providedType?: string): Promise<string> {
  // If we have a provided type, use it
  if (providedType && providedType !== 'application/octet-stream') {
    return providedType;
  }
  
  // File signature detection
  const signature = Array.from(fileData.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Common file signatures
  const signatures: { [key: string]: string } = {
    '504b0304': 'application/zip', // ZIP-based formats (DOCX, PPTX, XLSX)
    '25504446': 'application/pdf', // PDF
    'd0cf11e0': 'application/vnd.ms-office', // Old Office formats (DOC, XLS, PPT)
    '89504e47': 'image/png',
    'ffd8ffe0': 'image/jpeg',
    'ffd8ffe1': 'image/jpeg',
    '47494638': 'image/gif',
    '424d': 'image/bmp',
  };
  
  // Check for ZIP-based Office formats
  if (signature.startsWith('504b0304')) {
    const extension = fileName.toLowerCase().split('.').pop();
    switch (extension) {
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      default: return 'application/zip';
    }
  }
  
  // Check other signatures
  for (const [sig, type] of Object.entries(signatures)) {
    if (signature.startsWith(sig)) {
      return type;
    }
  }
  
  // Fallback to file extension
  const extension = fileName.toLowerCase().split('.').pop();
  switch (extension) {
    case 'txt': return 'text/plain';
    case 'doc': return 'application/msword';
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'bmp': return 'image/bmp';
    case 'tiff':
    case 'tif': return 'image/tiff';
    default: return providedType || 'application/octet-stream';
  }
}

async function extractTextWithLocalOCR(
  fileData: Uint8Array,
  fileName: string,
  fileType: string
): Promise<string> {
  console.log(`[MediaLibrary MCP] Starting local OCR extraction for ${fileName} (${fileType})`);
  
  try {
    // Only process images with local OCR for now
    // PDF processing will be handled by the external OCR service
    if (!fileType.startsWith('image/')) {
      throw new Error(`Local OCR only supports images. File type: ${fileType}`);
    }
    
    console.log(`[MediaLibrary MCP] Processing image with Tesseract OCR`);
    
    // Create Tesseract worker
    const worker = await createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`[MediaLibrary MCP] OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    try {
      // Configure Tesseract for better accuracy
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?:;-()[]{}"\'/\\@#$%^&*+=<>|`~_',
        tessedit_pageseg_mode: '1', // Automatic page segmentation with OSD
        preserve_interword_spaces: '1',
      });
      
      console.log(`[MediaLibrary MCP] Running OCR recognition on ${fileData.length} bytes...`);
      
      // Create a buffer for Tesseract
      const buffer = Buffer.from(fileData);
      const { data: { text } } = await worker.recognize(buffer);
      
      console.log(`[MediaLibrary MCP] Local OCR completed: ${text.length} characters extracted`);
      
      if (text.length < 10) {
        throw new Error('OCR extracted very little text, possibly poor quality image');
      }
      
      return text.trim();
      
    } finally {
      await worker.terminate();
    }
    
  } catch (error) {
    console.error(`[MediaLibrary MCP] Local OCR extraction failed:`, error);
    throw error;
  }
}

async function extractTextWithMistralOCR(
  fileData: Uint8Array,
  fileName: string,
  userId: string,
  supabaseClient: any
): Promise<string> {
  console.log(`[MediaLibrary MCP] Attempting Mistral OCR extraction for ${fileName}`);

  try {
    // Get Mistral AI API key from vault-stored credentials
    const { data: connection, error: connectionError } = await supabaseClient
      .from('user_integration_credentials')
      .select(`
        vault_access_token_id,
        connection_metadata,
        service_providers!inner(name)
      `)
      .eq('user_id', userId)
      .eq('credential_type', 'api_key')
      .eq('connection_status', 'active')
      .eq('service_providers.name', 'mistral_ai')
      .single();

    if (connectionError || !connection) {
      throw new Error('No active Mistral AI connection found');
    }

    if (!connection.vault_access_token_id) {
      throw new Error('Mistral AI connection has no vault token');
    }

    // Decrypt API key from vault
    const { data: apiKey, error: vaultError } = await supabaseClient
      .rpc('vault_decrypt', { vault_id: connection.vault_access_token_id });

    if (vaultError || !apiKey) {
      throw new Error(`Failed to decrypt Mistral API key: ${vaultError?.message}`);
    }

    // Get connection settings
    const metadata = connection.connection_metadata || {};
    const model = metadata.model || 'mistral-ocr-latest';
    const maxPages = metadata.max_pages || 10;
    const includeImages = metadata.include_images || false;

    // First, upload the file to Mistral's files endpoint
    console.log(`[MediaLibrary MCP] Uploading file to Mistral AI (${fileData.length} bytes)`);
    
    const uploadFormData = new FormData();
    const blob = new Blob([fileData], { 
      type: fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream' 
    });
    uploadFormData.append('file', blob, fileName);
    uploadFormData.append('purpose', 'ocr'); // Required field

    const uploadResponse = await fetch('https://api.mistral.ai/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: uploadFormData
    });

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.text();
      throw new Error(`File upload failed: ${uploadResponse.status} - ${uploadError}`);
    }

    const uploadResult = await uploadResponse.json();
    const fileId = uploadResult.id;
    
    console.log(`[MediaLibrary MCP] File uploaded to Mistral with ID: ${fileId}`);

    // Now perform OCR on the uploaded file
    const ocrPayload = {
      model: model,
      document: {
        type: 'file',
        file_id: fileId
      },
      pages: null, // Process all pages
      include_image_base64: includeImages,
      image_limit: includeImages ? 50 : 0,
      image_min_size: includeImages ? 100 : 0
    };

    console.log(`[MediaLibrary MCP] Starting OCR processing with model: ${model}`);

    const ocrResponse = await fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(ocrPayload)
    });

    if (!ocrResponse.ok) {
      const ocrError = await ocrResponse.text();
      throw new Error(`Mistral OCR failed: ${ocrResponse.status} - ${ocrError}`);
    }

    const ocrResult = await ocrResponse.json();
    
    // Extract text from all pages
    const allText: string[] = [];
    
    if (ocrResult.pages && ocrResult.pages.length > 0) {
      for (const page of ocrResult.pages) {
        if (page.markdown && page.markdown.trim()) {
          allText.push(`=== Page ${page.index + 1} ===\n${page.markdown.trim()}`);
        }
      }
    }

    // Clean up: delete the uploaded file
    try {
      await fetch(`https://api.mistral.ai/v1/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        }
      });
      console.log(`[MediaLibrary MCP] Cleaned up uploaded file: ${fileId}`);
    } catch (cleanupError) {
      console.warn(`[MediaLibrary MCP] Failed to cleanup file ${fileId}:`, cleanupError);
    }

    const extractedText = allText.join('\n\n');
    console.log(`[MediaLibrary MCP] Mistral OCR completed: ${extractedText.length} characters extracted from ${ocrResult.pages?.length || 0} pages`);

    if (extractedText.length === 0) {
      throw new Error('No text content extracted from document');
    }

    return extractedText;

  } catch (error: any) {
    console.error(`[MediaLibrary MCP] Mistral OCR extraction failed:`, error);
    throw error;
  }
}

async function extractTextWithOCR(
  fileData: Uint8Array,
  fileName: string,
  apiKey?: string
): Promise<string> {
  // OCR.Space integration removed - use alternative OCR providers (Azure Document Intelligence, Mistral OCR, etc.)
  console.log('[MediaLibrary MCP] OCR disabled - configure alternative OCR provider if needed');
  throw new Error('OCR.Space integration has been removed. Please configure an alternative OCR provider (Azure Document Intelligence, Mistral OCR, etc.)');
}

async function extractTextFromDocument(
  fileData: Uint8Array, 
  fileType: string, 
  fileName: string,
  userId: string,
  supabaseClient: any,
  retryCount: number = 0
): Promise<string> {
  console.log(`[MediaLibrary MCP] Starting text extraction for ${fileName} (${fileType}) - Attempt ${retryCount + 1}`);
  
  try {
    // Detect the actual file type from content and filename
    const detectedType = await detectFileTypeFromContent(fileData, fileName, fileType);
    console.log(`[MediaLibrary MCP] Detected file type: ${detectedType} (provided: ${fileType})`);
    
    let extractedText = '';

    // Route to appropriate extraction method using dedicated parser services
    if (detectedType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      extractedText = await extractTextFromPDF(fileData);
      
    } else if (detectedType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
               fileName.toLowerCase().endsWith('.docx')) {
      extractedText = await extractTextFromWord(fileData, fileName);
      
    } else if (detectedType === 'application/msword' || 
               fileName.toLowerCase().endsWith('.doc')) {
      extractedText = await extractTextFromWord(fileData, fileName);
      
    } else if (detectedType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
               fileName.toLowerCase().endsWith('.xlsx')) {
      extractedText = await extractTextFromExcel(fileData, fileName);
      
    } else if (detectedType === 'application/vnd.ms-excel' || 
               fileName.toLowerCase().endsWith('.xls')) {
      extractedText = await extractTextFromExcel(fileData, fileName);
      
    } else if (detectedType === 'text/csv' || fileName.toLowerCase().endsWith('.csv')) {
      extractedText = await extractTextFromExcel(fileData, fileName);
      
    } else if (detectedType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || 
               fileName.toLowerCase().endsWith('.pptx')) {
      extractedText = await extractTextFromPowerPoint(fileData, fileName);
      
    } else if (detectedType === 'application/vnd.ms-powerpoint' || 
               fileName.toLowerCase().endsWith('.ppt')) {
      extractedText = await extractTextFromPowerPoint(fileData, fileName);
      
    } else if (detectedType === 'text/plain' || fileName.toLowerCase().endsWith('.txt')) {
      extractedText = await extractTextFromText(fileData, fileName);
      
    } else if (detectedType.startsWith('image/')) {
      // For images, we'll go straight to OCR
      throw new Error(`Image file detected - will use OCR processing`);
      
    } else {
      return `Unsupported file type: ${detectedType} (${fileType}). Supported formats: PDF, DOC/DOCX, XLS/XLSX/CSV, PPT/PPTX, TXT, Images`;
    }
    
    // Check if extraction was successful
    const isSuccessful = extractedText.length > 50 && 
                        !extractedText.includes('no extractable text') &&
                        !extractedText.includes('Error extracting text') &&
                        !extractedText.includes('corrupted') &&
                        !extractedText.includes('encrypted');
    
    if (isSuccessful) {
      console.log(`[MediaLibrary MCP] Successfully extracted ${extractedText.length} characters on attempt ${retryCount + 1}`);
      return extractedText;
    }
    
    // If extraction failed and we haven't exceeded retry limit, try again
    if (retryCount < 2) {
      console.log(`[MediaLibrary MCP] Extraction attempt ${retryCount + 1} yielded poor results, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      return await extractTextFromDocument(fileData, fileType, fileName, userId, supabaseClient, retryCount + 1);
    }
    
    // If all retries failed, try OCR fallbacks for supported formats
    if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf') || 
        fileType.startsWith('image/') || fileName.toLowerCase().endsWith('.pptx')) {
      
      console.log(`[MediaLibrary MCP] Standard extraction failed after ${retryCount + 1} attempts, trying OCR fallbacks`);
      
      // For images, try local OCR first
      if (fileType.startsWith('image/')) {
        try {
          const localOcrText = await extractTextWithLocalOCR(fileData, fileName, fileType);
          if (localOcrText.length > 10) {
            console.log(`[MediaLibrary MCP] Local OCR fallback successful: ${localOcrText.length} characters`);
            return `${localOcrText}\n\n[Note: This content was extracted using local OCR due to document format limitations]`;
          }
        } catch (localOcrError) {
          console.error('[MediaLibrary MCP] Local OCR fallback failed:', localOcrError);
        }
      }
      
      // Try Mistral OCR first (if user has it configured) - highest quality
      try {
        console.log(`[MediaLibrary MCP] Trying Mistral OCR fallback`);
        const mistralText = await extractTextWithMistralOCR(fileData, fileName, userId, supabaseClient);
        if (mistralText.length > 10) {
          console.log(`[MediaLibrary MCP] Mistral OCR fallback successful: ${mistralText.length} characters`);
          return `${mistralText}\n\n[Note: This content was extracted using Mistral AI OCR due to document format limitations]`;
        }
      } catch (mistralError) {
        console.error('[MediaLibrary MCP] Mistral OCR fallback failed:', mistralError);
      }
      
      // For PDFs, PPTX, or if other OCR methods failed, try OCR.space
      if (Deno.env.get('OCR_SPACE_API_KEY')) {
        console.log(`[MediaLibrary MCP] Trying OCR.space fallback`);
        try {
          const ocrText = await extractTextWithOCR(fileData, fileName, Deno.env.get('OCR_SPACE_API_KEY'));
          if (ocrText.length > 10) {
            console.log(`[MediaLibrary MCP] OCR.space fallback successful: ${ocrText.length} characters`);
            return `${ocrText}\n\n[Note: This content was extracted using external OCR service due to document format limitations]`;
          }
        } catch (ocrError) {
          console.error('[MediaLibrary MCP] OCR.space fallback also failed:', ocrError);
        }
      }
    }
    
    // Return the best result we got, even if it's not ideal
    return extractedText;
    
  } catch (error: any) {
    console.error(`[MediaLibrary MCP] Text extraction error on attempt ${retryCount + 1}:`, error);
    
    // If we haven't exceeded retry limit, try again
    if (retryCount < 2) {
      console.log(`[MediaLibrary MCP] Retrying extraction due to error...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await extractTextFromDocument(fileData, fileType, fileName, userId, supabaseClient, retryCount + 1);
    }
    
    // If all retries failed, return error message
    return `Error extracting text after ${retryCount + 1} attempts: ${error.message}. The document may be corrupted, encrypted, or in an unsupported format.`;
  }
}

function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  if (text.length <= chunkSize) {
    return [text];
  }
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    
    // Try to break at sentence boundaries
    if (end < text.length) {
      const sentenceEnd = text.lastIndexOf('.', end);
      const questionEnd = text.lastIndexOf('?', end);
      const exclamationEnd = text.lastIndexOf('!', end);
      
      const bestEnd = Math.max(sentenceEnd, questionEnd, exclamationEnd);
      if (bestEnd > start + chunkSize * 0.5) {
        end = bestEnd + 1;
      }
    }
    
    chunks.push(text.substring(start, end).trim());
    start = Math.max(start + 1, end - overlap);
  }
  
  return chunks;
}

// =============================================
// Document Management Handlers
// =============================================

async function handleUploadDocument(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { file_name, file_type, file_size, category = 'documents', description, tags = [] }: UploadRequest = params;
    
    if (!file_name || !file_type || !file_size) {
      throw new Error('Missing required fields: file_name, file_type, file_size');
    }
    
    // Generate storage path: user_id/category/timestamp_filename
    const timestamp = Date.now();
    const fileExtension = file_name.split('.').pop() || '';
    const baseName = file_name.replace(/\.[^/.]+$/, '');
    const sanitizedBaseName = baseName
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    const sanitizedFileName = fileExtension ? `${sanitizedBaseName}.${fileExtension}` : sanitizedBaseName;
    const storagePath = `${userId}/${category}/${timestamp}_${sanitizedFileName}`;
    
    // Create media library entry
    const { data: mediaEntry, error: insertError } = await supabase
      .from('media_library')
      .insert({
        user_id: userId,
        file_name,
        file_type,
        file_size,
        file_extension: file_name.split('.').pop()?.toLowerCase() || 'unknown',
        storage_bucket: 'media-library',
        storage_path: storagePath,
        category,
        description,
        tags,
        processing_status: 'uploaded'
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    return {
      success: true,
      data: {
        media_id: mediaEntry.id,
        file_name: mediaEntry.file_name,
        storage_path: storagePath,
        upload_url: `${supabaseUrl}/storage/v1/object/media-library/${storagePath}`,
        processing_status: 'uploaded',
        message: `Document uploaded successfully. Use process_document to extract text content.`
      },
      metadata: {
        tool_name: 'upload_document',
        execution_time_ms: Date.now() - startTime
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Upload document error:', error);
    return {
      success: false,
      error: error.message,
      metadata: {
        tool_name: 'upload_document',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

async function handleProcessDocument(
  supabase: any,
  supabaseServiceRole: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { document_id, force_reprocess = false } = params;
    
    if (!document_id) {
      throw new Error('Missing required parameter: document_id');
    }
    
    // Get the document from database
    const { data: mediaFile, error: fetchError } = await supabase
      .from('media_library')
      .select('*')
      .eq('id', document_id)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !mediaFile) {
      throw new Error('Document not found or access denied');
    }
    
    // Check if already processed
    if (mediaFile.processing_status === 'completed' && mediaFile.text_content && !force_reprocess) {
      return {
        success: true,
        data: {
          media_id: document_id,
          file_name: mediaFile.file_name,
          processing_status: 'already_completed',
          text_content: mediaFile.text_content,
          text_content_length: mediaFile.text_content.length,
          chunk_count: mediaFile.chunk_count,
          message: `Document already processed. Contains ${mediaFile.text_content.length} characters in ${mediaFile.chunk_count} chunks.`
        },
        metadata: {
          tool_name: 'process_document',
          execution_time_ms: Date.now() - startTime
        }
      };
    }
    
    // Update status to processing
    await supabase
      .from('media_library')
      .update({ processing_status: 'processing' })
      .eq('id', document_id);
    
    console.log(`[MediaLibrary MCP] Starting processing for document ${document_id}: ${mediaFile.file_name}`);
    
    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('media-library')
      .download(mediaFile.storage_path);
    
    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }
    
    // Convert to Uint8Array for text extraction
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Extract text content
    const textContent = await extractTextFromDocument(
      uint8Array, 
      mediaFile.file_type, 
      mediaFile.file_name,
      userId,
      supabaseServiceRole  // Use service role client for vault access
    );
    
    console.log(`[MediaLibrary MCP] Extracted ${textContent.length} characters from ${mediaFile.file_name}`);
    
    // Create chunks
    const chunks = chunkText(textContent);
    const chunkCount = chunks.length;
    
    console.log(`[MediaLibrary MCP] Created ${chunkCount} chunks from extracted text`);
    
    // Update database with processed content
    console.log(`[MediaLibrary MCP] Updating database with ${textContent.length} characters of content for document ${document_id}`);
    
    const { data: updateResult, error: updateError } = await supabase
      .from('media_library')
      .update({
        text_content: textContent,
        chunk_count: chunkCount,
        processing_status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', document_id)
      .select('id, text_content, chunk_count, processing_status');
    
    if (updateError) {
      console.error(`[MediaLibrary MCP] Database update failed:`, updateError);
      throw updateError;
    }
    
    // Verify the update was successful
    if (!updateResult || updateResult.length === 0) {
      console.error(`[MediaLibrary MCP] No rows updated for document ${document_id}`);
      throw new Error('Failed to update document in database');
    }
    
    const updatedDoc = updateResult[0];
    console.log(`[MediaLibrary MCP] Database update verified:`, {
      document_id: updatedDoc.id,
      content_length: updatedDoc.text_content?.length || 0,
      chunk_count: updatedDoc.chunk_count,
      status: updatedDoc.processing_status
    });
    
    // Double-check by reading back the content
    const { data: verifyDoc, error: verifyError } = await supabase
      .from('media_library')
      .select('text_content, chunk_count, processing_status')
      .eq('id', document_id)
      .single();
    
    if (verifyError) {
      console.error(`[MediaLibrary MCP] Verification read failed:`, verifyError);
    } else {
      console.log(`[MediaLibrary MCP] Verification read successful:`, {
        content_length: verifyDoc.text_content?.length || 0,
        chunk_count: verifyDoc.chunk_count,
        status: verifyDoc.processing_status
      });
    }
    
    console.log(`[MediaLibrary MCP] Successfully processed document ${document_id}. Ready to hand off ${textContent.length} characters to agent.`);
    
    return {
      success: true,
      data: {
        media_id: document_id,
        file_name: mediaFile.file_name,
        processing_status: 'completed',
        text_content: textContent,
        text_content_length: textContent.length,
        chunk_count: chunkCount,
        processing_method: 'direct_extraction',
        message: `Document processed successfully. Extracted ${textContent.length} characters into ${chunkCount} chunks. Content ready for agent access.`
      },
      metadata: {
        tool_name: 'process_document',
        execution_time_ms: Date.now() - startTime
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Process document error:', error);
    
    // Update status to error
    if (params.document_id) {
      await supabase
        .from('media_library')
        .update({ processing_status: 'error' })
        .eq('id', params.document_id);
    }
    
    return {
      success: false,
      error: error.message,
      metadata: {
        tool_name: 'process_document',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

async function handleAssignToAgent(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { 
      document_id, 
      assignment_type = 'reference',
      include_in_vector_search = true,
      include_in_knowledge_graph = false,
      priority_level = 1
    } = params;
    
    if (!document_id) {
      throw new Error('Missing required parameter: document_id');
    }
    
    // Use the database function to assign media to agent
    const { data: assignmentId, error: assignError } = await supabase
      .rpc('assign_media_to_agent', {
        p_agent_id: agentId,
        p_media_id: document_id,
        p_user_id: userId,
        p_assignment_type: assignment_type,
        p_include_vector: include_in_vector_search,
        p_include_graph: include_in_knowledge_graph
      });
    
    if (assignError) throw assignError;
    
    return {
      success: true,
      data: {
        assignment_id: assignmentId,
        agent_id: agentId,
        document_id: document_id,
        assignment_type: assignment_type,
        message: `Document successfully assigned to agent with type "${assignment_type}"`
      },
      metadata: {
        tool_name: 'assign_to_agent',
        execution_time_ms: Date.now() - startTime
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Assign to agent error:', error);
    return {
      success: false,
      error: error.message,
      metadata: {
        tool_name: 'assign_to_agent',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

// =============================================
// Existing MCP Tool Handlers
// =============================================

async function handleSearchDocuments(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { 
      query, 
      search_type = 'semantic', 
      category, 
      assignment_type, 
      limit = 10 
    } = params;
    
    if (!query) {
      throw new Error('Missing required parameter: query');
    }
    
    // Use the database function for search
    const { data: searchResults, error: searchError } = await supabase
      .rpc('search_media_documents_for_agent', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_query: query,
        p_search_type: search_type,
        p_category: category,
        p_assignment_type: assignment_type,
        p_limit: limit
      });
    
    if (searchError) throw searchError;
    
    // Format results for MCP tool response
    const formattedResults = (searchResults || []).map((doc: any) => ({
      id: doc.document_id,
      title: doc.display_name || doc.file_name,
      content_preview: doc.content_preview,
      relevance_score: doc.relevance_score,
      category: doc.category,
      assignment_type: doc.assignment_type,
      file_url: doc.file_url,
      assigned_at: doc.assigned_at
    }));
    
    // Create a helpful summary for the agent
    const searchSummary = formattedResults.length > 0 
      ? `Found ${formattedResults.length} document(s) matching "${query}":\n\n${formattedResults.map((doc, index) => 
          `${index + 1}. "${doc.title}" (ID: ${doc.id})\n   Category: ${doc.category}\n   Preview: ${doc.content_preview || 'No preview available'}`
        ).join('\n\n')}\n\nUse get_document_content with the document ID to retrieve the full content of any document.`
      : `No documents found matching "${query}". The user may need to upload documents first or try different search terms.`;
    
    return {
      success: true,
      data: {
        search_results: searchSummary,
        documents: formattedResults,
        query_used: query,
        search_type: search_type
      },
      metadata: {
        tool_name: 'search_documents',
        execution_time_ms: Date.now() - startTime,
        results_count: formattedResults.length
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Search documents error:', error);
    
    // Provide helpful MCP error messages for the LLM to retry
    let helpfulError = error.message;
    if (error.message.includes('Missing required parameter: query')) {
      helpfulError = 'Question: What would you like me to search for in your documents? Please provide a search query or topic.';
    } else if (error.message.includes('Could not find the function')) {
      helpfulError = 'I apologize, but there seems to be an issue with the document search system. Please try again in a moment, or try listing your documents first with "list my assigned documents".';
    }
    
    return {
      success: false,
      error: helpfulError,
      metadata: {
        tool_name: 'search_documents',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

async function handleGetDocumentContent(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    let { document_id, include_metadata = true } = params;
    
    if (!document_id) {
      throw new Error('Missing required parameter: document_id');
    }
    
    // Check if document_id is a UUID, if not, try to find by title/filename
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(document_id)) {
      // Special case: if it's just a number, it's probably from the numbered list
      if (/^\d+$/.test(document_id.trim())) {
        throw new Error(`Document ID "${document_id}" appears to be a list number. Please use the actual document UUID from the "id" field in list_assigned_documents, not the list number. For example, use "f048957a-f417-48eb-bb5a-d5a5043e23df" instead of "2".`);
      }
      
      console.log(`[MediaLibrary MCP] document_id "${document_id}" is not a UUID, attempting to find by title/filename`);
      
      // Try to find the document by title or filename among assigned documents first
      // This ensures we only get documents that are actually assigned to this agent
      let { data: documents, error: searchError } = await supabase
        .from('media_library')
        .select(`
          id, 
          file_name, 
          display_name,
          agent_media_assignments!inner(agent_id, assignment_type)
        `)
        .eq('user_id', userId)
        .eq('is_archived', false)
        .eq('agent_media_assignments.agent_id', agentId);
      
      if (searchError) throw searchError;
      
      console.log(`[MediaLibrary MCP] Found ${documents?.length || 0} assigned documents for user ${userId} and agent ${agentId}`);
      
      // If no assigned documents found, provide helpful error message
      if (!documents || documents.length === 0) {
        throw new Error(`No documents assigned to this agent match "${document_id}". Please use list_assigned_documents to see what documents are available to you, or upload and assign the document first.`);
      }
      
      // Filter documents manually for better matching
      const matchingDocs = documents?.filter(doc => {
        const searchTerm = document_id.toLowerCase().trim();
        const fileName = (doc.file_name || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const displayName = (doc.display_name || '').toLowerCase().replace(/\s+/g, ' ').trim();
        
        // Normalize search term and filenames for better matching
        // Convert hyphens and underscores to spaces for comparison
        let normalizedSearchTerm = searchTerm.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
        const normalizedFileName = fileName.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
        const normalizedDisplayName = displayName.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Special handling for "UUID_OF_*" patterns - extract the meaningful part
        if (normalizedSearchTerm.startsWith('uuid of ') || normalizedSearchTerm.startsWith('uuid_of_')) {
          normalizedSearchTerm = normalizedSearchTerm.replace(/^uuid[\s_]*of[\s_]*/, '');
          console.log(`[MediaLibrary MCP] Extracted meaningful search term: "${normalizedSearchTerm}" from UUID_OF pattern`);
        }
        
        console.log(`[MediaLibrary MCP] Comparing "${normalizedSearchTerm}" with "${normalizedFileName}"`);
        
        // For short search terms (like numbers), require more specific matching
        if (normalizedSearchTerm.length <= 2) {
          // Only match if it's a word boundary or exact filename match
          const wordBoundaryRegex = new RegExp(`\\b${normalizedSearchTerm}\\b`, 'i');
          const matches = wordBoundaryRegex.test(normalizedFileName) || wordBoundaryRegex.test(normalizedDisplayName);
          
          if (matches) {
            console.log(`[MediaLibrary MCP] Found matching document (word boundary): "${doc.file_name}" (display: "${doc.display_name}")`);
          }
          return matches;
        } else {
          // For longer terms, use substring matching with multiple strategies
          const matches = normalizedFileName.includes(normalizedSearchTerm) || 
                         normalizedDisplayName.includes(normalizedSearchTerm) ||
                         normalizedFileName.replace(/\.pdf$/i, '').includes(normalizedSearchTerm) ||
                         normalizedDisplayName.replace(/\.pdf$/i, '').includes(normalizedSearchTerm) ||
                         // Also try partial word matching
                         normalizedSearchTerm.split(' ').every(word => 
                           word.length > 2 && (normalizedFileName.includes(word) || normalizedDisplayName.includes(word))
                         );
          
          if (matches) {
            console.log(`[MediaLibrary MCP] Found matching document: "${doc.file_name}" (display: "${doc.display_name}")`);
          }
          
          return matches;
        }
      }) || [];
      
      documents = matchingDocs;
      
      if (!documents || documents.length === 0) {
        // Get all documents for debugging
        const { data: allDocs } = await supabase
          .from('media_library')
          .select('file_name, display_name')
          .eq('user_id', userId)
          .eq('is_archived', false);
        
        console.log(`[MediaLibrary MCP] No assigned documents found matching "${document_id}". Available assigned documents:`, 
          allDocs?.map(d => `"${d.file_name}" (display: "${d.display_name}")`) || []);
        throw new Error(`No assigned documents found matching "${document_id}". Please use list_assigned_documents to see what documents are available to you, or check that the document has been uploaded and assigned to this agent.`);
      }
      
      if (documents.length > 1) {
        // Multiple documents with the same name - use the most recent one
        console.log(`[MediaLibrary MCP] Found ${documents.length} documents matching "${document_id}". Using the most recent one.`);
        
        // Sort by created_at descending and use the most recent
        documents.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA; // Most recent first
        });
        
        const mostRecent = documents[0];
        console.log(`[MediaLibrary MCP] Selected most recent document ID: ${mostRecent.id} (created: ${mostRecent.created_at})`);
        document_id = mostRecent.id;
      } else {
        document_id = documents[0].id;
      }
      
      // Check if this document is actually assigned to the agent
      const { data: assignment, error: assignmentError } = await supabase
        .from('agent_media_assignments')
        .select('media_id')
        .eq('agent_id', agentId)
        .eq('media_id', documents[0].id)
        .eq('is_active', true)
        .single();
      
      if (assignmentError || !assignment) {
        throw new Error(`Document "${document_id}" is not assigned to this agent. Please check your assigned documents.`);
      }
      
      // Use the found UUID
      document_id = documents[0].id;
      console.log(`[MediaLibrary MCP] Resolved "${params.document_id}" to UUID: ${document_id}`);
    }
    
    // Use the database function to get content with retry mechanism
    let documentContent: any = null;
    let contentError: any = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries && !documentContent) {
      console.log(`[MediaLibrary MCP] Attempting to retrieve document content (attempt ${retryCount + 1})`);
      
      const { data, error } = await supabase
      .rpc('get_media_document_content_for_agent', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_document_id: document_id,
        p_include_metadata: include_metadata
      });
    
      if (error) {
        contentError = error;
        console.error(`[MediaLibrary MCP] Content retrieval attempt ${retryCount + 1} failed:`, error);
      } else if (data && data.text_content && data.text_content.length > 0) {
        documentContent = data;
        console.log(`[MediaLibrary MCP] Content retrieval successful on attempt ${retryCount + 1}`);
        break;
      } else {
        console.log(`[MediaLibrary MCP] Content retrieval attempt ${retryCount + 1} returned empty content`);
        
        // Try direct database query as fallback
        if (retryCount === 1) {
          console.log(`[MediaLibrary MCP] Trying direct database query as fallback`);
          const { data: directData, error: directError } = await supabase
            .from('media_library')
            .select('id, file_name, display_name, text_content, chunk_count, processing_status')
            .eq('id', document_id)
            .eq('user_id', userId)
            .single();
          
          if (!directError && directData && directData.text_content) {
            console.log(`[MediaLibrary MCP] Direct query successful: ${directData.text_content.length} characters`);
            documentContent = {
              document_id: directData.id,
              file_name: directData.file_name,
              display_name: directData.display_name,
              text_content: directData.text_content,
              chunk_count: directData.chunk_count,
              processing_status: directData.processing_status
            };
            break;
          } else {
            console.error(`[MediaLibrary MCP] Direct query also failed:`, directError);
          }
        }
      }
      
      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`[MediaLibrary MCP] Waiting 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (contentError && !documentContent) {
      throw contentError;
    }
    
    if (!documentContent) {
      throw new Error('Document not found or not assigned to this agent after multiple attempts');
    }
    
    // Log successful content retrieval
    const contentLength = documentContent.text_content?.length || 0;
    console.log(`[MediaLibrary MCP] Successfully retrieved document content from database:`, {
      document_id: documentContent.document_id,
      file_name: documentContent.file_name,
      content_length: contentLength,
      has_content: contentLength > 0
    });
    
    // Format the response to provide document content, with intelligent truncation for very large documents
    let contentMessage: string;
    
    if (!documentContent.text_content || !documentContent.text_content.trim()) {
      contentMessage = `The document "${documentContent.display_name || documentContent.file_name}" was processed but contains no extractable text content. This may be an image-only PDF, encrypted document, or unsupported file format.`;
    } else {
      const content = documentContent.text_content.trim();
      const contentLength = content.length;
      
      // If document is very large (>50k chars), provide a structured summary instead of full content
      if (contentLength > 50000) {
        const firstChunk = content.substring(0, 10000);
        const middleStart = Math.floor(contentLength / 2) - 5000;
        const middleChunk = content.substring(middleStart, middleStart + 10000);
        const lastChunk = content.substring(contentLength - 10000);
        
        contentMessage = `I've accessed your document "${documentContent.display_name || documentContent.file_name}", but it's quite large (${contentLength.toLocaleString()} characters). To avoid overwhelming our conversation, I'm showing you key excerpts:

**📊 DOCUMENT OVERVIEW:**
- Total length: ${contentLength.toLocaleString()} characters
- Chunk count: ${documentContent.chunk_count || 'Unknown'}
- Processing status: ${documentContent.processing_status}

**📖 BEGINNING (First 10,000 characters):**
${firstChunk}

**📖 MIDDLE SECTION (Characters ${middleStart.toLocaleString()}-${(middleStart + 10000).toLocaleString()}):**
${middleChunk}

**📖 ENDING (Last 10,000 characters):**
${lastChunk}

**💡 WHAT YOU CAN DO:**
Since this document is large, I can help you in several ways:
1. **Search specific topics**: Ask me to search for specific terms or concepts
2. **Get targeted sections**: Tell me what specific information you're looking for
3. **Summarize content**: I can provide summaries of specific sections
4. **Answer questions**: Ask me specific questions about the document content

Just let me know what specific information you need from this document!`;
      } else {
        // For smaller documents, provide full content
        contentMessage = `Here is the content from your document "${documentContent.display_name || documentContent.file_name}":\n\n${content}`;
      }
    }
    
    console.log(`[MediaLibrary MCP] Handing off ${contentLength} characters of document content back to agent`);
    
    return {
      success: true,
      data: {
        document_content: contentMessage,
        document_metadata: {
          id: documentContent.document_id,
          name: documentContent.display_name || documentContent.file_name,
          file_type: documentContent.file_type,
          category: documentContent.category,
          processing_status: documentContent.processing_status,
          chunk_count: documentContent.chunk_count,
          content_length: documentContent.text_content?.length || 0
        }
      },
      metadata: {
        tool_name: 'get_document_content',
        execution_time_ms: Date.now() - startTime
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Get document content error:', error);
    
    // Provide helpful MCP error messages for the LLM to retry
    let helpfulError = error.message;
    if (error.message.includes('invalid input syntax for type uuid')) {
      helpfulError = 'I need the document ID (UUID) to retrieve the content, not the document name. Please use the "id" field from the document list. For example, if you want to read "Every Citizen Armed Media Kit.pdf", use its ID like "f048957a-f417-48eb-bb5a-d5a5043e23df" instead of the filename.';
    } else if (error.message.includes('Missing required parameter: document_id')) {
      helpfulError = 'Question: Which document would you like me to retrieve? Please specify the document name or ID. You can first use "list my assigned documents" to see available documents.';
    } else if (error.message.includes('Document not found or not assigned')) {
      helpfulError = 'I cannot find that document in your assigned documents. Please check the document name or use "list my assigned documents" to see what documents are available to you.';
    } else if (error.message.includes('Could not find the function')) {
      helpfulError = 'I apologize, but there seems to be an issue with the document retrieval system. Please try again in a moment, or try listing your documents first.';
    }
    
    return {
      success: false,
      error: helpfulError,
      metadata: {
        tool_name: 'get_document_content',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

async function handleListAssignedDocuments(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { 
      category, 
      assignment_type, 
      include_inactive = false,
      limit = 100,
      offset = 0
    } = params;
    
    // Use the database function to list documents
    const { data: documentsData, error: listError } = await supabase
      .rpc('list_agent_assigned_documents', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_category: category,
        p_assignment_type: assignment_type,
        p_include_inactive: include_inactive,
        p_limit: limit,
        p_offset: offset
      });
    
    if (listError) throw listError;
    
    // The database function returns an array of documents directly, not an object
    const documents = documentsData || [];
    const totalCount = documents.length;
    
    // Format documents for MCP response
    const formattedDocuments = documents.map((doc: any) => ({
      id: doc.document_id,
      title: doc.display_name || doc.file_name,
      file_name: doc.file_name,
      file_type: doc.file_type,
      file_size: doc.file_size,
      category: doc.category,
      assignment_type: doc.assignment_type,
      processing_status: doc.processing_status,
      tags: doc.tags,
      description: doc.description,
      chunk_count: doc.chunk_count,
      assigned_at: doc.assigned_at,
      last_accessed_at: doc.last_accessed_at,
      access_count: doc.access_count,
      is_active: doc.is_active
    }));
    
    return {
      success: true,
      data: {
        total_count: totalCount,
        documents: formattedDocuments,
        summary: `Agent has ${totalCount} assigned document(s)${category ? ` in category "${category}"` : ''}${assignment_type ? ` of type "${assignment_type}"` : ''}. To read a document's content, use the 'id' field (UUID) from the document list, not the title or filename.`
      },
      metadata: {
        tool_name: 'list_assigned_documents',
        execution_time_ms: Date.now() - startTime,
        results_count: totalCount
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] List assigned documents error:', error);
    
    // Provide helpful MCP error messages for the LLM to retry
    let helpfulError = error.message;
    if (error.message.includes('Could not find the function')) {
      helpfulError = 'I apologize, but there seems to be an issue with the document listing system. This might be a temporary issue - please try again in a moment.';
    } else if (error.message.includes('parameters')) {
      helpfulError = 'I encountered an issue with the document listing. Please try asking "show me my documents" or "what documents do I have access to?"';
    }
    
    return {
      success: false,
      error: helpfulError,
      metadata: {
        tool_name: 'list_assigned_documents',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

async function handleGetDocumentSummary(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { document_id, summary_type = 'brief', max_length = 200 } = params;
    
    if (!document_id) {
      throw new Error('Missing required parameter: document_id');
    }
    
    // First, get the document content
    const { data: documentContent, error: contentError } = await supabase
      .rpc('get_media_document_content_for_agent', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_document_id: document_id,
        p_include_metadata: true
      });
    
    if (contentError) throw contentError;
    
    if (!documentContent) {
      throw new Error('Document not found or not assigned to this agent');
    }
    
    // Generate summary based on type
    let summary: string;
    const textContent = documentContent.text_content || '';
    
    switch (summary_type) {
      case 'brief':
        summary = textContent.length > max_length 
          ? textContent.substring(0, max_length) + '...'
          : textContent;
        break;
        
      case 'key_points':
        // Extract first few sentences as key points
        const sentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 10);
        summary = sentences.slice(0, 3).join('. ') + (sentences.length > 3 ? '...' : '');
        break;
        
      case 'executive':
        // Executive summary - first paragraph
        const paragraphs = textContent.split('\n\n').filter(p => p.trim().length > 0);
        summary = paragraphs[0] || textContent.substring(0, max_length) + '...';
        break;
        
      case 'detailed':
      default:
        summary = textContent.length > max_length * 2 
          ? textContent.substring(0, max_length * 2) + '...'
          : textContent;
        break;
    }
    
    return {
      success: true,
      data: {
        document_id: document_id,
        document_name: documentContent.display_name || documentContent.file_name,
        summary_type: summary_type,
        summary: summary,
        original_length: textContent.length,
        summary_length: summary.length,
        document_metadata: {
          category: documentContent.category,
          file_type: documentContent.file_type,
          created_at: documentContent.created_at,
          assignment_type: documentContent.assignment_info?.assignment_type
        }
      },
      metadata: {
        tool_name: 'get_document_summary',
        execution_time_ms: Date.now() - startTime
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Get document summary error:', error);
    return {
      success: false,
      error: error.message,
      metadata: {
        tool_name: 'get_document_summary',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

async function handleFindRelatedDocuments(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { 
      reference_document_id, 
      topic, 
      similarity_threshold = 0.7, 
      limit = 5 
    } = params;
    
    if (!reference_document_id && !topic) {
      throw new Error('Either reference_document_id or topic must be provided');
    }
    
    let searchQuery: string;
    
    if (reference_document_id) {
      // Get reference document content to find similar documents
      const { data: refDoc, error: refError } = await supabase
        .rpc('get_media_document_content_for_agent', {
          p_agent_id: agentId,
          p_user_id: userId,
          p_document_id: reference_document_id,
          p_include_metadata: false
        });
      
      if (refError || !refDoc) {
        throw new Error('Reference document not found or access denied');
      }
      
      // Extract key terms from the document for similarity search
      searchQuery = refDoc.text_content?.substring(0, 500) || refDoc.file_name;
    } else {
      searchQuery = topic;
    }
    
    // Search for related documents
    const { data: relatedResults, error: searchError } = await supabase
      .rpc('search_media_documents_for_agent', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_query: searchQuery,
        p_search_type: 'semantic',
        p_category: null,
        p_assignment_type: null,
        p_limit: limit + 1 // Get one extra to exclude reference doc if needed
      });
    
    if (searchError) throw searchError;
    
    // Filter out the reference document if it was provided
    const filteredResults = reference_document_id 
      ? (relatedResults || []).filter((doc: any) => doc.document_id !== reference_document_id)
      : (relatedResults || []);
    
    // Apply similarity threshold
    const relevantResults = filteredResults
      .filter((doc: any) => doc.relevance_score >= similarity_threshold)
      .slice(0, limit);
    
    return {
      success: true,
      data: {
        reference_document_id: reference_document_id,
        topic: topic,
        similarity_threshold: similarity_threshold,
        related_documents: relevantResults,
        summary: `Found ${relevantResults.length} related document(s)${reference_document_id ? ' to the reference document' : ` about "${topic}"`}`
      },
      metadata: {
        tool_name: 'find_related_documents',
        execution_time_ms: Date.now() - startTime,
        results_count: relevantResults.length
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Find related documents error:', error);
    return {
      success: false,
      error: error.message,
      metadata: {
        tool_name: 'find_related_documents',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

async function handleReprocessDocument(
  supabase: any,
  agentId: string,
  userId: string,
  params: any,
  authHeader?: string
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { document_id, document_name, force_ocr = false } = params;
    
    if (!document_id && !document_name) {
      throw new Error('Missing required parameter: document_id or document_name');
    }
    
    // Resolve document ID - check if document_id is actually a UUID or a name
    let resolvedDocumentId = document_id;
    
    // Check if document_id looks like a UUID (36 characters with dashes)
    const isUUID = document_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(document_id);
    
    if (!isUUID && (document_id || document_name)) {
      const searchTerm = document_id || document_name;
      console.log(`[MediaLibrary MCP] document_id "${searchTerm}" is not a UUID, attempting to find by title/filename`);
      
      // Get all assigned documents and find by name
      const { data: allDocuments, error: listError } = await supabase
        .rpc('list_agent_assigned_documents', {
          p_agent_id: agentId,
          p_user_id: userId,
          p_category: null,
          p_assignment_type: null,
          p_include_inactive: false,
          p_limit: 100,
          p_offset: 0
        });
      
      if (listError) throw listError;
      
      console.log(`[MediaLibrary MCP] Found ${allDocuments?.length || 0} total documents for user ${userId}`);
      
      // Search for document by name (case-insensitive)
      const searchName = searchTerm.toLowerCase();
      const matchingDoc = allDocuments?.find((doc: any) => {
        const docName = (doc.file_name || '').toLowerCase();
        const displayName = (doc.display_name || '').toLowerCase();
        
        console.log(`[MediaLibrary MCP] Comparing "${searchName}" with "${docName}"`);
        
        return docName === searchName || 
               displayName === searchName ||
               docName.includes(searchName) ||
               displayName.includes(searchName);
      });
      
      if (matchingDoc) {
        resolvedDocumentId = matchingDoc.document_id;
        console.log(`[MediaLibrary MCP] Found matching document: "${matchingDoc.file_name}" (display: "${matchingDoc.display_name}")`);
        console.log(`[MediaLibrary MCP] Resolved "${searchTerm}" to UUID: ${resolvedDocumentId}`);
      } else {
        throw new Error(`Document "${searchTerm}" not found in your assigned documents`);
      }
    }
    
    if (!resolvedDocumentId) {
      throw new Error('Could not resolve document ID');
    }
    
    // Verify the document exists and is assigned to the agent
    const { data: documentContent, error: contentError } = await supabase
      .rpc('get_media_document_content_for_agent', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_document_id: resolvedDocumentId,
        p_include_metadata: true
      });
    
    if (contentError) throw contentError;
    
    if (!documentContent) {
      throw new Error('Document not found or not assigned to this agent');
    }
    
    // Check if the document content appears corrupted or needs OCR
    const currentContent = documentContent.text_content || '';
    const fileType = documentContent.file_type || '';
    const fileName = documentContent.display_name || documentContent.file_name || 'Unknown';
    
    // Smart detection of documents that need reprocessing
    const isLikelyCorrupted = currentContent.length < 50 || 
                             currentContent.includes('encoded') || 
                             currentContent.includes('corrupted') ||
                             currentContent.includes('binary') ||
                             currentContent.includes('error');
    
    const isPdfOrImage = fileType.includes('pdf') || fileType.includes('image');
    const needsReprocessing = isLikelyCorrupted || force_ocr;
    
    if (!needsReprocessing && !force_ocr) {
      const suggestion = isPdfOrImage && currentContent.length < 200 
        ? ' If this PDF or image should have more text content, you can force reprocessing with OCR by saying "reprocess [document] with OCR".'
        : '';
        
      return {
        success: true,
        data: {
          document_id: document_id,
          document_name: fileName,
          message: `"${fileName}" appears to have good content (${currentContent.length} characters). ${suggestion}`,
          current_content_length: currentContent.length,
          file_type: fileType,
          content_preview: currentContent.substring(0, 200) + (currentContent.length > 200 ? '...' : '')
        },
        metadata: {
          tool_name: 'reprocess_document',
          execution_time_ms: Date.now() - startTime
        }
      };
    }
    
    console.log(`[MediaLibrary MCP] Triggering reprocessing for document ${resolvedDocumentId}`);
    
    // Create Supabase client with service role for calling media-library-api
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Call the media-library-api to reprocess the document with user auth
    const invokeOptions: any = {
      body: {
        action: 'process',
        document_id: resolvedDocumentId,
        user_id: userId,
        force_reprocess: true,
        force_ocr: force_ocr
      }
    };
    
    // Pass through the original authorization header if available
    if (authHeader) {
      invokeOptions.headers = {
        'Authorization': authHeader
      };
    }
    
    const { data: reprocessResult, error: reprocessError } = await serviceSupabase.functions.invoke('media-library-api', invokeOptions);
    
    if (reprocessError) {
      throw new Error(`Document reprocessing failed: ${reprocessError.message}`);
    }
    
    const successMessage = force_ocr 
      ? `Successfully reprocessed "${fileName}" with OCR. The document should now have better text extraction, especially if it contained images or scanned content.`
      : `Successfully reprocessed "${fileName}". The document content has been refreshed and should now be more accessible.`;
    
    return {
      success: true,
      data: {
        document_id: resolvedDocumentId,
        document_name: fileName,
        message: successMessage,
        previous_content_length: currentContent.length,
        file_type: fileType,
        reprocessing_type: force_ocr ? 'OCR-enhanced' : 'standard',
        next_steps: 'You can now try reading the document content again or searching within it. The updated content should be available immediately.',
        reprocess_result: reprocessResult
      },
      metadata: {
        tool_name: 'reprocess_document',
        execution_time_ms: Date.now() - startTime
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Reprocess document error:', error);
    
    // Provide intelligent MCP error messages with actionable guidance
    let helpfulError = error.message;
    if (error.message.includes('Missing required parameter: document_id')) {
      helpfulError = 'I need to know which document to reprocess. Please tell me the document name or ID, or ask me to "list my assigned documents" to see what\'s available. You can also say "reprocess the document about [topic]" and I\'ll find it.';
    } else if (error.message.includes('Document not found or not assigned')) {
      helpfulError = 'That document isn\'t in your assigned documents or doesn\'t exist. Let me "list your assigned documents" to show what\'s available, or you can upload a new document first.';
    } else if (error.message.includes('reprocessing failed')) {
      helpfulError = 'The document reprocessing encountered an issue. This might be due to OCR service limits or the document format. Try again in a few minutes, or let me check if there are alternative OCR services configured.';
    }
    
    return {
      success: false,
      error: helpfulError,
      metadata: {
        tool_name: 'reprocess_document',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

async function handleSearchDocumentContent(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { document_id, search_query, max_results = 5 } = params;
    
    if (!document_id) {
      throw new Error('Missing required parameter: document_id');
    }
    
    if (!search_query || search_query.trim().length < 2) {
      throw new Error('Missing or invalid search_query. Please provide at least 2 characters.');
    }
    
    // Get the document content first
    const { data: documentContent, error: contentError } = await supabase
      .rpc('get_media_document_content_for_agent', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_document_id: document_id,
        p_include_metadata: true
      });
    
    if (contentError) throw contentError;
    
    if (!documentContent || !documentContent.text_content) {
      throw new Error('Document not found, not assigned to agent, or has no content');
    }
    
    const content = documentContent.text_content;
    const query = search_query.trim().toLowerCase();
    
    // Simple text search with context
    const results: Array<{
      snippet: string;
      position: number;
      context_before: string;
      context_after: string;
      relevance_score: number;
    }> = [];
    
    // Find all occurrences of the search query
    let searchIndex = 0;
    while (searchIndex < content.length) {
      const foundIndex = content.toLowerCase().indexOf(query, searchIndex);
      if (foundIndex === -1) break;
      
      // Extract context around the match
      const contextSize = 500;
      const snippetSize = 200;
      
      const contextStart = Math.max(0, foundIndex - contextSize);
      const contextEnd = Math.min(content.length, foundIndex + query.length + contextSize);
      const snippetStart = Math.max(0, foundIndex - snippetSize);
      const snippetEnd = Math.min(content.length, foundIndex + query.length + snippetSize);
      
      const contextBefore = content.substring(contextStart, foundIndex).trim();
      const contextAfter = content.substring(foundIndex + query.length, contextEnd).trim();
      const snippet = content.substring(snippetStart, snippetEnd).trim();
      
      // Calculate a simple relevance score based on surrounding context
      const relevanceScore = Math.min(1.0, 0.5 + (contextBefore.length + contextAfter.length) / 2000);
      
      results.push({
        snippet,
        position: foundIndex,
        context_before: contextBefore,
        context_after: contextAfter,
        relevance_score: relevanceScore
      });
      
      searchIndex = foundIndex + 1;
      
      // Limit results to prevent overwhelming response
      if (results.length >= max_results * 2) break;
    }
    
    // Sort by relevance and limit results
    const sortedResults = results
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, max_results);
    
    return {
      success: true,
      data: {
        document_id,
        document_name: documentContent.display_name || documentContent.file_name,
        search_query,
        results_found: sortedResults.length,
        total_matches: results.length,
        results: sortedResults.map((result, index) => ({
          rank: index + 1,
          snippet: result.snippet,
          character_position: result.position,
          relevance_score: Math.round(result.relevance_score * 100) / 100,
          context: {
            before: result.context_before.length > 200 ? '...' + result.context_before.slice(-200) : result.context_before,
            after: result.context_after.length > 200 ? result.context_after.slice(0, 200) + '...' : result.context_after
          }
        }))
      },
      metadata: {
        tool_name: 'search_document_content',
        execution_time_ms: Date.now() - startTime
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Search document content error:', error);
    return {
      success: false,
      error: error.message,
      metadata: {
        tool_name: 'search_document_content',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

// =============================================
// Main Handler
// =============================================

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    let body: MCPToolRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[MediaLibrary MCP] JSON parsing error:', parseError);
      throw new Error(`Failed to parse JSON request body: ${parseError.message}`);
    }
    
    console.log('[MediaLibrary MCP] Received request:', JSON.stringify(body, null, 2));
    
    const { action, agent_id, user_id, params } = body;

    // Validate required fields
    if (!action || !agent_id || !user_id || !params) {
      console.error('[MediaLibrary MCP] Missing fields:', { action, agent_id, user_id, params: !!params });
      throw new Error('Missing required fields: action, agent_id, user_id, params');
    }

    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client (user-scoped)
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { 
        global: { 
          headers: { Authorization: authHeader } 
        } 
      }
    );

    // Create service role client for vault operations
    const supabaseServiceRole = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        } 
      }
    );

    let result: MCPToolResponse;

    // Route to appropriate MCP tool handler
    switch (action) {
      // Document management actions
      case 'upload_document':
        result = await handleUploadDocument(supabase, agent_id, user_id, params);
        break;
        
      case 'process_document':
        result = await handleProcessDocument(supabase, supabaseServiceRole, agent_id, user_id, params);
        break;
        
      case 'assign_to_agent':
        result = await handleAssignToAgent(supabase, agent_id, user_id, params);
        break;
        
      // Document retrieval actions  
      case 'search_documents':
        result = await handleSearchDocuments(supabase, agent_id, user_id, params);
        break;
        
      case 'get_document_content':
        result = await handleGetDocumentContent(supabase, agent_id, user_id, params);
        break;
        
      case 'list_assigned_documents':
        result = await handleListAssignedDocuments(supabase, agent_id, user_id, params);
        break;
        
      case 'get_document_summary':
        result = await handleGetDocumentSummary(supabase, agent_id, user_id, params);
        break;
        
      case 'find_related_documents':
        result = await handleFindRelatedDocuments(supabase, agent_id, user_id, params);
        break;
        
      case 'reprocess_document':
        result = await handleReprocessDocument(supabase, agent_id, user_id, params, authHeader);
        break;
        
      case 'search_document_content':
        result = await handleSearchDocumentContent(supabase, agent_id, user_id, params);
        break;

      default:
        throw new Error(`Unknown MCP tool action: ${action}. Available actions: upload_document, process_document, assign_to_agent, search_documents, get_document_content, list_assigned_documents, get_document_summary, find_related_documents, reprocess_document, search_document_content`);
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[MediaLibrary MCP] Tool execution error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});