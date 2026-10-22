// Test script for clean GitHub repo system
require('dotenv').config({ path: '../.env' });

const testChatFunction = async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing environment variables');
    return;
  }

  // Test 1: Simple greeting
  console.log('\n=== Test 1: Simple Greeting ===');
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          content: { type: 'text', text: 'Hello' },
          sender_id: 'test-user',
          conversation_id: 'test-conv-' + Date.now()
        }
      })
    });
    
    const result = await response.json();
    console.log('Response:', result?.message?.content?.text || result);
  } catch (error) {
    console.error('Test 1 Error:', error.message);
  }

  // Test 2: Tool request
  console.log('\n=== Test 2: Tool Request ===');
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          content: { type: 'text', text: 'Can you send email?' },
          sender_id: 'test-user',
          conversation_id: 'test-conv-' + Date.now()
        }
      })
    });
    
    const result = await response.json();
    console.log('Response:', result?.message?.content?.text || result);
  } catch (error) {
    console.error('Test 2 Error:', error.message);
  }
};

testChatFunction().then(() => {
  console.log('\n=== Tests Complete ===');
}).catch(console.error);
