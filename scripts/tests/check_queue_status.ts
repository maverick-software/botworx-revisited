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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkQueueStatus() {
  console.log('\n📊 Checking Graph Ingestion Queue Status\n');
  console.log('='.repeat(50));

  try {
    // Get queue items from the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: queueItems, error } = await supabase
      .from('graph_ingestion_queue')
      .select('*')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching queue items:', error);
      return;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('❌ No queue items found in the last hour');
      console.log('\nThis means conversations are NOT being queued for graph ingestion.');
      return;
    }

    console.log(`✅ Found ${queueItems.length} queue items:\n`);

    // Group by status
    const statusCounts: Record<string, number> = {};
    queueItems.forEach(item => {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    });

    console.log('Status Summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      const icon = status === 'completed' ? '✅' : status === 'error' ? '❌' : '⏳';
      console.log(`  ${icon} ${status}: ${count}`);
    });

    console.log('\nRecent Items:');
    queueItems.slice(0, 5).forEach((item, i) => {
      const created = new Date(item.created_at).toLocaleTimeString();
      const content = item.payload?.content?.substring(0, 50) || 'No content';
      const userId = item.payload?.user_id || 'Unknown';
      console.log(`\n${i + 1}. [${item.status}] Created: ${created}`);
      console.log(`   User: ${userId}`);
      console.log(`   Content: ${content}...`);
      if (item.error) {
        console.log(`   Error: ${item.error}`);
      }
    });

    // Check for account_graphs
    console.log('\n' + '='.repeat(50));
    console.log('\n📊 Checking Account Graphs\n');

    const { data: graphs, error: graphError } = await supabase
      .from('account_graphs')
      .select('*, user_oauth_connections!account_graphs_connection_id_fkey(id, external_username)')
      .limit(5);

    if (graphError) {
      console.error('Error fetching account graphs:', graphError);
      return;
    }

    if (!graphs || graphs.length === 0) {
      console.log('❌ No account graphs found');
      console.log('\nThis is the issue! No account_graphs entry exists.');
      console.log('The system should auto-create one when a GetZep connection exists.');
      return;
    }

    console.log(`✅ Found ${graphs.length} account graph(s):\n`);
    graphs.forEach((graph, i) => {
      console.log(`${i + 1}. Graph ID: ${graph.id}`);
      console.log(`   User ID: ${graph.user_id}`);
      console.log(`   Connection: ${graph.user_oauth_connections?.external_username || 'Unknown'}`);
      console.log(`   Created: ${new Date(graph.created_at).toLocaleDateString()}`);
    });

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkQueueStatus().then(() => {
  console.log('\n' + '='.repeat(50));
  console.log('\nDone checking queue status.');
});
