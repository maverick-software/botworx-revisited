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

async function findUserAgents(userEmail) {
  console.log('\n=== Finding Agents for User ===');
  console.log(`Email: ${userEmail}`);
  
  try {
    // 1. Find user by email
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', userEmail);
    
    if (userError || !users || users.length === 0) {
      // Try auth.users table
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.error('❌ Error finding user:', authError);
        return;
      }
      
      const user = authData.users.find(u => u.email === userEmail);
      if (!user) {
        console.error('❌ User not found with email:', userEmail);
        return;
      }
      
      console.log(`\n✅ User found in auth.users:`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Created: ${new Date(user.created_at).toLocaleString()}`);
      
      await checkUserAgents(user.id);
    } else {
      const user = users[0];
      console.log(`\n✅ User found:`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      
      await checkUserAgents(user.id);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

async function checkUserAgents(userId) {
  // 2. Find all agents for this user
  const { data: agents, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (agentError) {
    console.error('❌ Error fetching agents:', agentError);
    return;
  }
  
  console.log(`\n=== Found ${agents?.length || 0} Agent(s) ===`);
  
  for (const agent of agents || []) {
    console.log(`\n📤 Agent: ${agent.name || 'Unnamed'}`);
    console.log(`   ID: ${agent.id}`);
    console.log(`   Active: ${agent.active ? '✅' : '❌'}`);
    console.log(`   Created: ${new Date(agent.created_at).toLocaleString()}`);
    
    // Check Gmail permissions for this agent
    await checkAgentGmailPermissions(agent.id, userId);
  }
  
  // Also check user's Gmail connections
  console.log('\n=== User Gmail Connections ===');
  const { data: connections, error: connError } = await supabase
    .from('user_oauth_connections')
    .select(`
      *,
      service_providers!inner(name)
    `)
    .eq('user_id', userId)
    .eq('service_providers.name', 'gmail');
  
  console.log(`Found ${connections?.length || 0} Gmail connection(s):`);
  connections?.forEach(conn => {
    console.log(`  - ${conn.external_username} (${conn.connection_status})`);
  });
}

async function checkAgentGmailPermissions(agentId, userId) {
  // Check permissions
  const { data: permissions, error: permError } = await supabase
    .from('agent_integration_permissions')
    .select(`
      *,
      user_oauth_connections!inner(
        external_username,
        connection_status
      )
    `)
    .eq('agent_id', agentId);
  
  if (permissions && permissions.length > 0) {
    console.log(`   Gmail Permissions: ✅ ${permissions.length} permission(s)`);
    permissions.forEach(perm => {
      console.log(`     - ${perm.user_oauth_connections.external_username}`);
      console.log(`       Active: ${perm.is_active ? '✅' : '❌'}`);
      console.log(`       Scopes: ${perm.allowed_scopes?.length || 0}`);
    });
  } else {
    console.log(`   Gmail Permissions: ❌ None`);
  }
  
  // Quick command to debug this agent
  console.log(`\n   💡 To debug: node scripts/debug_agent_permissions.js ${agentId}`);
  console.log(`   💡 To grant: node scripts/grant_agent_gmail_permissions.js ${agentId}`);
}

// Get email from command line
const userEmail = process.argv[2];

if (!userEmail) {
  console.error('Usage: node find_user_agents.js <user-email>');
  console.error('\nExample: node find_user_agents.js user@example.com');
  process.exit(1);
}

findUserAgents(userEmail); 