import 'dotenv/config';

async function testZepDirect() {
  const ZEP_API_KEY = (process.env.GETZEP_API_KEY ?? (() => { throw new Error('Set GETZEP_API_KEY before running this manual check.'); })());
  const PROJECT_ID = '877b341c-355d-41cf-91b7-fc558072bb1f'; // Extracted from the API key
  
  console.log('Testing GetZep API directly...');
  
  // Test the GetZep API
  const response = await fetch('https://api.getzep.com/v3/graph/facts', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ZEP_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Project-Id': PROJECT_ID
    }
  });

  console.log('Response status:', response.status);
  
  if (response.ok) {
    const data = await response.json();
    console.log('GetZep API works! Response:', JSON.stringify(data, null, 2));
  } else {
    const error = await response.text();
    console.log('GetZep API error:', error);
  }

  // Try adding a message to the graph
  console.log('\nTrying to add a message to the graph...');
  const addResponse = await fetch('https://api.getzep.com/v3/graph/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ZEP_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Project-Id': PROJECT_ID
    },
    body: JSON.stringify({
      user_id: 'test_user_123',
      content: 'Testing GetZep integration with Agentopia. This is a test message to verify the knowledge graph works.',
      metadata: {
        source: 'e2e_test',
        timestamp: new Date().toISOString()
      }
    })
  });

  console.log('Add message response status:', addResponse.status);
  
  if (addResponse.ok) {
    const data = await addResponse.json();
    console.log('Message added successfully:', JSON.stringify(data, null, 2));
  } else {
    const error = await addResponse.text();
    console.log('Failed to add message:', error);
  }
}

testZepDirect().catch(console.error);
