// ============================================================================
// Conversation Summarizer - Background Edge Function
// Purpose: Asynchronously summarize conversations and update summary boards
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { OpenAI } from 'https://esm.sh/openai@4.28.0';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface SummarizationRequest {
  conversation_id: string;
  agent_id: string;
  user_id: string;
  force_full_summary?: boolean;  // Force complete re-summarization
}

interface SummaryResult {
  summary: string;
  key_facts: string[];
  entities: {
    people: string[];
    places: string[];
    organizations: string[];
    dates: string[];
  };
  topics: string[];
  action_items: string[];
  pending_questions: string[];
}

interface ConversationMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

// ============================================================================
// Configuration
// ============================================================================

const SUMMARIZATION_CONFIG = {
  MAX_SUMMARY_TOKENS: 500,
  CHUNK_SIZE_MESSAGES: 10,
  MIN_MESSAGES_FOR_SUMMARY: 5,
  EMBEDDING_MODEL: 'text-embedding-3-small',
  CHAT_MODEL: 'gpt-4o',  // Use gpt-4o for JSON mode support
  TEMPERATURE: 0.3,  // Lower for more consistent summaries
};

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  const startTime = Date.now();

  try {
    // Initialize clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY') ?? '',
    });

    // Parse request
    const { conversation_id, agent_id, user_id, force_full_summary = false }: SummarizationRequest = await req.json();

    console.log(`[ConversationSummarizer] Starting summarization for conversation ${conversation_id}`);

    // Get existing summary board
    const { data: existingBoard } = await supabase
      .from('conversation_summary_boards')
      .select('*')
      .eq('conversation_id', conversation_id)
      .maybeSingle();

    // Get messages since last update
    const messagesSinceUpdate = existingBoard?.message_count ?? 0;

    // Fetch recent messages
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages_v2')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .range(messagesSinceUpdate, messagesSinceUpdate + 100);  // Fetch up to 100 new messages

    if (messagesError) {
      throw new Error(`Failed to fetch messages: ${messagesError.message}`);
    }

    if (!messages || messages.length < SUMMARIZATION_CONFIG.MIN_MESSAGES_FOR_SUMMARY) {
      return Response.json({
        success: true,
        message: 'Not enough new messages for summarization',
        messages_count: messages?.length ?? 0
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }
      });
    }

    // Generate summary
    const summaryResult = await generateSummary(
      messages as ConversationMessage[],
      existingBoard?.current_summary ?? '',
      openai,
      force_full_summary
    );

    // Generate embedding for summary
    const embeddingResponse = await openai.embeddings.create({
      model: SUMMARIZATION_CONFIG.EMBEDDING_MODEL,
      input: summaryResult.summary,
    });
    const embedding = embeddingResponse.data[0].embedding;

    // Update or create summary board
    const summaryBoardData = {
      conversation_id,
      agent_id,
      user_id,
      current_summary: summaryResult.summary,
      important_facts: summaryResult.key_facts,
      pending_questions: summaryResult.pending_questions,
      action_items: summaryResult.action_items,
      message_count: messagesSinceUpdate + messages.length,
      last_updated: new Date().toISOString(),
    };

    const { error: boardError } = await supabase
      .from('conversation_summary_boards')
      .upsert(summaryBoardData, { onConflict: 'conversation_id' });

    if (boardError) {
      console.error('[ConversationSummarizer] Error updating summary board:', boardError);
    }

    // Create conversation summary record
    const { data: conversationSummary, error: summaryError } = await supabase
      .from('conversation_summaries')
      .insert({
        conversation_id,
        agent_id,
        user_id,
        summary_text: summaryResult.summary,
        key_facts: summaryResult.key_facts,
        entities: summaryResult.entities,
        topics: summaryResult.topics,
        message_count: messagesSinceUpdate + messages.length,
        embedding,
        last_updated: new Date().toISOString(),
      })
      .select()
      .single();

    if (summaryError) {
      console.error('[ConversationSummarizer] Error creating summary:', summaryError);
    }

    // Create working memory chunks
    await createWorkingMemoryChunks(
      conversation_id,
      agent_id,
      user_id,
      messages as ConversationMessage[],
      openai,
      supabase
    );

    const duration = Date.now() - startTime;

    return Response.json({
      success: true,
      summary: summaryResult.summary,
      key_facts: summaryResult.key_facts,
      topics: summaryResult.topics,
      messages_processed: messages.length,
      execution_time_ms: duration,
      summary_id: conversationSummary?.id,
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });

  } catch (error) {
    console.error('[ConversationSummarizer] Error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
      execution_time_ms: Date.now() - startTime,
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }
});

// ============================================================================
// Core Summarization Logic
// ============================================================================

async function generateSummary(
  messages: ConversationMessage[],
  existingSummary: string,
  openai: OpenAI,
  forceFullSummary: boolean
): Promise<SummaryResult> {
  const messagesToSummarize = messages.map(m => {
    const content = typeof m.content === 'string' ? m.content : (m.content as any)?.text ?? '';
    return `[${m.role}]: ${content}`;
  }).join('\n');

  const prompt = existingSummary && !forceFullSummary
    ? buildIncrementalSummaryPrompt(existingSummary, messagesToSummarize)
    : buildFullSummaryPrompt(messagesToSummarize);

  const completion = await openai.chat.completions.create({
    model: SUMMARIZATION_CONFIG.CHAT_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a conversation summarization specialist. Your task is to create clear, concise summaries and extract key information from conversations.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: SUMMARIZATION_CONFIG.TEMPERATURE,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  });

  const result = JSON.parse(completion.choices[0].message.content || '{}');

  return {
    summary: result.summary || '',
    key_facts: result.key_facts || [],
    entities: result.entities || { people: [], places: [], organizations: [], dates: [] },
    topics: result.topics || [],
    action_items: result.action_items || [],
    pending_questions: result.pending_questions || [],
  };
}

