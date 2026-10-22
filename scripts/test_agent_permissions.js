import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAgentPermissions(agentId) {
  console.log('\n=== Testing Agent Integration Permissions ===');
  console.log(`Agent ID: ${agentId}\n`);
  
  try {
    // 1. Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, user_id')
      .eq('id', agentId)
      .single();
    
    if (agentError || !agent) {
      console.error('❌ Agent not found:', agentError);
      return;
    }
    
    console.log(`Agent: ${agent.name}`);
    console.log(`Owner: ${agent.user_id}\n`);
    
    // 2. Test the RPC function
    console.log('=== Testing get_agent_integration_permissions RPC ===\n');
    
    // We need to set the auth context to the agent owner
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_agent_integration_permissions', {
      p_agent_id: agentId
    });
    
    if (rpcError) {
      console.error('❌ RPC Error:', rpcError);
    } else {
      console.log(`RPC returned ${rpcData?.length || 0} permission(s)`);
      if (rpcData && rpcData.length > 0) {
        console.log('\nPermissions from RPC:');
        rpcData.forEach(perm => {
          console.log(`  - ${perm.provider_display_name || perm.provider_name}`);
          console.log(`    Connection: ${perm.connection_name}`);
          console.log(`    Username: ${perm.external_username}`);
          console.log(`    Active: ${perm.is_active}`);
          console.log(`    Integration Name: ${perm.integration_name || 'N/A'}`);
        });
      }
    }
    
    // 3. Check raw permissions table
    console.log('\n=== Raw Permissions from agent_integration_permissions ===\n');
    
    const { data: rawPerms, error: rawError } = await supabase
      .from('agent_integration_permissions')
      .select(`
        *,
        user_oauth_connections!inner(
          id,
          connection_name,
          external_username,
          connection_status,
          service_providers!inner(
            name,
            display_name
          )
        )
      `)
      .eq('agent_id', agentId)
      .eq('is_active', true);
    
    if (rawError) {
      console.error('❌ Error fetching raw permissions:', rawError);
    } else {
      console.log(`Found ${rawPerms?.length || 0} active permission(s)`);
      if (rawPerms && rawPerms.length > 0) {
        console.log('\nRaw permissions:');
        rawPerms.forEach(perm => {
          const conn = perm.user_oauth_connections;
          const provider = conn?.service_providers;
          console.log(`  - ${provider?.display_name || provider?.name || 'Unknown'}`);
          console.log(`    Connection Status: ${conn?.connection_status}`);
          console.log(`    Username: ${conn?.external_username}`);
          console.log(`    Permission Active: ${perm.is_active}`);
          console.log(`    Scopes: ${JSON.stringify(perm.allowed_scopes)}`);
        });
      }
    }
    
    // 4. Check integrations table
    console.log('\n=== Channel Integrations from integrations table ===\n');
    
    const { data: integrations, error: intError } = await supabase
      .from('integrations')
      .select('*')
      .eq('agent_classification', 'channel')
      .eq('is_active', true);
    
    if (intError) {
      console.error('❌ Error fetching integrations:', intError);
    } else {
      console.log('Available channel integrations:');
      integrations?.forEach(int => {
        console.log(`  - ${int.name} (ID: ${int.id})`);
      });
    }
    
    // 5. Summary
    console.log('\n=== Summary ===\n');
    
    if (rpcData && rpcData.length > 0) {
      console.log('✅ RPC function is returning permissions correctly');
      console.log('   The issue might be in the frontend component filtering');
    } else if (rawPerms && rawPerms.length > 0) {
      console.log('⚠️  Permissions exist but RPC is not returning them');
      console.log('   This could be due to auth context or function logic');
    } else {
      console.log('❌ No permissions found for this agent');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Get agent ID from command line
const agentId = process.argv[2];

if (!agentId) {
  console.error('Usage: node scripts/test_agent_permissions.js <agent-id>');
  console.error('\nTo find your agent ID:');
  console.error('1. Look in the URL when on the agent chat page');
  console.error('2. Or run: node scripts/list_agents.js');
  process.exit(1);
}

testAgentPermissions(agentId);