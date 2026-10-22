#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required environment variables');
  console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAccountGraph() {
  console.log('\n🔍 Checking Account Graph Setup\n');
  console.log('='.repeat(50));

  try {
    // Get the current user from auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('No authenticated user found');
      console.log('Please log in to the application first');
      return;
    }

    console.log(`\n👤 User: ${user.email}`);
    console.log(`   ID: ${user.id}`);

    // Check for GetZep connection
    const { data: zepConnection, error: connError } = await supabase
      .from('user_oauth_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('oauth_provider_id', (await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'getzep')
        .single()).data?.id)
      .maybeSingle();

    if (!zepConnection) {
      console.log('\n❌ No GetZep connection found for user');
      console.log('   Please connect GetZep in Settings → Integrations');
      return;
    }

    console.log('\n✅ GetZep connection found:');
    console.log(`   Connection ID: ${zepConnection.id}`);
    console.log(`   Status: ${zepConnection.connection_status}`);
    console.log(`   Account ID: ${zepConnection.connection_metadata?.account_id || 'Not set'}`);
    console.log(`   Project ID: ${zepConnection.connection_metadata?.project_id || 'Not set'}`);

    // Check for account_graphs entry
    const { data: accountGraph, error: graphError } = await supabase
      .from('account_graphs')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!accountGraph) {
      console.log('\n❌ No account_graphs entry found!');
      console.log('   This is why messages are not being queued.');
      console.log('\n🔧 Creating account_graphs entry...');

      // Create the account_graphs entry
      const { data: newGraph, error: createError } = await supabase
        .from('account_graphs')
        .insert({
          user_id: user.id,
          connection_id: zepConnection.id,
          settings: {
            retrieval: {
              hop_depth: 2,
              max_results: 50
            }
          }
        })
        .select()
        .single();

      if (createError) {
        console.error('   Error creating account_graphs:', createError);
      } else {
        console.log('   ✅ Created account_graphs entry:', newGraph.id);
      }
    } else {
      console.log('\n✅ Account graph exists:');
      console.log(`   Graph ID: ${accountGraph.id}`);
      console.log(`   Connection ID: ${accountGraph.connection_id}`);
      console.log(`   Created: ${new Date(accountGraph.created_at).toLocaleDateString()}`);
    }

    // Check recent agent memories to see if they're being created
    console.log('\n' + '='.repeat(50));
    console.log('\n📝 Checking Recent Agent Memories\n');

    const { data: memories, error: memError } = await supabase
      .from('agent_memories')
      .select('id, agent_id, memory_type, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (memories && memories.length > 0) {
      console.log(`Found ${memories.length} recent memories:`);
      memories.forEach((mem, i) => {
        console.log(`${i + 1}. ${mem.memory_type} - ${new Date(mem.created_at).toLocaleTimeString()}`);
      });
    } else {
      console.log('No recent memories found');
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkAccountGraph().then(() => {
  console.log('\n' + '='.repeat(50));
  console.log('\nDone checking account graph setup.');
});
