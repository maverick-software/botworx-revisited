import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try multiple env file locations
const envPaths = [
  join(__dirname, '..', '.env'),
  join(__dirname, '..', '.env.local'),
  join(process.cwd(), '.env'),
  join(process.cwd(), '.env.local')
];

let envLoaded = false;
for (const path of envPaths) {
  const result = dotenv.config({ path });
  if (!result.error) {
    console.log(`✅ Loaded environment from: ${path}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.error('❌ Could not load .env file from any location');
  console.log('Tried:', envPaths);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

console.log('\n=== Environment Check ===');
console.log('URL:', supabaseUrl ? `✅ ${supabaseUrl}` : '❌ Missing');
console.log('Service Key:', supabaseServiceKey ? '✅ Found' : '❌ Missing');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('\n❌ Missing required environment variables');
  console.log('\nMake sure your .env file contains:');
  console.log('VITE_SUPABASE_URL=your-project-url');
  console.log('SUPABASE_SERVICE_ROLE_KEY=your-service-key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findGmailAgents() {
  console.log('\n=== Finding Gmail Agents ===\n');
  
  try {
    // Search for agents with Gmail in the name
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .or('name.ilike.%gmail%,name.ilike.%Gmail%,name.ilike.%GMAIL%')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      console.error('Error searching agents:', error);
      return;
    }
    
    if (!agents || agents.length === 0) {
      console.log('No agents found with "Gmail" in the name.');
      
      // Show some recent agents instead
      const { data: recentAgents, error: recentError } = await supabase
        .from('agents')
        .select('id, name, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (recentAgents && recentAgents.length > 0) {
        console.log('\nShowing 5 most recent agents instead:');
        recentAgents.forEach(agent => {
          console.log(`  - ${agent.name || 'Unnamed'}`);
          console.log(`    ID: ${agent.id}`);
          console.log(`    Created: ${new Date(agent.created_at).toLocaleString()}`);
        });
      }
      return;
    }
    
    console.log(`Found ${agents.length} Gmail agent(s):\n`);
    
    for (const agent of agents) {
      console.log(`📧 ${agent.name}`);
      console.log(`   ID: ${agent.id}`);
      console.log(`   User ID: ${agent.user_id}`);
      console.log(`   Active: ${agent.active ? '✅' : '❌'}`);
      console.log(`   Created: ${new Date(agent.created_at).toLocaleString()}`);
      
      // Quick check for permissions
      const { data: perms, error: permError } = await supabase
        .from('agent_integration_permissions')
        .select('id')
        .eq('agent_id', agent.id);
      
      if (perms && perms.length > 0) {
        console.log(`   Permissions: ✅ ${perms.length} found`);
      } else {
        console.log(`   Permissions: ❌ None`);
      }
      
      console.log(`\n   🔍 To diagnose: node scripts/diagnose_gmail_tools.js ${agent.id}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

findGmailAgents(); 