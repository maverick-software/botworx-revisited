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

async function refreshGmailToken() {
  console.log('Gmail Token Refresh Script\n');
  console.log('This will refresh your expired Gmail OAuth token.');
  console.log('=============================================\n');

  try {
    // Get the user ID
    const userId = '3f966af2-72a1-41bc-8fac-400b8002664b'; // Your user ID from the logs
    
    // Get the Gmail connection with provider info
    const { data: connections, error: connError } = await supabase
      .from('user_oauth_connections')
      .select(`
        *,
        service_providers!inner(name)
      `)
      .eq('user_id', userId)
      .single();

    if (connError || !connections) {
      console.error('Error fetching Gmail connection:', connError);
      return;
    }

    console.log('Current token expires at:', connections.token_expires_at);
    console.log('Current time:', new Date().toISOString());
    
    const tokenExpiresAt = new Date(connections.token_expires_at);
    const now = new Date();
    
    if (tokenExpiresAt > now) {
      console.log('\n✅ Token is still valid!');
      return;
    }
    
    console.log('\n❌ Token is expired. Refreshing...');

    // Force a token refresh by calling the gmail-api with a simple operation
    const { data, error } = await supabase.functions.invoke('gmail-api', {
      body: {
        agent_id: '4850a064-3005-41a8-adf2-90053c877b2d', // Your Gmail agent ID
        action: 'read_emails',
        parameters: { max_results: 1 }
      },
      headers: {
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (error) {
      console.error('\n❌ Error during refresh:', error);
      return;
    }

    console.log('\n✅ Token refresh triggered!');
    
    // Check the updated token
    const { data: updated, error: updateError } = await supabase
      .from('user_oauth_connections')
      .select('token_expires_at')
      .eq('user_id', userId)
      .eq('service_providers!inner(name)', 'gmail')
      .single();

    if (!updateError && updated) {
      console.log('New token expires at:', updated.token_expires_at);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

refreshGmailToken(); 