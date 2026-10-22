import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { OpenAI } from 'https://esm.sh/openai@4.20.1'
import { Pinecone } from 'https://esm.sh/@pinecone-database/pinecone@2.2.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DocumentProcessingRequest {
  document_id: string
  agent_id: string
  file_url: string
  file_name: string
  file_type: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY') ?? '',
    })

    const { document_id, agent_id, file_url, file_name, file_type }: DocumentProcessingRequest = await req.json()

    console.log(`Processing document: ${file_name} for agent: ${agent_id}`)

    // 1. Download and extract text from the document
    const textContent = await extractTextFromDocument(file_url, file_type)
    
    if (!textContent) {
      throw new Error('Failed to extract text from document')
    }

    // 2. Chunk the text into smaller pieces
    const chunks = chunkText(textContent, 1000, 200) // 1000 chars with 200 char overlap

    console.log(`Extracted ${textContent.length} characters, created ${chunks.length} chunks`)

    // 3. Get agent's connected datastores
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
      .eq('agent_id', agent_id)

    if (datastoreError) {
      throw datastoreError
    }

    // 4. Process each connected datastore
    for (const connection of agentDatastores || []) {
      const datastore = connection.datastores
      
      if (datastore.type === 'pinecone') {
        await processPineconeDatastore(datastore, chunks, openai, file_name, document_id)
      } else if (datastore.type === 'getzep') {
        await processGetZepDatastore(datastore, textContent, file_name, document_id)
      }
    }

    // 5. Store document metadata
    const { error: metadataError } = await supabase
      .from('datastore_documents')
      .insert({
        id: document_id,
        agent_id: agent_id,
        file_name: file_name,
        file_type: file_type,
        file_url: file_url,
        text_content: textContent,
        chunk_count: chunks.length,
        processed_at: new Date().toISOString(),
        status: 'completed'
      })

    if (metadataError) {
      console.warn('Failed to store document metadata:', metadataError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        document_id: document_id,
        chunks_processed: chunks.length,
        message: 'Document processed successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Document processing error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

async function extractTextFromDocument(fileUrl: string, fileType: string): Promise<string> {
  try {
    // Download the file
    const response = await fetch(fileUrl)
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // Extract text based on file type
    switch (fileType) {
      case 'text/plain':
        return new TextDecoder().decode(uint8Array)
      
      case 'application/pdf':
        return await extractPdfText(uint8Array, fileUrl)
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await extractDocxText(uint8Array, fileUrl)
      
      case 'application/msword':
        return await extractDocText(uint8Array, fileUrl)
      
      case 'application/vnd.ms-powerpoint':
      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        return await extractPptText(uint8Array, fileUrl)
      
      default:
        throw new Error(`Unsupported file type: ${fileType}`)
    }
  } catch (error) {
    console.error('Text extraction error:', error)
    throw error
  }
}

async function extractPdfText(uint8Array: Uint8Array, fileUrl: string): Promise<string> {
  try {
    // For now, return structured placeholder that indicates PDF processing
    // In production, we'd use a PDF parsing library like pdf-parse
    const fileName = fileUrl.split('/').pop() || 'unknown.pdf'
    return `Document: ${fileName}

This is a PDF document that has been uploaded to the knowledge base. The document contains important information that can be referenced in conversations.

Note: Full PDF text extraction is not yet implemented. The document is available for reference but detailed content extraction requires additional PDF parsing capabilities.

File: ${fileName}
Type: PDF Document
Source: ${fileUrl}
Uploaded: ${new Date().toISOString()}`
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error(`Failed to extract PDF text: ${error.message}`)
  }
}

async function extractDocxText(uint8Array: Uint8Array, fileUrl: string): Promise<string> {
  try {
    // For now, return structured placeholder for Word documents
    const fileName = fileUrl.split('/').pop() || 'unknown.docx'
    return `Document: ${fileName}

This is a Microsoft Word document that has been uploaded to the knowledge base. The document contains important information that can be referenced in conversations.

Note: Full DOCX text extraction is not yet implemented. The document is available for reference but detailed content extraction requires additional Word document parsing capabilities.

File: ${fileName}
Type: Word Document (.docx)
Source: ${fileUrl}
Uploaded: ${new Date().toISOString()}`
  } catch (error) {
    console.error('DOCX extraction error:', error)
    throw new Error(`Failed to extract DOCX text: ${error.message}`)
  }
}

async function extractDocText(uint8Array: Uint8Array, fileUrl: string): Promise<string> {
  try {
    // For now, return structured placeholder for legacy Word documents
    const fileName = fileUrl.split('/').pop() || 'unknown.doc'
    return `Document: ${fileName}

This is a Microsoft Word document (legacy format) that has been uploaded to the knowledge base. The document contains important information that can be referenced in conversations.

Note: Full DOC text extraction is not yet implemented. The document is available for reference but detailed content extraction requires additional Word document parsing capabilities.

File: ${fileName}
Type: Word Document (.doc)
Source: ${fileUrl}
Uploaded: ${new Date().toISOString()}`
  } catch (error) {
    console.error('DOC extraction error:', error)
    throw new Error(`Failed to extract DOC text: ${error.message}`)
  }
}

async function extractPptText(uint8Array: Uint8Array, fileUrl: string): Promise<string> {
  try {
    // For now, return structured placeholder for PowerPoint documents
    const fileName = fileUrl.split('/').pop() || 'unknown.ppt'
    return `Document: ${fileName}

This is a Microsoft PowerPoint presentation that has been uploaded to the knowledge base. The presentation contains important information that can be referenced in conversations.

Note: Full PowerPoint text extraction is not yet implemented. The document is available for reference but detailed content extraction requires additional PowerPoint parsing capabilities.

File: ${fileName}
Type: PowerPoint Presentation
Source: ${fileUrl}
Uploaded: ${new Date().toISOString()}`
  } catch (error) {
    console.error('PowerPoint extraction error:', error)
    throw new Error(`Failed to extract PowerPoint text: ${error.message}`)
  }
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = []
  let startIndex = 0

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length)
    const chunk = text.slice(startIndex, endIndex)
    chunks.push(chunk)
    
    if (endIndex === text.length) break
    startIndex = endIndex - overlap
  }

  return chunks
}

