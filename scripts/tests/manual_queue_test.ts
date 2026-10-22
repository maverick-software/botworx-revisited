#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://txhscptzjrrudnqwavcb.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4aHNjcHR6anJydWRucXdhdmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIxNDQwMjgsImV4cCI6MjA0NzcyMDAyOH0.eVTJx5fRlDFJiV0fmHOBLzAB7Nt0HJKGMQvPfKtIgaE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Your user ID - replace with actual user ID
const USER_ID = '3f966af2-72a1-41bc-8fac-400b8002664b';

async function manualTest() {
  console.log('\n🔧 Manual Graph Ingestion Test\n');
  console.log('='.repeat(50));

  try {
    // Step 1: Check if account_graphs exists
    console.log('\n1. Checking for account_graphs entry...');
    const { data: accountGraph, error: graphError } = await supabase
      .from('account_graphs')
      .select('*')
      .eq('user_id', USER_ID)
      .maybeSingle();

    if (!accountGraph) {
      console.log('   ❌ No account_graphs entry found');
      
      // Check for GetZep connection
      const { data: zepConnection } = await supabase
        .from('user_oauth_connections')
        .select('*')
        .eq('user_id', USER_ID)
        .ilike('external_username', '%GetZep%')
        .maybeSingle();

      if (zepConnection) {
        console.log('   ✅ Found GetZep connection, creating account_graphs entry...');
        
        const { data: newGraph, error: createError } = await supabase
          .from('account_graphs')
          .insert({
            user_id: USER_ID,
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
          return;
        } else {
          console.log('   ✅ Created account_graphs entry:', newGraph.id);
        }
      } else {
        console.log('   ❌ No GetZep connection found');
        return;
      }
    } else {
      console.log('   ✅ Account graph exists:', accountGraph.id);
    }

    // Step 2: Manually queue a test message
    console.log('\n2. Queueing test message for graph ingestion...');
    
    const testContent = `User test message at ${new Date().toISOString()}: Testing GetZep graph ingestion to ensure data is being stored and retrieved correctly.`;
    
    const { data: queueItem, error: queueError } = await supabase
      .from('graph_ingestion_queue')
      .insert({
        account_graph_id: accountGraph?.id || (await supabase
          .from('account_graphs')
          .select('id')
          .eq('user_id', USER_ID)
          .single()).data?.id,
        payload: {
          user_id: USER_ID,
          content: testContent,
          source_kind: 'test',
          source_id: 'manual_test_' + Date.now()
        },
        status: 'pending'
      })
      .select()
      .single();

    if (queueError) {
      console.error('   Error queueing message:', queueError);
      return;
    }

    console.log('   ✅ Queued message:', queueItem.id);
    console.log('   Content:', testContent.substring(0, 50) + '...');

    // Step 3: Trigger the edge function
    console.log('\n3. Triggering graph-ingestion edge function...');
    
    const response = await fetch(`${supabaseUrl}/functions/v1/graph-ingestion`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (response.ok) {
      console.log('   ✅ Edge function triggered successfully');
    } else {
      console.log('   ❌ Edge function failed:', response.status, await response.text());
    }

    // Step 4: Check queue status
    console.log('\n4. Checking queue item status...');
    
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
    
    const { data: updatedItem } = await supabase
      .from('graph_ingestion_queue')
      .select('*')
      .eq('id', queueItem.id)
      .single();

    console.log('   Status:', updatedItem?.status);
    if (updatedItem?.error) {
      console.log('   Error:', updatedItem.error);
    }

    // Step 5: Summary
    console.log('\n' + '='.repeat(50));
    console.log('\n📊 Summary:');
    console.log('   - Account graph:', accountGraph ? '✅ Exists' : '❌ Missing');
    console.log('   - Queue item:', queueItem ? '✅ Created' : '❌ Failed');
    console.log('   - Processing:', updatedItem?.status === 'completed' ? '✅ Completed' : '⏳ ' + (updatedItem?.status || 'Unknown'));
    
    if (updatedItem?.status === 'completed') {
      console.log('\n✅ SUCCESS! Data should now be in GetZep.');
      console.log('   Check your GetZep dashboard at: https://app.getzep.com');
    } else if (updatedItem?.status === 'error') {
      console.log('\n❌ FAILED! Check the error message above.');
    } else {
      console.log('\n⏳ PROCESSING... Check the queue status later.');
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

manualTest().then(() => {
  console.log('\n' + '='.repeat(50));
  console.log('\nDone with manual test.');
});
