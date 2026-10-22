import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkGmailConfiguration() {
  console.log('Checking Gmail configurations...\n');
  
  // First check if the table exists and what columns it has
  const { data: tableInfo, error: tableError } = await supabase
    .from('gmail_configurations')
    .select('*')
    .limit(1);
    
  if (tableError) {
    console.error('Error accessing gmail_configurations:', tableError);
  } else {
    console.log('Table is accessible');
  }
  
  // Get the active Gmail connection
  const { data: connection, error: connError } = await supabase
    .from('user_oauth_connections')
    .select('id, external_username')
    .eq('connection_status', 'active')
    .single();
    
  if (connection) {
    console.log('\nActive connection ID:', connection.id);
    console.log('External username:', connection.external_username);
    
    // Check if there's already a configuration
    const { data: existingConfig, error: configError } = await supabase
      .from('gmail_configurations')
      .select('*')
      .eq('user_oauth_connection_id', connection.id);
      
    if (configError) {
      console.error('\nError checking existing config:', configError);
    } else {
      console.log('\nExisting configurations:', existingConfig?.length || 0);
      if (existingConfig && existingConfig.length > 0) {
        console.log('Config:', JSON.stringify(existingConfig[0], null, 2));
      }
    }
  }
  
  process.exit(0);
}

checkGmailConfiguration().catch(console.error); 