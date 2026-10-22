import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL!;
  const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, { 
    auth: { persistSession: false } 
  });

  console.log('Sending Test Data to GetZep\n');
  console.log('=' .repeat(50));

  // Get the account graph
  const { data: accountGraph } = await supabase
    .from('account_graphs')
    .select('id, user_id')
    .limit(1)
    .single();

  if (!accountGraph) {
    console.error('No account graph found');
    return;
  }

  // Clear any old test data from queue
  console.log('1. Clearing old queue items...');
  await supabase
    .from('graph_ingestion_queue')
    .delete()
    .in('status', ['error', 'completed'])
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  // Create new test episodes with meaningful content
  console.log('\n2. Creating new test episodes...');
  
  const testEpisodes = [
    {
      content: 'The user is building an AI agent platform called Agentopia using React, Supabase, and TypeScript.',
      timestamp: new Date().toISOString()
    },
    {
      content: 'Agentopia integrates with GetZep for knowledge graph storage and retrieval, providing long-term memory for AI agents.',
      timestamp: new Date().toISOString()
    },
    {
      content: 'The platform uses Supabase Edge Functions to process messages asynchronously through a queue-based architecture.',
      timestamp: new Date().toISOString()
    },
    {
      content: 'Each agent can have multiple datastores connected, including Pinecone for vector search and GetZep for knowledge graphs.',
      timestamp: new Date().toISOString()
    },
    {
      content: 'The user successfully fixed the vault encryption workaround to allow API keys to be stored and retrieved securely.',
      timestamp: new Date().toISOString()
    }
  ];

  const queueIds = [];
  for (const episode of testEpisodes) {
    const { data, error } = await supabase
      .from('graph_ingestion_queue')
      .insert({
        account_graph_id: accountGraph.id,
        payload: {
          content: episode.content,
          user_id: accountGraph.user_id,
          timestamp: episode.timestamp,
          source_kind: 'message',
          entities: [],
          relations: []
        },
        status: 'queued'
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to queue:', error);
    } else {
      queueIds.push(data.id);
      console.log(`✅ Queued: "${episode.content.substring(0, 60)}..."`);
    }
  }

  // Trigger the edge function
  console.log('\n3. Triggering graph-ingestion edge function...');
  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/graph-ingestion`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trigger: 'manual' }),
  });

  if (res.ok) {
    const result = await res.json();
    console.log(`✅ Edge function processed ${result.processed} items`);
  } else {
    console.error('❌ Edge function failed:', await res.text());
    return;
  }

  // Wait and check status
  console.log('\n4. Waiting for processing (5 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Check the status
  const { data: results } = await supabase
    .from('graph_ingestion_queue')
    .select('id, status, error_message')
    .in('id', queueIds);

  console.log('\n5. Results:');
  const completed = results?.filter(r => r.status === 'completed').length || 0;
  const errors = results?.filter(r => r.status === 'error') || [];
  
  console.log(`✅ Completed: ${completed}/${queueIds.length}`);
  
  if (errors.length > 0) {
    console.log(`❌ Errors: ${errors.length}`);
    errors.forEach(e => {
      console.log(`   - ${e.error_message}`);
    });
  }

  console.log('\n' + '=' .repeat(50));
  console.log('NEXT STEPS:');
  console.log('1. Go to your GetZep dashboard: https://app.getzep.com');
  console.log('2. Navigate to your project (ID: 877b341c-355d-41cf-91b7-fc558072bb1f)');
  console.log('3. Look for the "Graph" or "Episodes" section');
  console.log('4. You should see the new episodes being processed');
  console.log('\nNote: GetZep processes data asynchronously, so it may take');
  console.log('a few moments for the data to appear in the dashboard.');
}

main().catch(console.error);
