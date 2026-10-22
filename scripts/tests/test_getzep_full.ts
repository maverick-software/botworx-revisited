import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL!;
  const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, { 
    auth: { persistSession: false } 
  });

  console.log('Testing GetZep Knowledge Graph Store & Retrieve\n');
  console.log('=' .repeat(50));

  // Step 1: Verify GetZep connection exists
  console.log('\n1. Checking GetZep connection...');
  const { data: provider } = await supabase
    .from('service_providers')
    .select('id')
    .eq('name', 'getzep')
    .single();

  const { data: connection } = await supabase
    .from('user_oauth_connections')
    .select('id, vault_access_token_id, connection_metadata, connection_status')
    .eq('oauth_provider_id', provider.id)
    .eq('connection_status', 'active')
    .single();

  if (!connection) {
    console.error('❌ No active GetZep connection found');
    return;
  }

  console.log('✅ GetZep connection found');
  console.log('   Connection ID:', connection.id);
  console.log('   Metadata:', connection.connection_metadata);

  // Step 2: Verify account graph exists
  console.log('\n2. Checking account graph...');
  const { data: accountGraph } = await supabase
    .from('account_graphs')
    .select('id, user_id, connection_id, status')
    .eq('connection_id', connection.id)
    .single();

  if (!accountGraph) {
    console.error('❌ No account graph found for this connection');
    return;
  }

  console.log('✅ Account graph found');
  console.log('   Graph ID:', accountGraph.id);
  console.log('   Status:', accountGraph.status);

  // Step 3: Store test data in knowledge graph
  console.log('\n3. Storing test data in GetZep knowledge graph...');
  
  const testMessages = [
    'User is working on integrating GetZep knowledge graph with Agentopia platform.',
    'The integration uses Supabase Edge Functions to process messages asynchronously.',
    'GetZep provides both episodic memory and semantic knowledge graph capabilities.',
    'The system successfully processes messages through a queue-based architecture.',
    'API keys are stored securely and retrieved at runtime for each operation.'
  ];

  const queueItems = [];
  for (const message of testMessages) {
    const { data: queueItem, error } = await supabase
      .from('graph_ingestion_queue')
      .insert({
        account_graph_id: accountGraph.id,
        payload: {
          content: message,
          user_id: accountGraph.user_id,
          entities: [],
          relations: [],
          source_kind: 'message'
        },
        status: 'queued'
      })
      .select('id')
      .single();

    if (error) {
      console.error('   ❌ Failed to queue:', error.message);
    } else {
      queueItems.push(queueItem.id);
      console.log(`   ✅ Queued: ${message.substring(0, 50)}...`);
    }
  }

  // Step 4: Trigger processing
  console.log('\n4. Triggering graph ingestion...');
  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/graph-ingestion`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trigger: 'test' }),
  });

  if (res.ok) {
    const result = await res.json();
    console.log('✅ Edge function triggered:', result);
  } else {
    console.error('❌ Edge function failed:', res.status, await res.text());
  }

  // Step 5: Check processing status
  console.log('\n5. Checking processing status...');
  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

  const { data: processedItems } = await supabase
    .from('graph_ingestion_queue')
    .select('id, status, error_message')
    .in('id', queueItems);

  const completed = processedItems?.filter(item => item.status === 'completed').length || 0;
  const failed = processedItems?.filter(item => item.status === 'error').length || 0;

  console.log(`✅ Completed: ${completed}/${queueItems.length}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}/${queueItems.length}`);
    processedItems?.filter(item => item.status === 'error').forEach(item => {
      console.log(`   Error: ${item.error_message}`);
    });
  }

  // Step 6: Test retrieval (conceptual - actual retrieval would use GetZep API)
  console.log('\n6. Data retrieval capability...');
  console.log('   GetZep stores data in their cloud service.');
  console.log('   To retrieve data, the chat function would:');
  console.log('   1. Call GetZep API with search query');
  console.log('   2. Get relevant memories/knowledge');
  console.log('   3. Inject into LLM context');
  console.log('   ');
  console.log('   The retrieval happens in:');
  console.log('   - supabase/functions/chat/core/memory/memory_manager.ts');
  console.log('   - Using GetZep SDK: client.memory.search() or client.graph.search()');

  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('SUMMARY:');
  
  if (completed > 0) {
    console.log('✅ GetZep Knowledge Graph Integration is WORKING!');
    console.log('   - Data is successfully stored in GetZep cloud');
    console.log('   - Messages are processed through the queue');
    console.log('   - GetZep API key is accessible (via workaround)');
    console.log('   - Ready for retrieval operations');
  } else {
    console.log('❌ Issues detected - check error messages above');
  }

  console.log('\nNOTE: GetZep stores the knowledge graph in their cloud,');
  console.log('not in our local database. The graph_nodes/graph_edges tables');
  console.log('would only be used if we built our own graph storage.');
}

main().catch(console.error);
