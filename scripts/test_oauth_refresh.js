import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testOAuthRefresh() {
  console.log('Testing OAuth Refresh Function\n');
  console.log('==============================\n');

  try {
    // Get the user's Gmail connection
    const userId = '3f966af2-72a1-41bc-8fac-400b8002664b';
    
    const { data: connections, error: connError } = await supabase
      .from('user_oauth_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (connError || !connections) {
      console.error('Error fetching connection:', connError);
      return;
    }

    console.log('Found connection:');
    console.log('- ID:', connections.id);
    console.log('- Current token expires:', connections.token_expires_at);
    console.log('- Status:', connections.connection_status);
    console.log('');

    console.log('Calling oauth-refresh function...');
    
    const { data, error } = await supabase.functions.invoke('oauth-refresh', {
      body: {
        connection_id: connections.id
      },
      headers: {
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (error) {
      console.error('\n❌ OAuth refresh error:', error);
      
      // Try to get error details from response
      if (error.context && error.context.body) {
        try {
          const errorBody = await error.context.json();
          console.error('Error details:', errorBody);
        } catch (e) {
          console.error('Could not parse error body');
        }
      }
      return;
    }

    console.log('\n✅ OAuth refresh response:', data);
    
    // Check the updated connection
    const { data: updated, error: updateError } = await supabase
      .from('user_oauth_connections')
      .select('token_expires_at')
      .eq('id', connections.id)
      .single();

    if (!updateError && updated) {
      console.log('\nUpdated token expires at:', updated.token_expires_at);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testOAuthRefresh(); 