function buildIncrementalSummaryPrompt(existingSummary: string, newMessages: string): string {
  return `You are updating an ongoing conversation summary for an AI agent's working memory.

PREVIOUS SUMMARY:
${existingSummary}

NEW MESSAGES:
${newMessages}

INSTRUCTIONS:
1. UPDATE the summary to incorporate new information while maintaining structure:
   - A SHORT PARAGRAPH (2-3 sentences) providing high-level context
   - BULLET POINTS highlighting:
     * What happened (key events and actions)
     * Important decisions or outcomes
     * Critical context for awareness
     * Relevant background information
2. PRESERVE important context from the previous summary
3. CONSOLIDATE redundant information
4. MAINTAIN chronological flow
5. Extract new key facts, entities, topics, action items, and questions

OUTPUT (JSON format):
{
  "summary": "A short paragraph (2-3 sentences) providing high-level context, followed by bullet points:\n• What happened: [key events]\n• Important events: [critical moments]\n• Context: [relevant background]\n• Decisions: [outcomes]",
  "key_facts": ["fact1", "fact2", "..."],
  "entities": {
    "people": ["name1", "name2"],
    "places": ["place1"],
    "organizations": ["org1"],
    "dates": ["date1"]
  },
  "topics": ["topic1", "topic2"],
  "action_items": ["item1", "item2"],
  "pending_questions": ["question1"]
}`;
}

function buildFullSummaryPrompt(messages: string): string {
  return `You are creating a summary of a conversation for an AI agent's working memory.

CONVERSATION:
${messages}

INSTRUCTIONS:
1. CREATE a structured summary with:
   - A SHORT PARAGRAPH (2-3 sentences) providing high-level context
   - BULLET POINTS highlighting:
     * What happened (key events and actions)
     * Important decisions or outcomes
     * Critical context for awareness
     * Relevant background information
2. EXTRACT key facts, entities, and topics
3. IDENTIFY action items and pending questions
4. MAINTAIN chronological flow
5. Keep summary concise but informative (max 500 tokens)

OUTPUT (JSON format):
{
  "summary": "A short paragraph (2-3 sentences) providing high-level context, followed by bullet points:\n• What happened: [key events]\n• Important events: [critical moments]\n• Context: [relevant background]\n• Decisions: [outcomes]",
  "key_facts": ["fact1", "fact2", "..."],
  "entities": {
    "people": ["name1", "name2"],
    "places": ["place1"],
    "organizations": ["org1"],
    "dates": ["date1"]
  },
  "topics": ["topic1", "topic2"],
  "action_items": ["item1", "item2"],
  "pending_questions": ["question1"]
}`;
}

// ============================================================================
// Working Memory Chunks
// ============================================================================

async function createWorkingMemoryChunks(
  conversation_id: string,
  agent_id: string,
  user_id: string,
  messages: ConversationMessage[],
  openai: OpenAI,
  supabase: any
): Promise<void> {
  // Chunk messages into semantic groups
  const chunks = chunkMessages(messages, 5);  // 5 messages per chunk

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkText = chunk.map(m => {
      const content = typeof m.content === 'string' ? m.content : (m.content as any)?.text ?? '';
      return `[${m.role}]: ${content}`;
    }).join('\n');

    // Generate embedding
    const embeddingResponse = await openai.embeddings.create({
      model: SUMMARIZATION_CONFIG.EMBEDDING_MODEL,
      input: chunkText,
    });
    const embedding = embeddingResponse.data[0].embedding;

    // Calculate importance score (simple heuristic)
    const importanceScore = calculateImportanceScore(chunk);

    // Determine chunk type
    const chunkType = determineChunkType(chunk);

    // Insert working memory chunk
    await supabase
      .from('working_memory_chunks')
      .insert({
        conversation_id,
        agent_id,
        user_id,
        chunk_text: chunkText,
        chunk_index: i,
        message_ids: chunk.map(m => m.id),
        importance_score: importanceScore,
        chunk_type: chunkType,
        embedding,
      });
  }

  console.log(`[ConversationSummarizer] Created ${chunks.length} working memory chunks`);
}

function chunkMessages(messages: ConversationMessage[], chunkSize: number): ConversationMessage[][] {
  const chunks: ConversationMessage[][] = [];
  for (let i = 0; i < messages.length; i += chunkSize) {
    chunks.push(messages.slice(i, i + chunkSize));
  }
  return chunks;
}

function calculateImportanceScore(messages: ConversationMessage[]): number {
  // Simple heuristic: longer messages, questions, and tool uses are more important
  let score = 0.5;  // Base score

  for (const msg of messages) {
    const content = typeof msg.content === 'string' ? msg.content : (msg.content as any)?.text ?? '';

    // Boost for questions
    if (content.includes('?')) {
      score += 0.1;
    }

    // Boost for longer content (more substantial)
    if (content.length > 200) {
      score += 0.1;
    }

    // Boost for tool/function mentions
    if (content.includes('tool') || content.includes('function')) {
      score += 0.1;
    }
  }

  return Math.min(score, 1.0);  // Cap at 1.0
}

function determineChunkType(messages: ConversationMessage[]): string {
  // Analyze messages to determine chunk type
  const contents = messages.map(m => 
    typeof m.content === 'string' ? m.content : (m.content as any)?.text ?? ''
  ).join(' ').toLowerCase();

  if (contents.includes('?')) return 'question';
  if (contents.includes('action') || contents.includes('task')) return 'action';
  if (contents.includes('fact') || contents.includes('is ')) return 'fact';
  
  return 'dialogue';
}

