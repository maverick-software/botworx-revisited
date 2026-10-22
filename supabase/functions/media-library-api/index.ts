/**
 * Media Library API Edge Function
 * 
 * Handles document upload, processing, management, and MCP tool operations
 * for the centralized Media Library system
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * OCR functionality removed - use alternative OCR providers (Azure, Mistral, etc.) if needed
 */

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface MediaUploadRequest {
  action: 'upload' | 'process' | 'search' | 'get_content' | 'list_documents' | 'assign_to_agent' | 'get_categories' | 'get_signed_url' | 'delete';
  file_name?: string;
  file_type?: string;
  file_size?: number;
  category?: string;
  description?: string;
  tags?: string[];
  
  // For MCP tool operations
  agent_id?: string;
  document_id?: string;
  query?: string;
  search_type?: 'semantic' | 'keyword' | 'exact';
  assignment_type?: 'training_data' | 'reference' | 'sop' | 'knowledge_base';
  include_metadata?: boolean;
  limit?: number;
  
  // For assignment operations
  include_in_vector_search?: boolean;
  include_in_knowledge_graph?: boolean;
  priority_level?: number;

  // For signed URL generation
  storage_path?: string;
  expiry_seconds?: number;
}

interface MediaLibraryResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    total_count?: number;
    processing_time_ms?: number;
    action_performed?: string;
  };
}

// =============================================
// Text Processing Utilities
// =============================================

/**
 * Extract text with forced OCR processing - bypasses normal text extraction and goes directly to OCR
 */
