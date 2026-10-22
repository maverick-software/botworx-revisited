import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listAgents() {
  console.log('\n=== Listing All Agents ===\n');
  
  try {
    const { data: agents, error } = await supabase
      .from('agents')
      .select('id, name, active, created_at, user_id')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching agents:', error);
      return;
    }
    
    if (!agents || agents.length === 0) {
      console.log('No agents found in the database');
      return;
    }
    
    console.log(`Found ${agents.length} agent(s):\n`);
    
    agents.forEach((agent, index) => {
      console.log(`${index + 1}. ${agent.name || 'Unnamed Agent'}`);
      console.log(`   ID: ${agent.id}`);
      console.log(`   Active: ${agent.active ? '✅' : '❌'}`);
      console.log(`   Created: ${new Date(agent.created_at).toLocaleDateString()}`);
      console.log(`   User ID: ${agent.user_id}`);
      console.log('');
    });
    
    console.log('\n💡 To check Gmail permissions for an agent, run:');
    console.log('   node scripts/check_agent_gmail_permissions.js <agent-id>');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

listAgents(); 