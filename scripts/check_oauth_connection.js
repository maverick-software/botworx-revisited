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

async function checkOAuthConnection() {
  console.log('Checking OAuth Connection Structure\n');
  console.log('===================================\n');

  try {
    const userId = '3f966af2-72a1-41bc-8fac-400b8002664b';
    
    const { data: connection, error } = await supabase
      .from('user_oauth_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching connection:', error);
      return;
    }

    console.log('Connection details:');
    Object.entries(connection).forEach(([key, value]) => {
      console.log(`- ${key}:`, value);
    });

    // Check if vault IDs exist
    console.log('\n\nVault token check:');
    console.log('- Has vault_access_token_id:', !!connection.vault_access_token_id);
    console.log('- Has vault_refresh_token_id:', !!connection.vault_refresh_token_id);
    
    // Test the RPC function used by gmail-api
    console.log('\n\nTesting get_user_gmail_connection RPC:');
    const { data: gmailConn, error: gmailError } = await supabase.rpc(
      'get_user_gmail_connection',
      { p_user_id: userId }
    );
    
    if (gmailError) {
      console.error('Error calling get_user_gmail_connection:', gmailError);
    } else {
      console.log('RPC returned:', gmailConn);
      if (gmailConn && gmailConn[0]) {
        console.log('\nFirst connection from RPC:');
        Object.entries(gmailConn[0]).forEach(([key, value]) => {
          console.log(`- ${key}:`, value);
        });
      }
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkOAuthConnection(); 