import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function fixTokenStorage() {
  console.log('Fixing token storage...\n');
  
  // Get the connection
  const { data: connection, error: connError } = await supabase
    .from('user_oauth_connections')
    .select('*')
    .eq('connection_status', 'active')
    .eq('external_username', 'charles.r.sears@gmail.com')
    .single();
    
  if (connError) {
    console.error('Error fetching connection:', connError);
    return;
  }
  
  console.log('Found connection:', connection.id);
  console.log('Current vault_access_token_id:', connection.vault_access_token_id);
  console.log('Current vault_refresh_token_id:', connection.vault_refresh_token_id);
  
  // Since we can't decrypt the vault IDs and the user just refreshed their token,
  // we need to ask them to refresh again but this time store the tokens directly
  console.log('\nThe tokens are stored as vault IDs but the vault entries are invalid.');
  console.log('You need to refresh your Gmail connection from the Credentials page.');
  console.log('The OAuth flow should now store tokens directly instead of using vault.');
  
  // For now, let's check the gmail-oauth function to see how it stores tokens
  console.log('\n\nTo fix this immediately, you need to:');
  console.log('1. Go to the Credentials page');
  console.log('2. Click "Refresh Token" for your Gmail connection');
  console.log('3. This will get new tokens and store them properly');
  
  process.exit(0);
}

fixTokenStorage().catch(console.error); 