import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function grantGmailPermissions(agentId, connectionId) {
  console.log('\n=== Granting Gmail Permissions to Agent ===');
  
  try {
    // Check if permission already exists
    const { data: existing, error: checkError } = await supabase
      .from('agent_integration_permissions')
      .select('id, allowed_scopes, is_active')
      .eq('agent_id', agentId)
      .eq('user_oauth_connection_id', connectionId)
      .single();
    
    const fullScopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify'
    ];
    
    if (existing) {
      console.log('✅ Permission record already exists');
      console.log('   Current scopes:', existing.allowed_scopes);
      console.log('   Active:', existing.is_active);
      
      // Update existing permission
      const { error: updateError } = await supabase
        .from('agent_integration_permissions')
        .update({
          allowed_scopes: fullScopes,
          permission_level: 'custom',
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      if (updateError) {
        console.error('❌ Error updating permissions:', updateError);
        return;
      }
      
      console.log('\n✅ Updated existing permissions with full Gmail access');
    } else {
      // Create new permission
      const { error: insertError } = await supabase
        .from('agent_integration_permissions')
        .insert({
          agent_id: agentId,
          user_oauth_connection_id: connectionId,
          allowed_scopes: fullScopes,
          permission_level: 'custom',
          is_active: true
        });
      
      if (insertError) {
        console.error('❌ Error creating permissions:', insertError);
        return;
      }
      
      console.log('\n✅ Created new permissions with full Gmail access');
    }
    
    console.log('\nGranted scopes:');
    fullScopes.forEach(scope => {
      const scopeName = scope.replace('https://www.googleapis.com/auth/', '');
      console.log(`  ✅ ${scopeName}`);
    });
    
    console.log('\n✅ Agent now has full Gmail access (read, send, modify)');
    console.log('\n💡 Try asking the agent to send or read emails now!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

async function findGmailConnection(agentId) {
  // Get agent details
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, name, user_id')
    .eq('id', agentId)
    .single();
  
  if (agentError || !agent) {
    console.error('❌ Agent not found');
    return null;
  }
  
  console.log(`Found agent: ${agent.name}`);
  
  // Get Gmail connections for the user
  const { data: connections, error: connError } = await supabase
    .from('user_oauth_connections')
    .select(`
      id,
      connection_name,
      external_username,
      connection_status,
      service_providers!inner(name)
    `)
    .eq('user_id', agent.user_id)
    .eq('service_providers.name', 'gmail')
    .eq('connection_status', 'active');
  
  if (connError || !connections || connections.length === 0) {
    console.error('❌ No active Gmail connections found for this user');
    console.log('\n💡 User needs to connect their Gmail account first:');
    console.log('   1. Go to Settings > Integrations');
    console.log('   2. Click on Gmail');
    console.log('   3. Connect your Gmail account');
    return null;
  }
  
  if (connections.length === 1) {
    console.log(`\nUsing Gmail connection: ${connections[0].external_username}`);
    return connections[0].id;
  }
  
  console.log('\nMultiple Gmail connections found:');
  connections.forEach((conn, index) => {
    console.log(`  ${index + 1}. ${conn.connection_name} (${conn.external_username})`);
  });
  
  // For simplicity, use the first one
  console.log(`\nUsing first connection: ${connections[0].external_username}`);
  return connections[0].id;
}

// Main execution
const agentId = process.argv[2];

if (!agentId) {
  console.error('Usage: node grant_agent_gmail_permissions.js <agent-id>');
  console.error('\nTo find your agent ID:');
  console.error('1. Run: node scripts/list_agents.js');
  process.exit(1);
}

(async () => {
  const connectionId = await findGmailConnection(agentId);
  if (connectionId) {
    await grantGmailPermissions(agentId, connectionId);
  }
})(); 