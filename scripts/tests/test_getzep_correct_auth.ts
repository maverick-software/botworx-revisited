import 'dotenv/config';

async function testGetZepCorrectAuth() {
  const GETZEP_API_KEY = (process.env.GETZEP_API_KEY ?? (() => { throw new Error('Set GETZEP_API_KEY before running this manual check.'); })());
  
  console.log('🔑 TESTING GETZEP WITH CORRECT AUTH FORMAT');
  console.log('=' .repeat(60));
  
  // Test 1: Try Api-Key header format
  console.log('\n1️⃣ Testing with Api-Key header...');
  const apiKeyResponse = await fetch('https://api.getzep.com/api/v2/users', {
    method: 'GET',
    headers: {
      'Api-Key': GETZEP_API_KEY,
      'Content-Type': 'application/json'
    }
  });
  console.log('   /api/v2/users with Api-Key:', apiKeyResponse.status, apiKeyResponse.statusText);
  
  if (apiKeyResponse.ok) {
    const data = await apiKeyResponse.json();
    console.log('   ✅ Success! Response:', JSON.stringify(data, null, 2));
  } else {
    const error = await apiKeyResponse.text();
    console.log('   Error body:', error);
  }
  
  // Test 2: Try different endpoints with Api-Key
  console.log('\n2️⃣ Testing other endpoints with Api-Key...');
  
  const endpoints = [
    '/api/v2/sessions',
    '/api/v2/memory',
    '/api/v2/graph',
    '/api/v2/health'
  ];
  
  for (const endpoint of endpoints) {
    const url = `https://api.getzep.com${endpoint}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Api-Key': GETZEP_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    console.log(`   ${endpoint}: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log('      ✅ This endpoint works!');
    }
  }
  
  // Test 3: Try creating a user
  console.log('\n3️⃣ Testing user creation...');
  const testUserId = 'test_user_' + Date.now();
  const createUserResponse = await fetch('https://api.getzep.com/api/v2/users', {
    method: 'POST',
    headers: {
      'Api-Key': GETZEP_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_id: testUserId,
      email: `${testUserId}@test.com`,
      first_name: 'Test',
      last_name: 'User'
    })
  });
  
  console.log('   Create user:', createUserResponse.status, createUserResponse.statusText);
  if (createUserResponse.ok) {
    const userData = await createUserResponse.json();
    console.log('   ✅ User created:', userData);
    
    // Test 4: Try adding memory for this user
    console.log('\n4️⃣ Testing memory addition...');
    const addMemoryResponse = await fetch(`https://api.getzep.com/api/v2/sessions/${testUserId}/memory`, {
      method: 'POST',
      headers: {
        'Api-Key': GETZEP_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'Hello, this is a test message for the knowledge graph.'
          },
          {
            role: 'assistant', 
            content: 'Hello! I understand you are testing the GetZep integration.'
          }
        ]
      })
    });
    
    console.log('   Add memory:', addMemoryResponse.status, addMemoryResponse.statusText);
    if (addMemoryResponse.ok) {
      console.log('   ✅ Memory added successfully!');
    } else {
      const memError = await addMemoryResponse.text();
      console.log('   Memory error:', memError);
    }
  } else {
    const createError = await createUserResponse.text();
    console.log('   Create user error:', createError);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 AUTH FORMAT SUMMARY:');
  console.log('');
  console.log('GetZep uses "Api-Key" header, not "Bearer"!');
  console.log('Correct format: { "Api-Key": "your_api_key" }');
  console.log('');
  console.log('We need to update our Edge Functions to use this format.');
}

testGetZepCorrectAuth().catch(console.error);
