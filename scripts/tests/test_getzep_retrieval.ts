import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function testGetZepRetrieval() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('🔍 Testing GetZep Retrieval\n');
  console.log('=' .repeat(50));

  // Get the user ID
  const userId = '3f966af2-72a1-41bc-8fac-400b8002664b';

  // Get GetZep connection
  const { data: provider } = await supabase
    .from('service_providers')
    .select('id')
    .eq('name', 'getzep')
    .single();

  const { data: connection } = await supabase
    .from('user_oauth_connections')
    .select('vault_access_token_id')
    .eq('oauth_provider_id', provider.id)
    .eq('user_id', userId)
    .single();

  if (!connection) {
    console.log('❌ No GetZep connection found');
    return;
  }

  // Try to decrypt the API key
  const { data: apiKey, error: decryptError } = await supabase.rpc('vault_decrypt', {
    vault_id: connection.vault_access_token_id
  });

  console.log('API Key decrypt:', apiKey ? '✅ Success' : '❌ Failed');
  if (decryptError) {
    console.log('Decrypt error:', decryptError.message);
  }

  // Try importing and using the GetZep SDK directly
  try {
    const { ZepClient } = await import('@getzep/zep-cloud');
    
    if (apiKey) {
      const client = new ZepClient({ apiKey });
      
      // Try to search for memories
      console.log('\nAttempting to search GetZep memories...');
      try {
        const searchResults = await client.memory.searchMemory(
          userId,
          {
            text: 'Agentopia GetZep integration',
            limit: 5,
            searchType: 'similarity'
          }
        );
        
        console.log('Search results:', searchResults);
      } catch (searchErr: any) {
        console.log('Search error:', searchErr?.message || searchErr);
        
        // Try getting recent memories as fallback
        try {
          const memories = await client.memory.getMemory(userId, { limit: 5 });
          console.log('Recent memories:', memories);
        } catch (memErr) {
          console.log('Memory retrieval error:', memErr);
        }
      }
    }
  } catch (importErr) {
    console.log('Failed to import GetZep SDK:', importErr);
  }

  console.log('\n' + '=' .repeat(50));
  console.log('Done testing retrieval');
}

testGetZepRetrieval().catch(console.error);
