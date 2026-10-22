#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://txhscptzjrrudnqwavcb.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4aHNjcHR6anJydWRucXdhdmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIxNDQwMjgsImV4cCI6MjA0NzcyMDAyOH0.eVTJx5fRlDFJiV0fmHOBLzAB7Nt0HJKGMQvPfKtIgaE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkConnections() {
  console.log('\n🔍 Checking GetZep Connections\n');
  console.log('='.repeat(50));

  try {
    // Get GetZep provider ID
    const { data: provider } = await supabase
      .from('service_providers')
      .select('id')
      .eq('name', 'getzep')
      .single();

    if (!provider) {
      console.log('❌ GetZep provider not found in service_providers table');
      return;
    }

    console.log('✅ GetZep provider ID:', provider.id);

    // Get all GetZep connections
    const { data: connections, error } = await supabase
      .from('user_oauth_connections')
      .select('*')
      .eq('oauth_provider_id', provider.id);

    if (error) {
      console.error('Error fetching connections:', error);
      return;
    }

    if (!connections || connections.length === 0) {
      console.log('\n❌ No GetZep connections found');
      console.log('\n📝 To fix this:');
      console.log('   1. Go to Settings → Integrations in the UI');
      console.log('   2. Find GetZep and click Connect');
      console.log('   3. Enter your API key and Account ID');
      console.log('   4. Click Connect GetZep');
      return;
    }

    console.log(`\n✅ Found ${connections.length} GetZep connection(s):\n`);
    
    for (const conn of connections) {
      console.log(`Connection ID: ${conn.id}`);
      console.log(`  User ID: ${conn.user_id}`);
      console.log(`  Status: ${conn.connection_status}`);
      console.log(`  Created: ${new Date(conn.created_at).toLocaleDateString()}`);
      console.log(`  Metadata:`, conn.connection_metadata);
      
      // Check if account_graphs exists for this user
      const { data: graph } = await supabase
        .from('account_graphs')
        .select('*')
        .eq('user_id', conn.user_id)
        .maybeSingle();

      if (graph) {
        console.log(`  ✅ Account graph exists: ${graph.id}`);
      } else {
        console.log(`  ❌ No account graph - creating one...`);
        
        const { data: newGraph, error: createError } = await supabase
          .from('account_graphs')
          .insert({
            user_id: conn.user_id,
            connection_id: conn.id,
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
          console.error('     Error creating graph:', createError);
        } else {
          console.log(`     ✅ Created account graph: ${newGraph.id}`);
        }
      }
      console.log('');
    }

    // Check recent queue items
    console.log('='.repeat(50));
    console.log('\n📊 Recent Queue Activity:\n');
    
    const { data: queueItems } = await supabase
      .from('graph_ingestion_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (queueItems && queueItems.length > 0) {
      console.log(`Found ${queueItems.length} recent queue items:`);
      queueItems.forEach((item, i) => {
        const time = new Date(item.created_at).toLocaleTimeString();
        console.log(`${i + 1}. [${item.status}] ${time} - ${item.payload?.content?.substring(0, 30) || 'No content'}...`);
      });
    } else {
      console.log('No recent queue items');
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkConnections().then(() => {
  console.log('\n' + '='.repeat(50));
  console.log('\nDone checking connections.');
});
