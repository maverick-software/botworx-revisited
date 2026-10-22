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

async function debugAgentPermissions(agentId, userId) {
  console.log('\n=== DEBUGGING AGENT GMAIL PERMISSIONS ===');
  console.log(`Agent ID: ${agentId}`);
  console.log(`User ID: ${userId || 'Will fetch from agent'}`);
  
  try {
    // 1. Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();
    
    if (agentError || !agent) {
      console.error('❌ Agent not found:', agentError);
      return;
    }
    
    console.log('\n✅ Agent found:');
    console.log(`  Name: ${agent.name}`);
    console.log(`  User ID: ${agent.user_id}`);
    console.log(`  Active: ${agent.active}`);
    
    const targetUserId = userId || agent.user_id;
    
    // 2. Check OAuth providers
    console.log('\n=== OAuth Providers ===');
    const { data: providers, error: provError } = await supabase
      .from('service_providers')
      .select('*')
      .eq('name', 'gmail');
    
    if (provError) {
      console.error('❌ Error fetching providers:', provError);
    } else {
      console.log(`Found ${providers?.length || 0} Gmail provider(s):`);
      providers?.forEach(p => {
        console.log(`  - ID: ${p.id}, Name: ${p.name}, Active: ${p.is_active}`);
      });
    }
    
    // 3. Check user OAuth connections
    console.log('\n=== User OAuth Connections ===');
    const { data: connections, error: connError } = await supabase
      .from('user_oauth_connections')
      .select(`
        *,
        service_providers!inner(*)
      `)
      .eq('user_id', targetUserId)
      .eq('service_providers.name', 'gmail');
    
    if (connError) {
      console.error('❌ Error fetching connections:', connError);
    } else {
      console.log(`Found ${connections?.length || 0} Gmail connection(s):`);
      connections?.forEach(conn => {
        console.log(`\n  Connection ID: ${conn.id}`);
        console.log(`  Name: ${conn.connection_name}`);
        console.log(`  Email: ${conn.external_username}`);
        console.log(`  Status: ${conn.connection_status}`);
        console.log(`  Provider ID: ${conn.oauth_provider_id}`);
        console.log(`  Created: ${new Date(conn.created_at).toLocaleString()}`);
      });
    }
    
    // 4. Check agent permissions - Direct query
    console.log('\n=== Agent OAuth Permissions (Direct Query) ===');
    const { data: permissions, error: permError } = await supabase
      .from('agent_integration_permissions')
      .select('*')
      .eq('agent_id', agentId);
    
    if (permError) {
      console.error('❌ Error fetching permissions:', permError);
    } else {
      console.log(`Found ${permissions?.length || 0} permission record(s):`);
      permissions?.forEach(perm => {
        console.log(`\n  Permission ID: ${perm.id}`);
        console.log(`  Connection ID: ${perm.user_oauth_connection_id}`);
        console.log(`  Active: ${perm.is_active}`);
        console.log(`  Permission Level: ${perm.permission_level}`);
        console.log(`  Scopes: ${JSON.stringify(perm.allowed_scopes)}`);
        console.log(`  Created: ${new Date(perm.created_at).toLocaleString()}`);
      });
    }
    
    // 5. Test the exact query used by the chat function
    console.log('\n=== Testing Chat Function Query ===');
    const { data: chatQueryResult, error: chatQueryError } = await supabase
      .from('agent_integration_permissions')
      .select(`
        allowed_scopes,
        is_active,
        user_oauth_connections!inner(
          oauth_provider_id,
          service_providers!inner(name)
        )
      `)
      .eq('agent_id', agentId)
      .eq('user_oauth_connections.user_id', targetUserId)
      .eq('user_oauth_connections.service_providers.name', 'gmail')
      .eq('is_active', true)
      .single();
    
    if (chatQueryError) {
      console.error('❌ Chat function query failed:', chatQueryError);
      console.log('  Error code:', chatQueryError.code);
      console.log('  Error message:', chatQueryError.message);
      console.log('  Error details:', chatQueryError.details);
    } else {
      console.log('✅ Chat function query succeeded:');
      console.log('  Result:', JSON.stringify(chatQueryResult, null, 2));
    }
    
    // 6. Test the RPC function
    console.log('\n=== Testing RPC Function ===');
    const requiredScopes = ['https://www.googleapis.com/auth/gmail.send'];
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('validate_agent_gmail_permissions', {
        p_agent_id: agentId,
        p_user_id: targetUserId,
        p_required_scopes: requiredScopes
      });
    
    if (rpcError) {
      console.error('❌ RPC function failed:', rpcError);
    } else {
      console.log(`✅ RPC result for send permission: ${rpcResult}`);
    }
    
    // 7. Check integrations table
    console.log('\n=== Integrations Table ===');
    const { data: integrations, error: intError } = await supabase
      .from('integrations')
      .select('*')
      .eq('name', 'Gmail');
    
    if (intError) {
      console.error('❌ Error fetching integrations:', intError);
    } else {
      console.log(`Found ${integrations?.length || 0} Gmail integration(s):`);
      integrations?.forEach(int => {
        console.log(`  - ID: ${int.id}, Name: ${int.name}, Status: ${int.status}`);
        console.log(`    Classification: ${int.agent_classification}`);
      });
    }
    
    // 8. Summary and diagnosis
    console.log('\n=== DIAGNOSIS SUMMARY ===');
    
    if (!connections || connections.length === 0) {
      console.log('❌ ISSUE: No Gmail connections found for the user');
      console.log('   FIX: User needs to connect Gmail in Settings > Integrations');
    } else if (!permissions || permissions.length === 0) {
      console.log('❌ ISSUE: No permissions granted to agent for Gmail');
      console.log('   FIX: Grant permissions via Agent Edit UI or use grant_agent_gmail_permissions.js');
    } else if (permissions.some(p => !p.is_active)) {
      console.log('⚠️  ISSUE: Some permissions are inactive');
      console.log('   FIX: Activate permissions in the database');
    } else if (chatQueryError) {
      console.log('❌ ISSUE: The chat function query is failing');
      console.log('   This might be due to join conditions or RLS policies');
    } else {
      console.log('✅ Permissions appear to be properly configured');
      console.log('   The issue might be in the tool execution logic');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Get arguments
const agentId = process.argv[2];
const userId = process.argv[3];

if (!agentId) {
  console.error('Usage: node debug_agent_permissions.js <agent-id> [user-id]');
  console.error('\nTo find IDs:');
  console.error('1. Agent ID: Look in URL when editing agent or run list_agents.js');
  console.error('2. User ID: Optional, will use agent\'s owner if not provided');
  process.exit(1);
}

debugAgentPermissions(agentId, userId); 