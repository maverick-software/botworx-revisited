// Script to check DigitalOcean API token and Supabase Edge Functions
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Get the token
const API_TOKEN = process.env.DO_API_TOKEN;
const SUPABASE_URL = process.env.AGENTOPIA_API_URL || 'https://txhscptzjrrudnqwavcb.supabase.co/functions/v1';

async function checkConnections() {
  console.log('=== Checking API Connections ===\n');
  
  // Check DigitalOcean API token
  await checkDigitalOcean();
  
  // Check Supabase Edge Functions
  await checkSupabase();
}

async function checkDigitalOcean() {
  if (!API_TOKEN) {
    console.error('ERROR: DO_API_TOKEN environment variable is required');
    return;
  }

  console.log('Checking DigitalOcean API token...');
  
  try {
    // Make a direct API call to the DigitalOcean API
    const response = await axios.get('https://api.digitalocean.com/v2/account', {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && response.data.account) {
      console.log('\n✅ DigitalOcean API token is valid!');
      console.log('Account information:');
      console.log(`Email: ${response.data.account.email}`);
      console.log(`Status: ${response.data.account.status}`);
      
      // Get droplet limit
      console.log('\nAccount limits:');
      console.log(`Droplet limit: ${response.data.account.droplet_limit}`);
    } else {
      console.error('\n❌ Unexpected API response format');
      console.log(JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.error('\n❌ Error checking DigitalOcean API token:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${error.response.data?.message || 'Unknown error'}`);
    } else if (error.request) {
      console.error('No response received from DigitalOcean API');
    } else {
      console.error(`Error: ${error.message}`);
    }
    
    console.log('\nPlease verify:');
    console.log('1. Your DO_API_TOKEN is correct');
    console.log('2. The token has not expired');
    console.log('3. The token has sufficient permissions (read/write)');
  }
}

async function checkSupabase() {
  console.log('\nChecking Supabase Edge Functions connection...');
  console.log(`URL: ${SUPABASE_URL}`);
  
  try {
    // Just check if the URL is reachable
    const response = await axios.get(`${SUPABASE_URL}/heartbeat`, { 
      validateStatus: () => true, // Accept any status code
      timeout: 5000
    });
    
    console.log(`\n✅ Supabase Edge Functions URL is reachable`);
    console.log(`Status code: ${response.status}`);
    
    if (response.status === 401 || response.status === 403) {
      console.log('Authentication required (expected for unauthorized access)');
      console.log('This is normal - it confirms the endpoint exists and requires auth');
    } else if (response.status >= 200 && response.status < 300) {
      console.log('Endpoint returned success status');
      if (response.data) {
        console.log('Response data:', response.data);
      }
    } else {
      console.log(`Endpoint returned status ${response.status}`);
    }
  } catch (error) {
    console.error('\n❌ Error checking Supabase Edge Functions:');
    if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused. The Supabase Edge Functions may not be accessible');
    } else if (error.code === 'ENOTFOUND') {
      console.error('Domain not found. Check the URL for typos');
    } else {
      console.error(`Error: ${error.message}`);
    }
    
    console.log('\nPlease verify:');
    console.log('1. Your AGENTOPIA_API_URL is correct');
    console.log('2. The Supabase project is active and edge functions are deployed');
  }
}

// Run all checks
checkConnections(); 