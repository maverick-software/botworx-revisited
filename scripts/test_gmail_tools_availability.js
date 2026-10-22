#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY, // Use anon key to simulate normal user access
  {
    auth: {
      persistSession: false
    }
  }
);

const agentId = '4850a064-3005-41a8-adf2-90053c877b2d';
const testMessage = 'Can you send an email?';

console.log('Testing Gmail tool availability in chat function...\n');

async function testChatFunction() {
  try {
    // First, let's authenticate as a user
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'testpassword'
    });

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      console.log('Note: You need to set TEST_USER_EMAIL and TEST_USER_PASSWORD in your .env file');
      return;
    }

    console.log('✅ Authenticated as user:', user.id);

    // Call the chat function
    console.log(`\nSending message to agent ${agentId}: "${testMessage}"`);
    
    const { data, error } = await supabase.functions.invoke('chat', {
      body: {
        message: testMessage,
        agentId: agentId,
        channelId: null // Direct chat, no channel
      }
    });

    if (error) {
      console.error('❌ Chat function error:', error);
      return;
    }

    console.log('\n✅ Chat function response:');
    console.log('Agent response:', data.message);
    
    // Check if the response indicates the agent has tools
    if (data.message.toLowerCase().includes("don't have") || 
        data.message.toLowerCase().includes("cannot") ||
        data.message.toLowerCase().includes("unable")) {
      console.log('\n⚠️  The agent still seems to think it lacks permissions.');
      console.log('This might be a caching issue. Try refreshing the page and testing again.');
    } else {
      console.log('\n✅ The agent appears to have access to Gmail tools!');
    }

  } catch (error) {
    console.error('Error testing chat function:', error);
  } finally {
    // Sign out
    await supabase.auth.signOut();
  }
}

// Also test the RPC function directly
async function testRpcFunction() {
  console.log('\n\n=== Testing get_gmail_tools RPC directly ===');
  
  const serviceSupabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  );
  
  const userId = '3f966af2-72a1-41bc-8fac-400b8002664b'; // Your user ID from earlier
  
  const { data, error } = await serviceSupabase.rpc('get_gmail_tools', {
    p_agent_id: agentId,
    p_user_id: userId
  });
  
  if (error) {
    console.error('❌ RPC error:', error);
  } else {
    console.log('✅ RPC result - Available tools:', data);
    if (data && data.length > 0) {
      console.log('\nTools found:');
      data.forEach(tool => {
        console.log(`  - ${tool.name}: ${tool.description}`);
      });
    }
  }
}

// Run both tests
testChatFunction().then(() => testRpcFunction()); 