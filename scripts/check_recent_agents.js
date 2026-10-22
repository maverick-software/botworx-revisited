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

async function checkRecentAgents() {
  console.log('\n=== Recent Agents (Last 10) ===');
  
  try {
    // Get recent agents
    const { data: agents, error } = await supabase
      .from('agents')
      .select(`
        *,
        users!inner(email)
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Error fetching agents:', error);
      return;
    }
    
    console.log(`Found ${agents?.length || 0} recent agents:\n`);
    
    for (const agent of agents || []) {
      const isGmailAgent = agent.name?.toLowerCase().includes('gmail');
      const marker = isGmailAgent ? '📧' : '🤖';
      
      console.log(`${marker} ${agent.name || 'Unnamed Agent'}`);
      console.log(`   ID: ${agent.id}`);
      console.log(`   User: ${agent.users?.email || agent.user_id}`);
      console.log(`   Active: ${agent.active ? '✅' : '❌'}`);
      console.log(`   Created: ${new Date(agent.created_at).toLocaleString()}`);
      
      if (isGmailAgent) {
        console.log(`   💡 This looks like a Gmail agent!`);
        
        // Check permissions for Gmail agents
        const { data: permissions, error: permError } = await supabase
          .from('agent_integration_permissions')
          .select(`
            *,
            user_oauth_connections!inner(
              external_username,
              service_providers!inner(name)
            )
          `)
          .eq('agent_id', agent.id)
          .eq('user_oauth_connections.service_providers.name', 'gmail');
        
        if (permissions && permissions.length > 0) {
          console.log(`   Gmail Permissions: ✅ Found`);
          permissions.forEach(perm => {
            console.log(`     - ${perm.user_oauth_connections.external_username}`);
            console.log(`       Active: ${perm.is_active ? '✅' : '❌'}`);
            const scopes = perm.allowed_scopes || [];
            console.log(`       Can Send: ${scopes.includes('https://www.googleapis.com/auth/gmail.send') ? '✅' : '❌'}`);
            console.log(`       Can Read: ${scopes.includes('https://www.googleapis.com/auth/gmail.readonly') ? '✅' : '❌'}`);
          });
        } else {
          console.log(`   Gmail Permissions: ❌ None found`);
        }
        
        console.log(`\n   🔍 Debug: node scripts/debug_agent_permissions.js ${agent.id}`);
        console.log(`   ➕ Grant: node scripts/grant_agent_gmail_permissions.js ${agent.id}`);
      }
      
      console.log('');
    }
    
    // Also check recent chat activity
    console.log('\n=== Recent Chat Activity ===');
    const { data: recentMessages, error: msgError } = await supabase
      .from('chat_messages')
      .select(`
        id,
        content,
        sender_agent_id,
        created_at,
        agents!inner(name)
      `)
      .not('sender_agent_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (recentMessages && recentMessages.length > 0) {
      console.log('Recent agent messages:');
      recentMessages.forEach(msg => {
        const preview = msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '');
        console.log(`  - ${msg.agents?.name}: "${preview}"`);
        console.log(`    Agent ID: ${msg.sender_agent_id}`);
        console.log(`    Time: ${new Date(msg.created_at).toLocaleString()}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkRecentAgents(); 