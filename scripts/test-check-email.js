/**
 * Test script for check-email-exists edge function
 * 
 * Tests:
 * 1. Existing email should return exists: true
 * 2. New email should return exists: false
 */

const SUPABASE_URL = 'https://txhscptzjrrudnqwavcb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4aHNjcHR6anJydWRucXdhdmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTM5NzUxODAsImV4cCI6MjAyOTU1MTE4MH0.dnjZ_6lJvx3ZNUtm67jTgEMCPy_ViMOHuJuPmWbnW1E';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/check-email-exists`;

async function testEmailCheck(email, expectedExists) {
  console.log(`\n🧪 Testing: ${email}`);
  console.log(`   Expected: exists=${expectedExists}`);
  
  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    
    console.log(`   Response: ${JSON.stringify(data)}`);
    
    if (response.ok && data.exists === expectedExists) {
      console.log(`   ✅ PASS`);
      return true;
    } else {
      console.log(`   ❌ FAIL`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ ERROR:`, error.message);
    return false;
  }
}

async function runTests() {
  console.log('========================================');
  console.log('Testing check-email-exists Edge Function');
  console.log('========================================');

  const results = [];

  // Test 1: Existing email
  results.push(await testEmailCheck('charles.r.sears@gmail.com', true));

  // Test 2: Non-existing email
  results.push(await testEmailCheck('nonexistent-user-12345@example.com', false));

  // Test 3: Another existing email
  results.push(await testEmailCheck('sears093@gmail.com', true));

  console.log('\n========================================');
  console.log('Test Results');
  console.log('========================================');
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed');
  }
}

runTests();


