#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

console.log('Testing Chat Function with Gmail Tool\n');

async function testChatWithGmail() {
  try {
    // Get the user for the agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('user_id')
      .eq('id', '4850a064-3005-41a8-adf2-90053c877b2d')
      .single();

    if (agentError || !agent) {
      console.error('Could not find agent:', agentError);
      return;
    }

    console.log('Agent owner:', agent.user_id);

    // Call the chat function
    console.log('\nCalling chat function...');
    const { data, error } = await supabase.functions.invoke('chat', {
      body: {
        message: 'Please send an email to charles@torqmsp.com with the subject "Test from Agentopia" and the body "This is a test email to diagnose the Gmail integration issue."',
        agentId: '4850a064-3005-41a8-adf2-90053c877b2d'
      },
      headers: {
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    if (error) {
      console.error('\n❌ Chat function error:', error);
      return;
    }

    console.log('\nChat function response:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

testChatWithGmail(); 