async function extractTextWithForcedOCR(supabase: any, storagePath: string, fileType: string, userId?: string): Promise<string> {
  try {
    console.log(`[MediaLibrary] Force OCR: Downloading file from storage: ${storagePath}`);
    
    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('media_uploads')
      .download(storagePath);
    
    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || 'Unknown error'}`);
    }
    
    const arrayBuffer = await fileData.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);
    
    console.log(`[MediaLibrary] Force OCR: Downloaded ${fileBuffer.length} bytes, file type: ${fileType}`);
    
    // Force OCR processing based on file type
    if (fileType.includes('pdf') || fileType === 'application/pdf') {
      console.log(`[MediaLibrary] Force OCR: Processing PDF with OCR`);
      return await performOCRExtraction(fileBuffer, userId);
    } else if (fileType.startsWith('image/')) {
      console.log(`[MediaLibrary] Force OCR: Processing image with OCR`);
      return await extractTextFromImage(fileBuffer, fileType, userId);
    } else {
      throw new Error(`Force OCR not supported for file type: ${fileType}`);
    }
    
  } catch (error: any) {
    console.error(`[MediaLibrary] Force OCR extraction failed:`, error);
    throw new Error(`Force OCR failed: ${error.message}`);
  }
}

// =============================================
// Parser Service Integration
// =============================================

async function callParserService(serviceName: string, fileData: Uint8Array, fileName: string, options: any = {}): Promise<string> {
  try {
    console.log(`[MediaLibrary] Calling ${serviceName} service for ${fileName}`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl) {
      throw new Error(`Supabase URL not available for ${serviceName} service`);
    }
    
    // Convert file data to base64 for transmission
    const base64Data = btoa(String.fromCharCode(...fileData));
    
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
        console.log(`[MediaLibrary] ${serviceName} extracted ${result.text.length} characters`);
        if (result.metadata) {
          console.log(`[MediaLibrary] ${serviceName} metadata:`, result.metadata);
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
    console.error(`[MediaLibrary] ${serviceName} service error:`, error);
    throw error;
  }
}

/**
 * Extract text content from various document types using dedicated parser services
 */
async function extractTextFromDocument(supabase: any, storagePath: string, fileType: string, userId?: string): Promise<string> {
  try {
    console.log(`[MediaLibrary] Extracting text from ${fileType}: ${storagePath}`);
    
    // Download the file from Supabase Storage using the client (handles auth)
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('media-library')
      .download(storagePath);
    
    if (downloadError) {
      throw new Error(`Failed to download file from storage: ${downloadError.message}`);
    }
    
    if (!fileData) {
      throw new Error('No file data received from storage');
    }
    
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const fileName = storagePath.split('/').pop() || 'document';
    const fileExt = fileName.toLowerCase().split('.').pop() || '';
    
    // Route to appropriate parser service based on file type
    if (fileType === 'application/pdf' || fileExt === 'pdf') {
      return await callParserService('pdf-parser', uint8Array, fileName, {
        includeMetadata: true
      });
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileExt === 'docx') {
      return await callParserService('word-parser', uint8Array, fileName, {
        usePremiumAPI: true
      });
    } else if (fileType === 'application/msword' || fileExt === 'doc') {
      return await callParserService('word-parser', uint8Array, fileName, {
        usePremiumAPI: true
      });
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || fileExt === 'xlsx') {
      return await callParserService('excel-parser', uint8Array, fileName, {
        usePremiumAPI: true,
        includeHeaders: true,
        maxRows: 1000
      });
    } else if (fileType === 'application/vnd.ms-excel' || fileExt === 'xls') {
      return await callParserService('excel-parser', uint8Array, fileName, {
        usePremiumAPI: true,
        includeHeaders: true,
        maxRows: 1000
      });
    } else if (fileType === 'text/csv' || fileExt === 'csv') {
      return await callParserService('excel-parser', uint8Array, fileName, {
        includeHeaders: true,
        maxRows: 1000
      });
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || fileExt === 'pptx') {
      return await callParserService('powerpoint-parser', uint8Array, fileName, {
        usePremiumAPI: true,
        includeSlideNumbers: true,
        extractNotes: true
      });
    } else if (fileType === 'application/vnd.ms-powerpoint' || fileExt === 'ppt') {
      return await callParserService('powerpoint-parser', uint8Array, fileName, {
        usePremiumAPI: true,
        includeSlideNumbers: true,
        extractNotes: true
      });
    } else if (fileType.startsWith('text/') || fileExt === 'txt') {
      return await callParserService('text-parser', uint8Array, fileName, {
        preserveFormatting: false
      });
    } else if (fileType.startsWith('image/')) {
      // Fall back to existing image OCR for now
      return await extractTextFromImage(uint8Array, fileType, userId);
    } else {
      throw new Error(`Unsupported file type: ${fileType} (${fileExt}). Supported formats: PDF, DOC/DOCX, XLS/XLSX/CSV, PPT/PPTX, TXT, Images`);
    }
  } catch (error: any) {
    console.error(`[MediaLibrary] Text extraction error:`, error);
    
    // If parser service fails, try fallback to original methods for critical formats
    try {
      console.log(`[MediaLibrary] Parser service failed, trying fallback extraction for ${fileType}`);
      
      const arrayBuffer = await (await supabase.storage.from('media-library').download(storagePath)).data?.arrayBuffer();
      if (!arrayBuffer) throw new Error('No file data for fallback');
      
      const uint8Array = new Uint8Array(arrayBuffer);
      const fileExt = storagePath.toLowerCase().split('.').pop() || '';
      
      if (fileType === 'application/pdf' || fileExt === 'pdf') {
        return await extractTextFromPDF(uint8Array, userId);
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileExt === 'docx') {
        return await extractTextFromDOCX(uint8Array);
      } else if (fileType.startsWith('text/') || fileExt === 'txt') {
        return new TextDecoder('utf-8').decode(uint8Array);
      }
    } catch (fallbackError) {
      console.error(`[MediaLibrary] Fallback extraction also failed:`, fallbackError);
    }
    
    throw error;
  }
}

/**
 * Extract text from DOCX files
 */
async function extractTextFromDOCX(docxData: Uint8Array): Promise<string> {
  try {
    console.log(`[MediaLibrary] Processing DOCX file (${docxData.length} bytes)`);
    
    // DOCX files are ZIP archives containing XML files
    // The main document content is in word/document.xml
    
    // Convert to string to search for ZIP patterns and XML content
    const textDecoder = new TextDecoder('latin1'); // Use latin1 to preserve binary data
    const docxText = textDecoder.decode(docxData);
    
    // Method 1: Look for word/document.xml content within the ZIP
    // DOCX files contain the actual text in word/document.xml within <w:t> tags
    let extractedText = '';
    
    // Search for XML content patterns that indicate document text
    const xmlPatterns = [
      /<w:t[^>]*>([^<]+)<\/w:t>/g,           // Standard text elements
      /<w:t>([^<]+)<\/w:t>/g,                // Simple text elements
      /<t[^>]*>([^<]+)<\/t>/g,               // Alternative text tags
    ];
    
    for (const pattern of xmlPatterns) {
      const matches = docxText.match(pattern);
      if (matches && matches.length > 0) {
        const textContent = matches
          .map(match => {
            // Extract text between tags, handling various formats
            return match.replace(/<[^>]*>/g, '').trim();
          })
          .filter(text => text.length > 0 && text !== ' ')
          .join(' ');
        
        if (textContent.length > extractedText.length) {
          extractedText = textContent;
        }
      }
    }
    
    if (extractedText.length > 0) {
      // Clean up the extracted text
      extractedText = extractedText
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      console.log(`[MediaLibrary] Successfully extracted ${extractedText.length} characters from DOCX`);
      return extractedText;
    }
    
    // Method 2: Fallback - search for readable text patterns
    console.log(`[MediaLibrary] XML extraction failed, trying fallback method for DOCX`);
    
    // Look for sequences of readable text
    const readableChunks = [];
    const lines = docxText.split(/[\r\n]+/);
    
    for (const line of lines) {
      // Look for lines with substantial readable content
      const cleanLine = line
        .replace(/[^\x20-\x7E]/g, ' ') // Replace non-printable chars
        .replace(/\s+/g, ' ')
        .trim();
      
      // If line has reasonable length and word-like patterns, include it
      if (cleanLine.length > 10 && /[a-zA-Z].*[a-zA-Z]/.test(cleanLine)) {
        readableChunks.push(cleanLine);
      }
    }
    
    if (readableChunks.length > 0) {
      const fallbackText = readableChunks.join(' ').substring(0, 1000);
      console.log(`[MediaLibrary] Extracted ${fallbackText.length} characters from DOCX (fallback method)`);
      return fallbackText;
    }
    
    // Method 3: Return informative message if no text found
    console.log(`[MediaLibrary] No extractable text found in DOCX file`);
    return 'This DOCX document was processed but contains no extractable text. It may be encrypted, corrupted, contain only images, or use unsupported formatting.';
    
  } catch (error: any) {
    console.error('[MediaLibrary] DOCX text extraction error:', error);
    return `DOCX processing completed but text extraction failed: ${error.message}. The document structure may be complex or corrupted.`;
  }
}

/**
 * Extract text from image files using OCR
 */
async function extractTextFromImage(imageData: Uint8Array, fileType: string, userId?: string): Promise<string> {
  try {
    console.log(`[MediaLibrary] Starting OCR processing for ${fileType} image (${imageData.length} bytes)`);
    
    // Try web OCR first
    const ocrResult = await performWebOCROnImage(imageData, fileType, userId);
    if (ocrResult && ocrResult.length > 10) {
      console.log(`[MediaLibrary] OCR extraction successful: ${ocrResult.length} characters`);
      return ocrResult;
    }
    
    // If OCR fails or returns minimal content, provide informative message
    return `[${fileType} image: ${imageData.length} bytes - OCR processing attempted. ${ocrResult ? `Extracted ${ocrResult.length} characters: "${ocrResult.substring(0, 100)}..."` : 'No text detected or OCR service unavailable.'}]`;
    
  } catch (error: any) {
    console.error(`[MediaLibrary] Image text extraction error:`, error);
    return `[${fileType} image: ${imageData.length} bytes - OCR processing failed: ${error.message}]`;
  }
}

/**
 * Use web OCR service for image files
 */
async function performWebOCROnImage(imageData: Uint8Array, fileType: string, userId?: string): Promise<string | null> {
  // OCR.Space integration removed - use alternative OCR providers (Azure Document Intelligence, Mistral OCR, etc.)
  console.log('[MediaLibrary] OCR disabled - configure alternative OCR provider if needed');
  return null;
}

/**
 * Perform OCR extraction on PDF data
 * Converts PDF to images and uses OCR to extract text from image-based PDFs
 */
async function performOCRExtraction(pdfData: Uint8Array, userId?: string): Promise<string> {
  try {
    // For image-based PDFs, we need to:
    // 1. Convert PDF pages to images
    // 2. Perform OCR on each image
    // 3. Combine the text results
    
    console.log(`[MediaLibrary] Starting OCR processing for ${pdfData.length} byte PDF`);
    
    // Option 1: Use a free OCR API service
    const ocrResult = await performWebOCR(pdfData, userId);
    if (ocrResult) {
      return ocrResult;
    }
    
    // Option 2: Basic image text detection (fallback)
    const basicResult = await performBasicImageTextExtraction(pdfData);
    if (basicResult) {
      return basicResult;
    }
    
    throw new Error('No OCR methods available');
    
  } catch (error: any) {
    console.error(`[MediaLibrary] OCR extraction failed:`, error);
    throw error;
  }
}

/**
 * Use a web-based OCR service to extract text from PDF
 * OCR.Space integration removed - use alternative OCR providers
 */
async function performWebOCR(pdfData: Uint8Array, userId?: string): Promise<string | null> {
  console.log('[MediaLibrary] OCR disabled - configure alternative OCR provider (Azure Document Intelligence, Mistral OCR, etc.)');
  return null;
}

/**
 * Basic image text extraction as fallback
 * Looks for embedded images in PDF and attempts basic text recognition
 */
async function performBasicImageTextExtraction(pdfData: Uint8Array): Promise<string | null> {
  try {
    // This is a very basic approach - look for text patterns that might indicate
    // the PDF contains readable text even if it's image-based
    const pdfString = new TextDecoder('latin1').decode(pdfData);
    
    // Look for font references and text positioning that might indicate text content
    const fontRegex = /\/Font\s+<<[^>]*>>/g;
    const fontMatches = pdfString.match(fontRegex) || [];
    
    if (fontMatches.length > 0) {
      console.log(`[MediaLibrary] Found ${fontMatches.length} font references, PDF likely contains extractable text`);
      
      // Try to find any readable text sequences near font definitions
      let extractedText = '';
      
      // Look for text that appears after font definitions
      for (const fontMatch of fontMatches) {
        const fontIndex = pdfString.indexOf(fontMatch);
        const textAfterFont = pdfString.substring(fontIndex, fontIndex + 1000);
        
        // Extract any readable sequences
        const readableRegex = /[A-Za-z][A-Za-z0-9\s.,!?;:\-()'"]{10,}/g;
        const readableMatches = textAfterFont.match(readableRegex) || [];
        
        for (const readable of readableMatches) {
          if (!readable.includes('/') && !readable.includes('<<') && !readable.includes('>>')) {
            extractedText += readable + ' ';
          }
        }
      }
      
      if (extractedText.trim().length > 20) {
        return extractedText.trim();
      }
    }
    
    return null;
    
  } catch (error: any) {
    console.error('[MediaLibrary] Basic image text extraction failed:', error);
    return null;
  }
}

/**
 * Extract text from PDF using a simple PDF parser
 * Note: This is a basic implementation. For production, consider using pdf-parse or similar
 */
async function extractTextFromPDF(pdfData: Uint8Array, userId?: string): Promise<string> {
  try {
    // Enhanced PDF text extraction with multiple strategies
    const pdfString = new TextDecoder('latin1').decode(pdfData);
    let extractedText = '';
    
    // Strategy 1: Extract text between BT/ET pairs (text objects in PDF)
    const textRegex = /BT\s*.*?ET/gs;
    const matches = pdfString.match(textRegex) || [];
    
    for (const match of matches) {
      // Extract text from Tj operations
      const tjRegex = /\((.*?)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(match)) !== null) {
        extractedText += tjMatch[1] + ' ';
      }
      
      // Extract text from TJ operations (array format)
      const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
      let tjArrayMatch;
      while ((tjArrayMatch = tjArrayRegex.exec(match)) !== null) {
        // Parse the array content
        const arrayContent = tjArrayMatch[1];
        const stringRegex = /\((.*?)\)/g;
        let stringMatch;
        while ((stringMatch = stringRegex.exec(arrayContent)) !== null) {
          extractedText += stringMatch[1] + ' ';
        }
      }
    }
    
    // Strategy 2: Extract text from stream objects (for compressed/encoded content)
    if (extractedText.length < 50) {
      const streamRegex = /stream\s*(.*?)\s*endstream/gs;
      const streamMatches = pdfString.match(streamRegex) || [];
      
      for (const streamMatch of streamMatches) {
        // Look for readable text patterns in streams
        const readableTextRegex = /[A-Za-z0-9\s.,!?;:\-()]{10,}/g;
        const readableMatches = streamMatch.match(readableTextRegex) || [];
        
        for (const readable of readableMatches) {
          // Filter out obvious binary data
          if (readable.length > 10 && readable.match(/[a-zA-Z]/g)?.length > readable.length * 0.3) {
            extractedText += readable + ' ';
          }
        }
      }
    }
    
    // Strategy 3: Look for plain text content (uncompressed)
    if (extractedText.length < 50) {
      // Find sequences of readable text that might be content
      const plainTextRegex = /[A-Za-z][A-Za-z0-9\s.,!?;:\-()'"]{20,}/g;
      const plainMatches = pdfString.match(plainTextRegex) || [];
      
      for (const plainMatch of plainMatches) {
        // Filter out PDF commands and metadata
        if (!plainMatch.includes('obj') && 
            !plainMatch.includes('endobj') && 
            !plainMatch.includes('stream') &&
            !plainMatch.includes('/Type') &&
            !plainMatch.includes('/Filter') &&
            plainMatch.match(/[a-zA-Z]/g)?.length > plainMatch.length * 0.5) {
          extractedText += plainMatch + '\n';
        }
      }
    }
    
    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r') 
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\')
      .replace(/\\\)/g, ')')
      .replace(/\\\(/g, '(')
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // If we still don't have enough text, try to extract any readable content
    if (extractedText.length < 50) {
      console.log(`[MediaLibrary] Basic extraction yielded ${extractedText.length} chars, trying fallback extraction`);
      
      // Last resort: extract any sequences that look like words
      const wordRegex = /[A-Za-z]{3,}(?:\s+[A-Za-z]{3,}){2,}/g;
      const wordMatches = pdfString.match(wordRegex) || [];
      
      const fallbackText = wordMatches
        .filter(match => match.length > 10)
        .slice(0, 20) // Limit to first 20 matches to avoid too much noise
        .join(' ');
      
      if (fallbackText.length > extractedText.length) {
        extractedText = fallbackText;
      }
    }
    
    // Final check - if we still have very little text, try OCR processing
    if (extractedText.length < 20) {
      console.log(`[MediaLibrary] Text extraction yielded minimal content (${extractedText.length} chars), attempting OCR processing`);
      
      try {
        const ocrText = await performOCRExtraction(pdfData, userId);
        if (ocrText && ocrText.length > extractedText.length) {
          console.log(`[MediaLibrary] OCR extraction successful: ${ocrText.length} characters`);
          return ocrText;
        }
      } catch (ocrError) {
        console.log(`[MediaLibrary] OCR processing failed:`, ocrError);
      }
      
      return `[PDF document: ${pdfData.length} bytes - This appears to be an image-based PDF. OCR processing attempted but may require specialized processing. Extracted ${extractedText.length} characters via text extraction.]`;
    }
    
    console.log(`[MediaLibrary] Successfully extracted ${extractedText.length} characters from PDF`);
    return extractedText;
  } catch (error: any) {
    console.error(`[MediaLibrary] PDF text extraction error:`, error);
    return `[PDF document: ${pdfData.length} bytes - text extraction failed: ${error.message}]`;
  }
}

/**
 * Split text into chunks for better search and RAG performance
 */
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + chunkSize;
    
    // If we're not at the end of the text, try to break at a sentence or word boundary
    if (end < text.length) {
      // Look for sentence endings first
      const sentenceEnd = text.lastIndexOf('.', end);
      const questionEnd = text.lastIndexOf('?', end);
      const exclamationEnd = text.lastIndexOf('!', end);
      
      const sentenceBoundary = Math.max(sentenceEnd, questionEnd, exclamationEnd);
      
      if (sentenceBoundary > start + chunkSize * 0.5) {
        // If we found a sentence boundary in the second half of the chunk, use it
        end = sentenceBoundary + 1;
      } else {
        // Otherwise, look for word boundaries
        const wordBoundary = text.lastIndexOf(' ', end);
        if (wordBoundary > start + chunkSize * 0.5) {
          end = wordBoundary;
        }
      }
    }
    
    const chunk = text.substring(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    
    // Move start position with overlap
    start = Math.max(start + 1, end - overlap);
  }
  
  return chunks;
}

// =============================================
// Handler Functions
// =============================================

async function handleUpload(
  supabase: any,
  userId: string,
  request: MediaUploadRequest
): Promise<MediaLibraryResponse> {
  try {
    const { file_name, file_type, file_size, category = 'general', description, tags = [] } = request;
    
    if (!file_name || !file_type || !file_size) {
      throw new Error('Missing required fields: file_name, file_type, file_size');
    }
    
    // Generate storage path: user_id/category/timestamp_filename
    const timestamp = Date.now();
    // Better filename sanitization: preserve extension, handle spaces properly
    const fileExtension = file_name.split('.').pop() || '';
    const baseName = file_name.replace(/\.[^/.]+$/, ''); // Remove extension
    const sanitizedBaseName = baseName
      .replace(/\s+/g, '_')           // Replace multiple spaces with single underscore
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid chars with underscore
      .replace(/_+/g, '_')            // Replace multiple underscores with single
      .replace(/^_|_$/g, '');         // Remove leading/trailing underscores
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
    
    // Return storage path for client to upload directly
    // Client will use supabase.storage.from('media-library').upload()
    return {
      success: true,
      data: {
        media_id: mediaEntry.id,
        storage_path: storagePath,
        bucket: 'media-library'
      },
      metadata: {
        action_performed: 'upload_prepared'
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary] Upload error:', {
      error: error.message,
      stack: error.stack,
      fileName: request.file_name,
      fileSize: request.file_size,
      fileType: request.file_type
    });
    return {
      success: false,
      error: error.message || 'Upload failed'
    };
  }
}

async function handleProcess(
  supabase: any,
  userId: string,
  request: MediaUploadRequest
): Promise<MediaLibraryResponse> {
  try {
    const { document_id, force_reprocess = false, force_ocr = false } = request;
    
    if (!document_id) {
      throw new Error('Missing required field: document_id');
    }
    
    // Get media file details
    const { data: mediaFile, error: fetchError } = await supabase
      .from('media_library')
      .select('*')
      .eq('id', document_id)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !mediaFile) {
      throw new Error('Media file not found or access denied');
    }
    
    // Update status to processing
    await supabase
      .from('media_library')
      .update({ processing_status: 'processing' })
      .eq('id', document_id);
    
    console.log(`[MediaLibrary] Starting text extraction for document ${document_id}: ${mediaFile.file_name}`);
    
    // Extract text content from the document
    let textContent = '';
    let chunkCount = 0;
    
    try {
      if (force_ocr) {
        console.log(`[MediaLibrary] Force OCR requested for document ${document_id}`);
        textContent = await extractTextWithForcedOCR(supabase, mediaFile.storage_path, mediaFile.file_type, userId);
      } else {
        textContent = await extractTextFromDocument(supabase, mediaFile.storage_path, mediaFile.file_type, userId);
      }
      
      if (textContent && textContent.trim().length > 0) {
        // Create chunks for better search and RAG performance
        const chunks = chunkText(textContent, 1000, 200); // 1000 chars with 200 char overlap
        chunkCount = chunks.length;
        
        console.log(`[MediaLibrary] Extracted ${textContent.length} characters, created ${chunkCount} chunks`);
      } else {
        console.log(`[MediaLibrary] No text content extracted from ${mediaFile.file_name}`);
      }
    } catch (extractError: any) {
      console.error(`[MediaLibrary] Text extraction failed for ${document_id}:`, extractError);
      // Continue with processing but mark that extraction failed
      textContent = '';
      chunkCount = 0;
    }
    
    // Update document with extracted content
    await supabase
      .from('media_library')
      .update({ 
        processing_status: 'completed',
        text_content: textContent || null,
        chunk_count: chunkCount,
        processed_at: new Date().toISOString()
      })
      .eq('id', document_id);
    
    const processingMethod = force_ocr ? 'OCR processing' : 'standard text extraction';
    
    // Log successful extraction for debugging
    console.log(`[MediaLibrary] Successfully processed document ${document_id}. Ready to hand off ${textContent.length} characters to MCP.`);
    
    return {
      success: true,
      data: {
        media_id: document_id,
        file_name: mediaFile.file_name,
        processing_status: 'completed',
        text_content: textContent, // Include actual content for direct handoff
        text_content_length: textContent.length,
        chunk_count: chunkCount,
        processing_method: processingMethod,
        message: chunkCount > 0 
          ? `Document processed successfully using ${processingMethod}. Extracted ${textContent.length} characters into ${chunkCount} chunks. Content ready for MCP handoff.`
          : `Document processed using ${processingMethod}. No text content could be extracted from this file type.`
      },
      metadata: {
        action_performed: 'document_processed',
        force_ocr_used: force_ocr,
        handoff_ready: true,
        document_id: document_id
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary] Process error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleSearchDocuments(
  supabase: any,
  userId: string,
  request: MediaUploadRequest
): Promise<MediaLibraryResponse> {
  try {
    const { 
      agent_id, 
      query, 
      search_type = 'semantic', 
      category, 
      assignment_type, 
      limit = 10 
    } = request;
    
    if (!agent_id || !query) {
      throw new Error('Missing required fields: agent_id, query');
    }
    
    // Use the database function for search
    const { data: searchResults, error: searchError } = await supabase
      .rpc('search_agent_documents', {
        p_agent_id: agent_id,
        p_user_id: userId,
        p_query: query,
        p_search_type: search_type,
        p_category: category,
        p_assignment_type: assignment_type,
        p_limit: limit
      });
    
    if (searchError) throw searchError;
    
    return {
      success: true,
      data: {
        results: searchResults || [],
        query_info: {
          query,
          search_type,
          category,
          assignment_type,
          limit
        }
      },
      metadata: {
        total_count: searchResults?.length || 0,
        action_performed: 'document_search'
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary] Search error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleGetDocumentContent(
  supabase: any,
  userId: string,
  request: MediaUploadRequest
): Promise<MediaLibraryResponse> {
  try {
    const { agent_id, document_id, include_metadata = true } = request;
    
    if (!agent_id || !document_id) {
      throw new Error('Missing required fields: agent_id, document_id');
    }
    
    // Use the database function to get content
    const { data: documentContent, error: contentError } = await supabase
      .rpc('get_agent_document_content', {
        p_agent_id: agent_id,
        p_user_id: userId,
        p_document_id: document_id,
        p_include_metadata: include_metadata
      });
    
    if (contentError) throw contentError;
    
    return {
      success: true,
      data: documentContent,
      metadata: {
        action_performed: 'document_content_retrieved'
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary] Get content error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleListDocuments(
  supabase: any,
  userId: string,
  request: MediaUploadRequest
): Promise<MediaLibraryResponse> {
  try {
    const { 
      agent_id, 
      category, 
      assignment_type, 
      include_archived = false,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = request;
    
    if (agent_id) {
      // List documents assigned to specific agent
      const { data: agentDocuments, error: agentError } = await supabase
        .rpc('list_agent_assigned_documents', {
          p_agent_id: agent_id,
          p_user_id: userId,
          p_category: category,
          p_assignment_type: assignment_type,
          p_include_archived: include_archived,
          p_sort_by: sort_by || 'created_at',
          p_sort_order: sort_order || 'desc'
        });
      
      if (agentError) throw agentError;
      
      return {
        success: true,
        data: agentDocuments,
        metadata: {
          action_performed: 'agent_documents_listed'
        }
      };
    } else {
      // List all user's media library files
      let query = supabase
        .from('media_library')
        .select(`
          id,
          file_name,
          display_name,
          file_type,
          file_size,
          category,
          tags,
          description,
          processing_status,
          assigned_agents_count,
          created_at,
          updated_at,
          file_url,
          chunk_count
        `)
        .eq('user_id', userId);
      
      // Apply filters
      if (!include_archived) {
        query = query.eq('is_archived', false);
      }
      if (category) {
        query = query.eq('category', category);
      }
      
      // Apply sorting
      const sortField = sort_by === 'file_name' ? 'file_name' : 
                       sort_by === 'file_size' ? 'file_size' :
                       sort_by === 'updated_at' ? 'updated_at' : 'created_at';
      
      query = query.order(sortField, { ascending: sort_order === 'asc' });
      
      const { data: userMedia, error: userError } = await query;
      
      if (userError) throw userError;
      
      return {
        success: true,
        data: {
          total_count: userMedia?.length || 0,
          documents: userMedia || []
        },
        metadata: {
          action_performed: 'user_media_listed'
        }
      };
    }
    
  } catch (error: any) {
    console.error('[MediaLibrary] List documents error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleAssignToAgent(
  supabase: any,
  userId: string,
  request: MediaUploadRequest
): Promise<MediaLibraryResponse> {
  try {
    const { 
      agent_id, 
      document_id, 
      assignment_type = 'training_data',
      include_in_vector_search = true,
      include_in_knowledge_graph = true,
      priority_level = 1
    } = request;
    
    if (!agent_id || !document_id) {
      throw new Error('Missing required fields: agent_id, document_id');
    }
    
    // Use the database function to assign media to agent
    const { data: assignmentId, error: assignError } = await supabase
      .rpc('assign_media_to_agent', {
        p_agent_id: agent_id,
        p_media_id: document_id,
        p_user_id: userId,
        p_assignment_type: assignment_type,
        p_include_vector: include_in_vector_search,
        p_include_graph: include_in_knowledge_graph
      });
    
    if (assignError) throw assignError;
    
    // If agent has existing datastores, trigger processing
    const { data: agentDatastores, error: datastoreError } = await supabase
      .from('agent_datastores')
      .select(`
        datastore_id,
        datastores:datastore_id (
          id,
          type,
          config
        )
      `)
      .eq('agent_id', agent_id);
    
    if (!datastoreError && agentDatastores?.length > 0) {
      // Trigger document processing for agent's datastores
      const { data: mediaFile } = await supabase
        .from('media_library')
        .select('file_url, file_name, file_type')
        .eq('id', document_id)
        .single();
      
      if (mediaFile?.file_url) {
        // Process document for agent's datastores
        await supabase.functions.invoke('process-datastore-document', {
          body: {
            document_id: document_id,
            agent_id: agent_id,
            file_url: mediaFile.file_url,
            file_name: mediaFile.file_name,
            file_type: mediaFile.file_type
          }
        });
      }
    }
    
    return {
      success: true,
      data: {
        assignment_id: assignmentId,
        agent_id,
        document_id,
        assignment_type,
        processing_triggered: agentDatastores?.length > 0
      },
      metadata: {
        action_performed: 'media_assigned_to_agent'
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary] Assign to agent error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleGetSignedUrl(
  supabase: any,
  userId: string,
  request: MediaUploadRequest
): Promise<MediaLibraryResponse> {
  try {
    const { document_id, storage_path, expiry_seconds = 3600 } = request;
    
    if (!document_id && !storage_path) {
      throw new Error('Either document_id or storage_path is required');
    }

    let finalStoragePath = storage_path;
    
    // If document_id provided, get storage path from database
    if (document_id) {
      const { data: mediaFile, error: fetchError } = await supabase
        .from('media_library')
        .select('storage_path')
        .eq('id', document_id)
        .eq('user_id', userId)
        .single();
      
      if (fetchError || !mediaFile) {
        throw new Error('Media file not found or access denied');
      }
      
      finalStoragePath = mediaFile.storage_path;
    }

    // Generate signed URL using service role (bypasses RLS)
    // Create a service role client specifically for storage operations
    const serviceRoleClient = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    const { data: signedUrlData, error: signedUrlError } = await serviceRoleClient.storage
      .from('media-library')
      .createSignedUrl(finalStoragePath, expiry_seconds);
    
    if (signedUrlError) {
      console.error('Signed URL generation error:', signedUrlError);
      throw signedUrlError;
    }
    
    return {
      success: true,
      data: {
        signed_url: signedUrlData.signedUrl,
        expires_in: expiry_seconds,
        storage_path: finalStoragePath
      },
      metadata: {
        action_performed: 'signed_url_generated'
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary] Get signed URL error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleGetCategories(
  supabase: any,
  userId: string
): Promise<MediaLibraryResponse> {
  try {
    // Ensure default categories exist
    await supabase.rpc('create_default_media_categories', {
      p_user_id: userId
    });
    
    // Get all categories for user
    const { data: categories, error: categoriesError } = await supabase
      .from('media_categories')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order');
    
    if (categoriesError) throw categoriesError;
    
    // Get media stats
    const { data: stats, error: statsError } = await supabase
      .rpc('get_user_media_stats', {
        p_user_id: userId
      });
    
    if (statsError) console.warn('Stats error:', statsError);
    
    return {
      success: true,
      data: {
        categories: categories || [],
        statistics: stats || {}
      },
      metadata: {
        action_performed: 'categories_retrieved'
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary] Get categories error:', error);
    return {
      success: false,
      error: error.message
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
    const body: MediaUploadRequest = await req.json();
    console.log('[MediaLibrary] Received request:', JSON.stringify(body, null, 2));
    
    const { action } = body;

    // Validate required fields
    if (!action) {
      throw new Error('Missing required field: action');
    }

    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client with user auth
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { 
        global: { 
          headers: { Authorization: authHeader } 
        } 
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Invalid or expired token');
    }

    let result: MediaLibraryResponse;

    // Route to appropriate handler
    switch (action) {
      case 'upload':
        result = await handleUpload(supabase, user.id, body);
        break;
        
      case 'process':
        result = await handleProcess(supabase, user.id, body);
        break;
        
      case 'search':
        result = await handleSearchDocuments(supabase, user.id, body);
        break;
        
      case 'get_content':
        result = await handleGetDocumentContent(supabase, user.id, body);
        break;
        
      case 'list_documents':
        result = await handleListDocuments(supabase, user.id, body);
        break;
        
      case 'assign_to_agent':
        result = await handleAssignToAgent(supabase, user.id, body);
        break;
        
      case 'get_categories':
        result = await handleGetCategories(supabase, user.id);
        break;
        
      case 'get_signed_url':
        result = await handleGetSignedUrl(supabase, user.id, body);
        break;
        
      case 'delete':
        result = await handleDeleteDocument(supabase, user.id, body);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[MediaLibrary] API error:', error);
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

async function handleDeleteDocument(
  supabase: any,
  userId: string,
  request: MediaUploadRequest
): Promise<MediaLibraryResponse> {
  try {
    const { document_id } = request;
    
    if (!document_id) {
      throw new Error('document_id is required for deletion');
    }

    // First, get the document details to get the storage path
    const { data: mediaFile, error: fetchError } = await supabase
      .from('media_library')
      .select('storage_path, file_name')
      .eq('id', document_id)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !mediaFile) {
      throw new Error('Media file not found or access denied');
    }

    // Delete from storage bucket
    const { error: storageError } = await supabase.storage
      .from('media-library')
      .remove([mediaFile.storage_path]);
    
    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue with database deletion even if storage fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('media_library')
      .delete()
      .eq('id', document_id)
      .eq('user_id', userId);
    
    if (dbError) {
      throw new Error(`Failed to delete document from database: ${dbError.message}`);
    }

    return {
      success: true,
      data: {
        document_id,
        deleted_file: mediaFile.file_name,
        storage_path: mediaFile.storage_path
      },
      metadata: {
        action_performed: 'document_deleted'
      }
    };
  } catch (error: any) {
    console.error('[MediaLibrary] Delete document error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
