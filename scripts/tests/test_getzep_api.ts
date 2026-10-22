import 'dotenv/config';

async function testGetZepAPI() {
  // The API key from your previous messages
  const GETZEP_API_KEY = (process.env.GETZEP_API_KEY ?? (() => { throw new Error('Set GETZEP_API_KEY before running this manual check.'); })());
  
  console.log('🧪 TESTING GETZEP API ENDPOINTS');
  console.log('=' .repeat(60));
  
  // Test 1: Basic health check
  console.log('\n1️⃣ Testing basic API access...');
  const healthResponse = await fetch('https://api.getzep.com/healthz', {
    method: 'GET'
  });
  console.log('   Health check:', healthResponse.status, healthResponse.statusText);
  
  // Test 2: Try v2 API
  console.log('\n2️⃣ Testing v2 API...');
  const v2Response = await fetch('https://api.getzep.com/api/v2/health', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${GETZEP_API_KEY}`
    }
  });
  console.log('   v2 health:', v2Response.status, v2Response.statusText);
  
  // Test 3: Try v3 without project ID
  console.log('\n3️⃣ Testing v3 API without project ID...');
  const v3Response = await fetch('https://api.getzep.com/v3/me', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${GETZEP_API_KEY}`
    }
  });
  console.log('   v3/me:', v3Response.status, v3Response.statusText);
  if (v3Response.ok) {
    const data = await v3Response.json();
    console.log('   Response:', JSON.stringify(data, null, 2));
  }
  
  // Test 4: Try the graph endpoint with different paths
  console.log('\n4️⃣ Testing graph endpoints...');
  
  const endpoints = [
    '/api/v2/graph',
    '/api/v3/graph',
    '/v2/graph',
    '/v3/graph',
    '/graph'
  ];
  
  for (const endpoint of endpoints) {
    const url = `https://api.getzep.com${endpoint}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GETZEP_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(`   ${endpoint}: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log('      ✅ This endpoint works!');
      break;
    }
  }
  
  // Test 5: Try adding data with v2 API
  console.log('\n5️⃣ Testing v2 graph.add...');
  try {
    // Import the SDK
    const { ZepClient } = await import('@getzep/zep-cloud');
    const client = new ZepClient({ apiKey: GETZEP_API_KEY });
    
    if (client && client.graph && client.graph.add) {
      const result = await client.graph.add({
        userId: 'test_user_' + Date.now(),
        type: 'text',
        data: 'Test message from API test'
      });
      console.log('   ✅ SDK graph.add worked!', result);
    } else {
      console.log('   ❌ SDK missing graph.add method');
    }
  } catch (error: any) {
    console.error('   ❌ SDK error:', error.message);
    if (error.statusCode) {
      console.log('      Status:', error.statusCode);
      console.log('      Body:', error.body);
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 SUMMARY:');
  console.log('');
  console.log('If you\'re getting 401 errors, the API key is invalid.');
  console.log('If you\'re getting 404 errors, the endpoint is wrong.');
  console.log('');
  console.log('You may need to:');
  console.log('1. Get a new API key from GetZep dashboard');
  console.log('2. Update the endpoints to match their current API');
  console.log('3. Check their documentation for changes');
}

testGetZepAPI().catch(console.error);
