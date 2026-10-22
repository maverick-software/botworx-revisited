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

async function checkAgentGmailPermissions(agentId) {
  console.log('\n=== Checking Gmail Permissions for Agent ===');
  console.log(`Agent ID: ${agentId}`);
  
  try {
    // 1. Check if agent exists
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, user_id')
      .eq('id', agentId)
      .single();
    
    if (agentError || !agent) {
      console.error('❌ Agent not found:', agentError);
      return;
    }
    
    console.log(`✅ Agent found: ${agent.name} (User: ${agent.user_id})`);
    
    // 2. Check for Gmail OAuth connections for the user
    const { data: connections, error: connError } = await supabase
      .from('user_oauth_connections')
      .select(`
        id,
        user_id,
        connection_name,
        external_username,
        connection_status,
        oauth_provider_id,
        service_providers!inner(name)
      `)
      .eq('user_id', agent.user_id)
      .eq('service_providers.name', 'gmail');
    
    if (connError) {
      console.error('❌ Error fetching connections:', connError);
      return;
    }
    
    if (!connections || connections.length === 0) {
      console.log('❌ No Gmail connections found for this user');
      console.log('\n💡 To fix: User needs to connect their Gmail account first');
      return;
    }
    
    console.log(`\n✅ Found ${connections.length} Gmail connection(s):`);
    connections.forEach(conn => {
      console.log(`  - ${conn.connection_name} (${conn.external_username}) - Status: ${conn.connection_status}`);
    });
    
    // 3. Check agent permissions for these connections
    const { data: permissions, error: permError } = await supabase
      .from('agent_integration_permissions')
      .select(`
        id,
        agent_id,
        user_oauth_connection_id,
        allowed_scopes,
        permission_level,
        is_active,
        created_at,
        updated_at
      `)
      .eq('agent_id', agentId)
      .in('user_oauth_connection_id', connections.map(c => c.id));
    
    if (permError) {
      console.error('❌ Error fetching permissions:', permError);
      return;
    }
    
    if (!permissions || permissions.length === 0) {
      console.log('\n❌ No Gmail permissions found for this agent');
      console.log('\n💡 To fix: Grant Gmail permissions to the agent through the UI');
      console.log('   1. Go to Agent Edit page');
      console.log('   2. In the Channels section, click "Add Channel"');
      console.log('   3. Select Gmail integration');
      console.log('   4. Choose a Gmail account');
      console.log('   5. Select permissions (read, send, modify)');
      return;
    }
    
    console.log(`\n✅ Found ${permissions.length} permission record(s):`);
    permissions.forEach(perm => {
      const conn = connections.find(c => c.id === perm.user_oauth_connection_id);
      console.log(`\n  Permission ID: ${perm.id}`);
      console.log(`  Connection: ${conn?.connection_name || 'Unknown'} (${conn?.external_username || 'Unknown'})`);
      console.log(`  Active: ${perm.is_active ? '✅' : '❌'}`);
      console.log(`  Permission Level: ${perm.permission_level}`);
      console.log(`  Granted Scopes:`);
      
      if (perm.allowed_scopes && perm.allowed_scopes.length > 0) {
        perm.allowed_scopes.forEach(scope => {
          const scopeName = scope.replace('https://www.googleapis.com/auth/', '');
          console.log(`    - ${scopeName}`);
        });
      } else {
        console.log('    ❌ No scopes granted!');
      }
      
      console.log(`  Created: ${new Date(perm.created_at).toLocaleString()}`);
      console.log(`  Updated: ${new Date(perm.updated_at).toLocaleString()}`);
    });
    
    // 4. Check which tools the agent can use
    console.log('\n=== Available Gmail Tools ===');
    const requiredScopes = {
      'send_email': ['https://www.googleapis.com/auth/gmail.send'],
      'read_emails': ['https://www.googleapis.com/auth/gmail.readonly'],
      'search_emails': ['https://www.googleapis.com/auth/gmail.readonly'],
      'email_actions': ['https://www.googleapis.com/auth/gmail.modify']
    };
    
    const activePermissions = permissions.filter(p => p.is_active);
    if (activePermissions.length === 0) {
      console.log('❌ No active permissions - agent cannot use any Gmail tools');
      return;
    }
    
    const allGrantedScopes = activePermissions.flatMap(p => p.allowed_scopes || []);
    
    Object.entries(requiredScopes).forEach(([tool, scopes]) => {
      const hasScopes = scopes.every(scope => allGrantedScopes.includes(scope));
      console.log(`  ${tool}: ${hasScopes ? '✅ Available' : '❌ Missing required scopes'}`);
    });
    
    // 5. Summary
    console.log('\n=== Summary ===');
    const canSendEmail = allGrantedScopes.includes('https://www.googleapis.com/auth/gmail.send');
    const canReadEmail = allGrantedScopes.includes('https://www.googleapis.com/auth/gmail.readonly');
    
    if (canSendEmail && canReadEmail) {
      console.log('✅ Agent has full Gmail access (read and send)');
    } else if (canSendEmail) {
      console.log('⚠️  Agent can only send emails');
    } else if (canReadEmail) {
      console.log('⚠️  Agent can only read emails');
    } else {
      console.log('❌ Agent has no effective Gmail permissions');
    }
    
  } catch (error) {
    console.error('Error checking permissions:', error);
  }
}

// Get agent ID from command line or use a default
const agentId = process.argv[2];

if (!agentId) {
  console.error('Usage: node check_agent_gmail_permissions.js <agent-id>');
  console.error('\nTo find your agent ID:');
  console.error('1. Look in the URL when editing an agent');
  console.error('2. Or run: node scripts/list_agents.js');
  process.exit(1);
}

checkAgentGmailPermissions(agentId); 