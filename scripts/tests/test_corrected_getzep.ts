import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function testCorrectedGetZep() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://txhscptzjrrudnqwavcb.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!serviceRoleKey) {
    console.error('❌ Service role key not found');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { 
    auth: { persistSession: false } 
  });

  console.log('🧪 TESTING CORRECTED GETZEP INTEGRATION');
  console.log('=' .repeat(60));
  
  const agentId = '87e6e948-694d-4f8c-8e94-2b4f6281ffc3'; // Angela
  const userId = '3f966af2-72a1-41bc-8fac-400b8002664b';
  
  console.log('1️⃣ Testing GetZep SDK import...');
  try {
    const mod = await import('https://esm.sh/@getzep/zep-cloud@latest');
    const ZepClient = (mod as any)?.ZepClient || (mod as any)?.default;
    
    if (ZepClient) {
      console.log('   ✅ GetZep SDK imported successfully');
      
      // Test with the working API key
      const GETZEP_API_KEY = (process.env.GETZEP_API_KEY ?? (() => { throw new Error('Set GETZEP_API_KEY before running this manual check.'); })());
      
      const client = new ZepClient({ 
        apiKey: GETZEP_API_KEY
      });
      
      console.log('   ✅ ZepClient initialized');
      
      console.log('\n2️⃣ Testing thread.addMessages...');
      const threadId = `agent_${agentId}_user_${userId}`;
      const testMessages = [
        { name: "User", role: "user", content: "Hello, I'm testing the GetZep integration." },
        { name: "Assistant", role: "assistant", content: "Great! I can help you test the GetZep knowledge graph integration." }
      ];
      
      try {
        const episodeUuids = await client.thread.addMessages(threadId, { messages: testMessages });
        console.log('   ✅ Messages added successfully:', episodeUuids);
        
        console.log('\n3️⃣ Testing thread.getUserContext...');
        // Wait a moment for processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const memory = await client.thread.getUserContext(threadId);
        if (memory?.context) {
          console.log('   ✅ Context retrieved successfully');
          console.log('   Context length:', memory.context.length);
          console.log('   Context preview:', memory.context.substring(0, 200) + '...');
        } else {
          console.log('   ⚠️  No context returned (may need more time to process)');
        }
        
      } catch (apiError: any) {
        console.error('   ❌ API call failed:', apiError.message);
        if (apiError.statusCode) {
          console.log('      Status:', apiError.statusCode);
        }
      }
      
    } else {
      console.error('   ❌ Failed to import ZepClient');
    }
  } catch (importError) {
    console.error('   ❌ SDK import failed:', importError);
  }

  console.log('\n4️⃣ Testing GetZepSemanticManager...');
  
  // Import the manager (simulate Edge Function environment)
  try {
    // We can't directly import the manager here, but we can test the credential flow
    const { data: connection } = await supabase
      .from('user_oauth_connections')
      .select('vault_access_token_id, connection_metadata')
      .eq('user_id', userId)
      .eq('connection_status', 'active')
      .single();
      
    if (connection) {
      const { data: apiKey } = await supabase.rpc('vault_decrypt', {
        vault_id: connection.vault_access_token_id
      });
      
      if (apiKey) {
        console.log('   ✅ Credential retrieval works for Edge Function');
        console.log('   - API key retrieved successfully');
        console.log('   - Connection metadata:', connection.connection_metadata);
      } else {
        console.log('   ❌ Failed to decrypt API key');
      }
    } else {
      console.log('   ❌ No active GetZep connection found');
    }
  } catch (error) {
    console.error('   ❌ Manager test failed:', error);
  }

  console.log('\n5️⃣ Testing chat integration readiness...');
  
  // Check agent configuration
  const { data: agent } = await supabase
    .from('agents')
    .select('id, name, metadata')
    .eq('id', agentId)
    .single();
    
  if (agent) {
    const graphEnabled = agent.metadata?.settings?.use_account_graph === true;
    console.log(`   Agent: ${agent.name}`);
    console.log(`   Knowledge Graph Enabled: ${graphEnabled ? '✅' : '❌'}`);
    
    if (!graphEnabled) {
      console.log('   ⚠️  Enable knowledge graph in agent settings to test chat integration');
    }
  }
  
  // Check account graph
  const { data: accountGraph } = await supabase
    .from('account_graphs')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  if (accountGraph) {
    console.log('   ✅ Account graph configured');
    console.log('   - Graph ID:', accountGraph.id);
    console.log('   - Connection ID:', accountGraph.connection_id);
  } else {
    console.log('   ❌ No account graph found');
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📊 INTEGRATION STATUS SUMMARY:');
  console.log('');
  console.log('✅ Fixed Issues:');
  console.log('  - Updated to use correct GetZep v3 SDK methods');
  console.log('  - Using thread.addMessages() for ingestion');
  console.log('  - Using thread.getUserContext() for retrieval');
  console.log('  - Removed non-existent REST API fallbacks');
  console.log('  - Updated credential storage with working API key');
  console.log('');
  console.log('🎯 Ready for Chat Testing:');
  console.log('  - Send a message to Angela in the UI');
  console.log('  - Check Edge Function logs for GetZep ingestion');
  console.log('  - Verify context retrieval in subsequent messages');
}

testCorrectedGetZep().catch(console.error);
