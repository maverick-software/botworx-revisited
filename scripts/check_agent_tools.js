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

const AGENT_ID = '4850a064-3005-41a8-adf2-90053c877b2d';
const USER_ID = '3f966af2-72a1-41bc-8fac-400b8002664b';

async function checkAgentTools() {
  console.log('Checking Gmail Agent Tools\n');
  console.log('=========================\n');

  try {
    // Call the RPC function to get agent's Gmail tools
    const { data: tools, error } = await supabase.rpc('get_gmail_tools', {
      p_agent_id: AGENT_ID,
      p_user_id: USER_ID
    });

    if (error) {
      console.error('Error fetching tools:', error);
      return;
    }

    if (!tools || tools.length === 0) {
      console.log('❌ No Gmail tools found for agent');
      return;
    }

    console.log(`✅ Found ${tools.length} Gmail tools:\n`);
    
    tools.forEach((tool, index) => {
      console.log(`${index + 1}. Tool Name: "${tool.name}"`);
      console.log(`   Description: ${tool.description}`);
      console.log(`   Parameters:`, JSON.stringify(tool.parameters, null, 2));
      console.log('');
    });

    // Also check agent permissions
    console.log('\nChecking agent permissions...');
    const { data: permissions, error: permError } = await supabase
      .from('agent_integration_permissions')
      .select(`
        allowed_scopes,
        is_active,
        user_oauth_connections!inner(
          token_expires_at,
          connection_status
        )
      `)
      .eq('agent_id', AGENT_ID)
      .single();

    if (permError) {
      console.error('Error fetching permissions:', permError);
    } else if (permissions) {
      console.log('\nAgent OAuth Permissions:');
      console.log('- Active:', permissions.is_active);
      console.log('- Scopes:', permissions.allowed_scopes);
      console.log('- Connection Status:', permissions.user_oauth_connections.connection_status);
      console.log('- Token Expires:', permissions.user_oauth_connections.token_expires_at);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkAgentTools(); 