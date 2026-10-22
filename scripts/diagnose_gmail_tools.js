import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  console.log('URL:', supabaseUrl ? 'Found' : 'Missing');
  console.log('Service Key:', supabaseServiceKey ? 'Found' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnoseGmailTools(agentId, userId) {
  console.log('\n=== DIAGNOSING GMAIL TOOL AVAILABILITY ===');
  console.log(`Agent ID: ${agentId}`);
  console.log(`User ID: ${userId || 'Will fetch from agent'}`);
  
  try {
    // 1. Get agent details if user ID not provided
    if (!userId) {
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('user_id')
        .eq('id', agentId)
        .single();
      
      if (agentError || !agent) {
        console.error('❌ Could not fetch agent:', agentError);
        return;
      }
      
      userId = agent.user_id;
      console.log(`Fetched User ID: ${userId}`);
    }
    
    // 2. Simulate getGmailTools query from chat function
    console.log('\n=== Simulating getGmailTools Query ===');
    
    // First, check if permissions exist at all
    const { data: allPermissions, error: allPermError } = await supabase
      .from('agent_integration_permissions')
      .select('*')
      .eq('agent_id', agentId);
    
    console.log(`\nAll permissions for agent: ${allPermissions?.length || 0}`);
    if (allPermissions && allPermissions.length > 0) {
      allPermissions.forEach(p => {
        console.log(`  - Permission ID: ${p.id}`);
        console.log(`    Connection ID: ${p.user_oauth_connection_id}`);
        console.log(`    Active: ${p.is_active}`);
      });
    }
    
    // Now run the exact query used in getGmailTools
    const { data: gmailPerms, error: gmailError } = await supabase
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
      .eq('user_oauth_connections.user_id', userId)
      .eq('user_oauth_connections.service_providers.name', 'gmail')
      .eq('is_active', true)
      .single();
    
    if (gmailError) {
      console.error('\n❌ Gmail permissions query failed:');
      console.error('  Code:', gmailError.code);
      console.error('  Message:', gmailError.message);
      console.error('  Details:', gmailError.details);
      console.error('  Hint:', gmailError.hint);
      
      // If it's PGRST116, no rows found
      if (gmailError.code === 'PGRST116') {
        console.log('\n  This means no Gmail permissions were found matching all criteria.');
        console.log('  Let\'s break down the query to find where it fails...');
        
        // Test each condition separately
        await debugQueryConditions(agentId, userId);
      }
    } else {
      console.log('\n✅ Gmail permissions found!');
      console.log('  Allowed scopes:', gmailPerms.allowed_scopes);
      console.log('  Can send emails:', gmailPerms.allowed_scopes?.includes('https://www.googleapis.com/auth/gmail.send'));
      
      // Check if tools would be generated
      const hasFullAccess = gmailPerms.allowed_scopes?.includes('https://mail.google.com/');
      const canSend = gmailPerms.allowed_scopes?.includes('https://www.googleapis.com/auth/gmail.send');
      
      console.log('\n  Tool availability:');
      console.log(`    Send Email: ${hasFullAccess || canSend ? '✅' : '❌'}`);
    }
    
    // 3. Check the validate_agent_gmail_permissions RPC
    console.log('\n=== Testing RPC Function ===');
    const requiredScopes = ['https://www.googleapis.com/auth/gmail.send'];
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('validate_agent_gmail_permissions', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_required_scopes: requiredScopes
      });
    
    if (rpcError) {
      console.error('❌ RPC validation failed:', rpcError);
    } else {
      console.log(`✅ RPC validation result: ${rpcResult ? 'Has permission' : 'No permission'}`);
    }
    
    // 4. Final diagnosis
    console.log('\n=== DIAGNOSIS SUMMARY ===');
    if (gmailError && gmailError.code === 'PGRST116') {
      console.log('❌ The agent cannot use Gmail tools because:');
      console.log('   The exact query used by getGmailTools returns no results.');
      console.log('   This is why the agent says it doesn\'t have permissions.');
      console.log('\n   To fix this, check the debug output above to see which');
      console.log('   condition is failing and address it.');
    } else if (gmailPerms) {
      console.log('✅ The agent should be able to use Gmail tools!');
      console.log('   If it\'s still not working, the issue may be in:');
      console.log('   - How the tools are being passed to OpenAI');
      console.log('   - The tool execution logic');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

async function debugQueryConditions(agentId, userId) {
  console.log('\n=== Debugging Query Conditions ===');
  
  // 1. Check basic agent permissions
  const { data: step1, error: err1 } = await supabase
    .from('agent_oauth_permissions')
    .select('*')
    .eq('agent_id', agentId);
  
  console.log(`\n1. Permissions for agent ${agentId}: ${step1?.length || 0} found`);
  
  if (!step1 || step1.length === 0) {
    console.log('   ❌ No permissions exist for this agent');
    return;
  }
  
  // 2. Check with user connection join
  const { data: step2, error: err2 } = await supabase
    .from('agent_oauth_permissions')
    .select(`
      *,
      user_oauth_connections!inner(
        id,
        user_id,
        oauth_provider_id
      )
    `)
    .eq('agent_id', agentId);
  
  console.log(`\n2. Permissions with connection join: ${step2?.length || 0} found`);
  step2?.forEach(p => {
    console.log(`   - Connection user_id: ${p.user_oauth_connections?.user_id}`);
  });
  
  // 3. Check with user filter
  const { data: step3, error: err3 } = await supabase
    .from('agent_oauth_permissions')
    .select(`
      *,
      user_oauth_connections!inner(
        id,
        user_id,
        oauth_provider_id
      )
    `)
    .eq('agent_id', agentId)
    .eq('user_oauth_connections.user_id', userId);
  
  console.log(`\n3. Permissions for user ${userId}: ${step3?.length || 0} found`);
  
  if (!step3 || step3.length === 0) {
    console.log('   ❌ The connection belongs to a different user');
    return;
  }
  
  // 4. Check with provider join
  const { data: step4, error: err4 } = await supabase
    .from('agent_oauth_permissions')
    .select(`
      *,
      user_oauth_connections!inner(
        id,
        user_id,
        oauth_provider_id,
        service_providers!inner(name)
      )
    `)
    .eq('agent_id', agentId)
    .eq('user_oauth_connections.user_id', userId);
  
  console.log(`\n4. With provider join: ${step4?.length || 0} found`);
  step4?.forEach(p => {
    console.log(`   - Provider: ${p.user_oauth_connections?.service_providers?.name}`);
  });
  
  // 5. Check Gmail filter
  const { data: step5, error: err5 } = await supabase
    .from('agent_oauth_permissions')
    .select(`
      *,
      user_oauth_connections!inner(
        id,
        user_id,
        oauth_provider_id,
        service_providers!inner(name)
      )
    `)
    .eq('agent_id', agentId)
    .eq('user_oauth_connections.user_id', userId)
    .eq('user_oauth_connections.service_providers.name', 'gmail');
  
  console.log(`\n5. Gmail permissions only: ${step5?.length || 0} found`);
  
  if (!step5 || step5.length === 0) {
    console.log('   ❌ The permission is not for Gmail provider');
    return;
  }
  
  // 6. Check active status
  const { data: step6, error: err6 } = await supabase
    .from('agent_oauth_permissions')
    .select(`
      *,
      user_oauth_connections!inner(
        id,
        user_id,
        oauth_provider_id,
        service_providers!inner(name)
      )
    `)
    .eq('agent_id', agentId)
    .eq('user_oauth_connections.user_id', userId)
    .eq('user_oauth_connections.service_providers.name', 'gmail')
    .eq('is_active', true);
  
  console.log(`\n6. Active Gmail permissions: ${step6?.length || 0} found`);
  
  if (!step6 || step6.length === 0) {
    console.log('   ❌ The permission exists but is_active = false');
    step5?.forEach(p => {
      console.log(`   Permission ${p.id} has is_active = ${p.is_active}`);
    });
  } else {
    console.log('   ✅ All conditions pass! The query should work.');
  }
}

// Get arguments
const agentId = process.argv[2];
const userId = process.argv[3];

if (!agentId) {
  console.error('Usage: node diagnose_gmail_tools.js <agent-id> [user-id]');
  console.error('\nExample: node diagnose_gmail_tools.js abc123-def456');
  process.exit(1);
}

diagnoseGmailTools(agentId, userId); 