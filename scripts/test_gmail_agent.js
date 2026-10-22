import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Gmail agent ID from your system
const GMAIL_AGENT_ID = '4850a064-3005-41a8-adf2-90053c877b2d';

async function testGmailAgent() {
  console.log('Gmail Agent Test Script\n');
  console.log('This will test sending an email through your Gmail agent.');
  console.log('========================================================\n');

  // Get user info
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error('Error getting user:', authError?.message || 'No user found');
    console.log('\nPlease make sure you are logged in.');
    return;
  }

  console.log(`User ID: ${user.id}`);
  console.log(`Agent ID: ${GMAIL_AGENT_ID}\n`);

  // Check agent permissions
  console.log('1. Checking agent Gmail permissions...');
  const { data: tools, error: toolsError } = await supabase.rpc('get_agent_gmail_tools', {
    p_agent_id: GMAIL_AGENT_ID
  });

  if (toolsError) {
    console.error('   ❌ Error checking permissions:', toolsError.message);
    return;
  }

  if (!tools || tools.length === 0) {
    console.error('   ❌ No Gmail tools available for this agent');
    console.log('   Please ensure Gmail is connected and permissions are granted.');
    return;
  }

  console.log(`   ✅ Found ${tools.length} Gmail tools:`, tools.map(t => t.name).join(', '));

  // Create test message
  const testMessage = {
    role: 'user',
    content: 'Please send a test email to myself with the subject "Gmail Agent Test" and body "This is a test email sent by the Gmail agent. If you received this, the integration is working correctly!"'
  };

  console.log('\n2. Sending test message to agent...');
  console.log(`   Message: "${testMessage.content}"`);

  // Call chat function
  const { data: response, error: chatError } = await supabase.functions.invoke('chat', {
    body: {
      messages: [testMessage],
      agentId: GMAIL_AGENT_ID,
      conversationId: `test-${Date.now()}`
    }
  });

  if (chatError) {
    console.error('\n   ❌ Chat function error:', chatError.message);
    return;
  }

  if (response?.error) {
    console.error('\n   ❌ Response error:', response.error);
    return;
  }

  console.log('\n   ✅ Agent response:', response?.content || 'No content');

  // Check tool execution logs
  console.log('\n3. Checking tool execution logs...');
  const { data: toolLogs, error: toolLogsError } = await supabase
    .from('tool_execution_logs')
    .select('*')
    .eq('agent_id', GMAIL_AGENT_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  if (toolLogsError) {
    console.error('   ❌ Error fetching tool logs:', toolLogsError.message);
  } else if (toolLogs && toolLogs.length > 0) {
    console.log(`   ✅ Found ${toolLogs.length} recent tool executions:`);
    toolLogs.forEach((log, i) => {
      console.log(`\n   ${i + 1}. Tool: ${log.tool_name}`);
      console.log(`      Status: ${log.status}`);
      console.log(`      Time: ${log.created_at}`);
      if (log.error_message) {
        console.log(`      Error: ${log.error_message}`);
      }
    });
  } else {
    console.log('   ℹ️  No tool execution logs found');
  }

  // Check Gmail operation logs
  console.log('\n4. Checking Gmail operation logs...');
  const { data: gmailLogs, error: gmailLogsError } = await supabase
    .from('gmail_operation_logs')
    .select('*')
    .eq('agent_id', GMAIL_AGENT_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  if (gmailLogsError) {
    console.error('   ❌ Error fetching Gmail logs:', gmailLogsError.message);
  } else if (gmailLogs && gmailLogs.length > 0) {
    console.log(`   ✅ Found ${gmailLogs.length} recent Gmail operations:`);
    gmailLogs.forEach((log, i) => {
      console.log(`\n   ${i + 1}. Operation: ${log.operation_type}`);
      console.log(`      Status: ${log.status}`);
      console.log(`      Time: ${log.created_at}`);
      if (log.error_message) {
        console.log(`      Error: ${log.error_message}`);
      }
    });
  } else {
    console.log('   ℹ️  No Gmail operation logs found');
  }

  console.log('\n\nTest complete! Check your email for the test message.');
  console.log('If you didn\'t receive it, check the logs above for errors.');
}

// Run the test
testGmailAgent().catch(console.error); 