#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

console.log('Testing Gmail Send Directly\n');

async function testGmailSend(agentId) {
  try {
    // Get the current user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // If no session, you'll need to authenticate first
    if (!user) {
      console.error('No active session. Please authenticate first or update the script with credentials.');
      return;
    }

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return;
    }

    console.log('✅ Authenticated as:', user.email);

    // Test sending email directly via the gmail-api edge function
    console.log('\nCalling gmail-api edge function...');
    
    const { data, error } = await supabase.functions.invoke('gmail-api', {
      body: {
        action: 'send_email',
        agent_id: agentId,
        parameters: {
          to: 'charles@torqmsp.com',
          subject: 'Test Email from Agentopia Diagnostic',
          body: 'This is a test email sent directly via the gmail-api edge function to diagnose the issue.'
        }
      }
    });

    if (error) {
      console.error('\n❌ Edge function error:', error);
      return;
    }

    console.log('\nResponse from gmail-api:');
    console.log(JSON.stringify(data, null, 2));

    if (data && !data.success) {
      console.error('\n❌ Gmail API returned error:', data.error);
    } else {
      console.log('\n✅ Email sent successfully!');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Get agent ID from command line or use default
const agentId = process.argv[2] || '4850a064-3005-41a8-adf2-90053c877b2d';

console.log(`Testing Gmail send for agent: ${agentId}\n`);

testGmailSend(agentId); 