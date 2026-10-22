import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import OpenAI from 'npm:openai@6.1.0';
import { Pinecone } from 'npm:@pinecone-database/pinecone@2.0.0';

interface VectorSearchResult {
  id: string;
  score: number;
  metadata: {
    text: string;
    source?: string;
    timestamp?: string;
  };
}

/**
 * Performs vector search using Pinecone to find relevant memories/context
 * @param message - The user's message to search for similar content
 * @param agentId - The ID of the agent to search datastores for
 * @param supabaseClient - Supabase client instance
 * @param openai - OpenAI client instance
 * @returns Formatted context string or null if no relevant results
 */
export async function getVectorSearchResults(
  message: string, 
  agentId: string,
  supabaseClient: SupabaseClient,
  openai: OpenAI
): Promise<string | null> {
  // GUARD CLAUSE: Quick check for Pinecone datastore connection FIRST
  try {
    const { data: connection, error: connectionError } = await supabaseClient
      .from('agent_datastores')
      .select(`
        datastore_id,
        datastores:datastore_id (
          id,
          type,
          config,
          similarity_metric,
          similarity_threshold,
          max_results
        )
      `)
      .eq('agent_id', agentId)
      .eq('datastores.type', 'pinecone')
      .maybeSingle();

    // EARLY EXIT #1: Connection error or no connection
    if (connectionError || !connection || !connection?.datastores) {
      console.log(`[VectorSearch] No Pinecone datastore connected for agent ${agentId} - skipping vector search`);
      return null;
    }

    const datastore = connection.datastores;
    
    // EARLY EXIT #2: Incomplete configuration
    if (!datastore.config?.apiKey || !datastore.config?.indexName) {
      console.log(`[VectorSearch] Incomplete Pinecone config for agent ${agentId} - skipping vector search`);
      return null;
    }
    
    console.log(`[VectorSearch] ✅ Starting vector search for agent ${agentId}`);

    // Generate embedding (prefer router embedding model if enabled)
    let embeddingValues: number[] = [];
    const useRouter = (Deno.env.get('USE_LLM_ROUTER') || '').toLowerCase() === 'true';
    if (useRouter) {
      try {
        const routerModulePath = '../shared/llm/router.ts';
        const { LLMRouter } = await import(routerModulePath);
        const router = new LLMRouter();
        const vectors = await router.embed(agentId, [message]);
        embeddingValues = vectors[0] || [];
      } catch (_e) {
        // Fallback to OpenAI embeddings if router module not present
        const embedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: message,
          encoding_format: 'float',
        });
        embeddingValues = embedding.data[0].embedding as any;
      }
    } else {
      const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: message,
        encoding_format: 'float',
      });
      embeddingValues = embedding.data[0].embedding as any;
    }

    // Instantiate Pinecone client (v2 expects only apiKey)
    const pinecone = new Pinecone({ apiKey: datastore.config.apiKey });

    // Use index host when provided by UI; otherwise default resolution
    const indexName = datastore.config.indexName;
    const indexHost: string | undefined = datastore.config.host;
    const index = indexHost ? pinecone.Index(indexName, indexHost) : pinecone.Index(indexName);

    // Query vector store
    console.log(`[DEBUG] Querying Pinecone index ${indexName} with topK=${datastore.max_results}, threshold=${datastore.similarity_threshold}`);
    
    const results = await index.query({
      vector: embeddingValues,
      topK: datastore.max_results || 10,
      includeMetadata: true,
      includeValues: false,
    });

    console.log(`[DEBUG] Pinecone returned ${results.matches?.length || 0} matches`);
    
    if (results.matches?.length) {
      console.log(`[DEBUG] Top match scores:`, results.matches.slice(0, 3).map(m => ({
        id: m.id,
        score: m.score,
        source: m.metadata?.source
      })));
    }

    if (!results.matches?.length) {
      console.log(`[DEBUG] No matches found in Pinecone index ${indexName}`);
      return null;
    }

    // Filter and format results
    const relevantResults = results.matches
      .filter(match => {
        const isRelevant = match.score >= (datastore.similarity_threshold || 0.7);
        if (!isRelevant) {
          console.log(`[DEBUG] Filtered out match with score ${match.score} (below threshold ${datastore.similarity_threshold || 0.7})`);
        }
        return isRelevant;
      })
      .map((match) => {
        const metadata = match.metadata as VectorSearchResult['metadata'];
        return {
          text: metadata.text,
          score: match.score,
          source: metadata.source,
          timestamp: metadata.timestamp,
        };
      });

    console.log(`[DEBUG] After filtering: ${relevantResults.length} relevant results found`);

    if (!relevantResults.length) {
      console.log(`[DEBUG] No relevant results after filtering. Original matches: ${results.matches?.length}, threshold: ${datastore.similarity_threshold || 0.7}`);
      const allowFallback = (datastore.config?.lowConfidenceFallback ?? true) as boolean;
      if (!allowFallback) {
        return null;
      }
      // Fallback: provide top 1-3 low-confidence matches so the Process UI shows something useful
      const fallback = (results.matches || []).slice(0, Math.max(1, Math.min(3, datastore.max_results || 3))).map((m) => ({
        text: (m.metadata as any)?.text || '',
        score: m.score || 0,
        source: (m.metadata as any)?.source,
        timestamp: (m.metadata as any)?.timestamp,
      }));
      if (fallback.length === 0) return null;
      const memories = fallback
        .map(result => {
          const previewLen = (datastore.config?.previewLength ?? 400) as number;
          const text = result.text?.slice(0, previewLen);
          let memory = `Memory (similarity: ${(result.score * 100).toFixed(1)}% - low confidence):\n${text}`;
          if (result.source) memory += `\nSource: ${result.source}`;
          if (result.timestamp) memory += `\nTimestamp: ${result.timestamp}`;
          return memory;
        })
        .join('\n\n');
      return `Here are some possibly relevant memories (low confidence):\n\n${memories}`;
    }

    // Format context message
    console.log(`[DEBUG] Returning ${relevantResults.length} memories to chat context`);
    const memories = relevantResults
      .map(result => {
        const previewLen = (datastore.config?.previewLength ?? 400) as number;
        const text = result.text?.slice(0, previewLen);
        let memory = `Memory (similarity: ${(result.score * 100).toFixed(1)}%):\n${text}`;
        if (result.source) {
          memory += `\nSource: ${result.source}`;
        }
        if (result.timestamp) {
          memory += `\nTimestamp: ${result.timestamp}`;
        }
        return memory;
      })
      .join('\n\n');

    return `Here are some relevant memories that might help with your response:\n\n${memories}\n\nPlease consider these memories when formulating your response, but maintain a natural conversation flow.`;
  } catch (error) {
    console.error('Vector search error:', {
      error,
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    return null;
  }
} 