// Check environment for both local and Supabase values
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Required variables for configuration
const requiredVars = [
  'DO_API_TOKEN',
  'DO_DEFAULT_REGION',
  'DO_DEFAULT_SIZE',
  'DO_DEFAULT_IMAGE',
  'DTMA_GIT_REPO_URL',
  'AGENTOPIA_API_URL'
];

// Optional variables
const optionalVars = [
  'DO_DEFAULT_SSH_KEY_IDS',
  'DTMA_GIT_BRANCH',
  'DO_BACKUP_ENABLED',
  'DO_MONITORING',
  'TEST_AGENT_ID'
];

async function checkEnvironment() {
  console.log('=== Agent Tool Infrastructure Environment Check ===\n');
  
  // Check required local environment variables
  console.log('Checking required local environment variables:');
  let missingRequired = false;
  
  for (const varName of requiredVars) {
    const exists = typeof process.env[varName] !== 'undefined' && process.env[varName] !== '';
    console.log(`- ${varName}: ${exists ? '✅ Found' : '❌ Missing'}`);
    if (!exists) missingRequired = true;
  }
  
  // Check optional local environment variables
  console.log('\nChecking optional local environment variables:');
  for (const varName of optionalVars) {
    const exists = typeof process.env[varName] !== 'undefined' && process.env[varName] !== '';
    console.log(`- ${varName}: ${exists ? '✅ Found' : '⚠️ Not found (optional)'}`);
  }
  
  if (missingRequired) {
    console.log('\n⚠️ Some required variables are missing from the local environment.');
    console.log('These might be available in Supabase Environment Variables instead.');
  } else {
    console.log('\n✅ All required variables are available in the local environment.');
  }
  
  // Check Supabase connection
  console.log('\nChecking Supabase Edge Functions connection:');
  const supabaseUrl = process.env.AGENTOPIA_API_URL || 'https://txhscptzjrrudnqwavcb.supabase.co/functions/v1';
  console.log(`URL: ${supabaseUrl}`);
  
  try {
    // Check heartbeat endpoint
    const response = await axios.get(`${supabaseUrl}/heartbeat`, { 
      validateStatus: () => true,
      timeout: 5000
    });
    
    console.log(`\n✅ Supabase Edge Functions URL is reachable`);
    console.log(`Status code: ${response.status}`);
    
    if (response.status === 401 || response.status === 403) {
      console.log('Authentication required (expected for unauthorized access)');
      console.log('This confirms the endpoint exists and requires authentication');
    } else if (response.status >= 200 && response.status < 300) {
      console.log('Endpoint returned success');
      console.log('Response:', response.data);
    } else {
      console.log(`Endpoint returned status ${response.status}`);
    }
  } catch (error) {
    console.error('\n❌ Error connecting to Supabase Edge Functions:');
    console.error(error.message);
  }
  
  // Test DigitalOcean API token if available
  if (process.env.DO_API_TOKEN) {
    console.log('\nChecking DigitalOcean API token:');
    try {
      const doResponse = await axios.get('https://api.digitalocean.com/v2/account', {
        headers: {
          'Authorization': `Bearer ${process.env.DO_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
      if (doResponse.data && doResponse.data.account) {
        console.log('✅ DigitalOcean API token is valid');
        console.log(`Account email: ${doResponse.data.account.email}`);
        console.log(`Account status: ${doResponse.data.account.status}`);
      } else {
        console.log('❌ DigitalOcean API returned unexpected response format');
      }
    } catch (error) {
      console.error('❌ Error with DigitalOcean API:');
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Message: ${error.response.data?.message || 'Unknown error'}`);
      } else {
        console.error(error.message);
      }
    }
  }
  
  console.log('\n=== Environment Check Complete ===');
}

// Run the check
checkEnvironment(); 