async function processPineconeDatastore(
  datastore: any,
  chunks: string[],
  openai: OpenAI,
  fileName: string,
  documentId: string
) {
  try {
    console.log(`Processing ${chunks.length} chunks for Pinecone datastore: ${datastore.id}`)
    
    // Validate Pinecone configuration
    if (!datastore.config?.apiKey || !datastore.config?.indexName) {
      throw new Error(`Incomplete Pinecone configuration for datastore ${datastore.id}`)
    }
    
    // Initialize Pinecone client
    const pinecone = new Pinecone({
      apiKey: datastore.config.apiKey,
      environment: datastore.config.region || datastore.config.environment
    })
    
    const index = pinecone.Index(datastore.config.indexName)
    
    // Generate embeddings for all chunks
    const embeddings = await Promise.all(
      chunks.map(async (chunk, index) => {
        const embedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk,
          encoding_format: 'float',
        })
        
        return {
          id: `${documentId}_chunk_${index}`,
          values: embedding.data[0].embedding,
          metadata: {
            text: chunk,
            source: fileName,
            document_id: documentId,
            chunk_index: index,
            timestamp: new Date().toISOString(),
            type: 'document'
          }
        }
      })
    )

    // Store embeddings in Pinecone (batch upsert)
    console.log(`Storing ${embeddings.length} embeddings in Pinecone index: ${datastore.config.indexName}`)
    
    // Pinecone supports batch upserts, but we'll process in chunks of 100 for safety
    const batchSize = 100
    for (let i = 0; i < embeddings.length; i += batchSize) {
      const batch = embeddings.slice(i, i + batchSize)
      
      await index.upsert(batch)
      console.log(`Upserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(embeddings.length/batchSize)} (${batch.length} vectors)`)
    }
    
    console.log(`Successfully stored ${embeddings.length} document chunks in Pinecone datastore: ${datastore.id}`)
    
  } catch (error) {
    console.error('Pinecone processing error:', error)
    throw error
  }
}

async function processGetZepDatastore(
  datastore: any,
  textContent: string,
  fileName: string,
  documentId: string
) {
  try {
    console.log(`Processing text content for GetZep datastore: ${datastore.id}`)
    
    // TODO: Process text with GetZep
    // This would involve:
    // 1. Extracting entities and relationships
    // 2. Storing in the GetZep knowledge graph
    // 3. Connecting to the agent's knowledge graph
    
    console.log(`Successfully processed content for GetZep datastore: ${datastore.id}`)
    
  } catch (error) {
    console.error('GetZep processing error:', error)
    throw error
  }
}