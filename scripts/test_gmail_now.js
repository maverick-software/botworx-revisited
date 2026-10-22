import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function testGmailWorking() {
  console.log('Testing Gmail connection...\n');
  
  // Get the connection with tokens
  const { data: connection, error: connError } = await supabase
    .from('user_oauth_connections')
    .select('id, vault_access_token_id, vault_refresh_token_id, external_username')
    .eq('connection_status', 'active')
    .single();
    
  if (connError) {
    console.error('Error fetching connection:', connError);
    return;
  }
  
  console.log('Connection ID:', connection.id);
  console.log('Email:', connection.external_username);
  console.log('\nToken check:');
  
  // Check if tokens look like OAuth tokens now
  const accessTokenPreview = connection.vault_access_token_id 
    ? connection.vault_access_token_id.substring(0, 20) + '...'
    : 'null';
  const refreshTokenPreview = connection.vault_refresh_token_id
    ? connection.vault_refresh_token_id.substring(0, 20) + '...'
    : 'null';
    
  console.log('Access token:', accessTokenPreview);
  console.log('Refresh token:', refreshTokenPreview);
  
  // Check if they're OAuth tokens
  const isOAuthAccessToken = connection.vault_access_token_id && 
    connection.vault_access_token_id.startsWith('ya29.');
  const isOAuthRefreshToken = connection.vault_refresh_token_id && 
    connection.vault_refresh_token_id.startsWith('1//');
    
  console.log('\nToken format:');
  console.log('Access token is OAuth token:', isOAuthAccessToken);
  console.log('Refresh token is OAuth token:', isOAuthRefreshToken);
  
  if (isOAuthAccessToken) {
    console.log('\n✅ Gmail tokens are now stored correctly!');
    console.log('Your Gmail agent should work properly now.');
  } else {
    console.log('\n❌ Tokens are still in the wrong format.');
    console.log('Please refresh your Gmail connection again.');
  }
  
  process.exit(0);
}

testGmailWorking().catch(console.error); 