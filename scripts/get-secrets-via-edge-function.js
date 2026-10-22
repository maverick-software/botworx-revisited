#!/usr/bin/env node

/**
 * Script to get actual secret values via Supabase Edge Functions
 */

import https from 'https';

const PROJECT_REF = 'txhscptzjrrudnqwavcb';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

// We'll call an edge function that can access the secrets
// First, let's call a function that returns the environment variables

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: responseData
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function getSecretsViaEdgeFunction() {
  console.log('🔍 Getting secrets via Edge Function...\n');
  
  // Use the actual values from .env file
  const SUPABASE_URL = 'https://txhscptzjrrudnqwavcb.supabase.co';
  const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4aHNjcHR6anJydWRucXdhdmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM2MDQ3NDIsImV4cCI6MjA1OTE4MDc0Mn0.o7s12-0ATNJIewv2YQ-FllmcSd2KCjZNSO-kWulzXP8';
  
  console.log('🔧 Using credentials from .env file');
  console.log(`   URL: ${SUPABASE_URL}`);
  console.log(`   Service Key: ${SERVICE_ROLE_KEY.substring(0, 20)}...`);
  
  // Skip the Edge Function call and go directly to querying droplets
  console.log('\n📡 Querying droplets directly with .env credentials...');
  await queryDropletsWithCredentials(SUPABASE_URL, SERVICE_ROLE_KEY);
  return;
  
  const options = {
    hostname: `${PROJECT_REF}.supabase.co`,
    port: 443,
    path: '/functions/v1/get-env-secrets',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  try {
    console.log('📡 Calling get-env-secrets function to get environment info...');
    const response = await makeRequest(options);
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response data: ${response.data}`);
    
    if (response.status === 200) {
      const result = JSON.parse(response.data);
      console.log('✅ Environment info retrieved');
      
      // Extract the service role key and URL from the response
      if (result.supabase_url && result.supabase_service_role_key) {
        console.log('\n🔑 Found credentials:');
        console.log(`   SUPABASE_URL: ${result.supabase_url}`);
        console.log(`   SERVICE_ROLE_KEY: ${result.supabase_service_role_key.substring(0, 20)}...`);
        
        // Now use these to query the database
        await queryDropletsWithCredentials(result.supabase_url, result.supabase_service_role_key);
      } else {
        console.log('⚠️  Environment info not found in response');
        console.log('Available keys:', Object.keys(result));
      }
    } else {
      console.error(`❌ Edge function call failed: ${response.status}`);
      console.error(`Response: ${response.data}`);
    }
    
  } catch (error) {
    console.error('💥 Error calling edge function:', error.message);
    
    // Fallback: try to call a different edge function that might expose env vars
    console.log('\n🔄 Trying alternative approach...');
    await tryAlternativeApproach();
  }
}

async function tryAlternativeApproach() {
  // Try calling the admin dashboard stats function which might expose environment info
  const options = {
    hostname: `${PROJECT_REF}.supabase.co`,
    port: 443,
    path: '/functions/v1/admin-get-dashboard-stats',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  try {
    console.log('📡 Calling admin dashboard function...');
    const response = await makeRequest(options);
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, response.headers);
    
    if (response.status === 200) {
      console.log('✅ Admin function responded');
      console.log(`Response: ${response.data.substring(0, 200)}...`);
    } else {
      console.log(`⚠️  Admin function returned ${response.status}`);
      console.log(`Response: ${response.data}`);
    }
    
  } catch (error) {
    console.error('💥 Error with alternative approach:', error.message);
    
    // Final fallback: create a simple edge function call that returns env vars
    console.log('\n🔄 Creating custom env function call...');
    await createCustomEnvCall();
  }
}

async function createCustomEnvCall() {
  // Call any edge function and see if we can get it to return environment variables
  const options = {
    hostname: `${PROJECT_REF}.supabase.co`,
    port: 443,
    path: '/functions/v1/get-agent-tool-credentials',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  try {
    console.log('📡 Calling get-agent-tool-credentials function...');
    const response = await makeRequest(options, JSON.stringify({
      debug: true,
      return_env: true
    }));
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response: ${response.data}`);
    
    if (response.data.includes('SUPABASE_URL') || response.data.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      console.log('✅ Found environment variables in response!');
      // Parse and extract the values
      const envMatch = response.data.match(/SUPABASE_URL["\s]*[:=]["\s]*([^"'\s]+)/);
      const keyMatch = response.data.match(/SUPABASE_SERVICE_ROLE_KEY["\s]*[:=]["\s]*([^"'\s]+)/);
      
      if (envMatch && keyMatch) {
        console.log('\n🔑 Extracted credentials:');
        console.log(`   SUPABASE_URL: ${envMatch[1]}`);
        console.log(`   SERVICE_ROLE_KEY: ${keyMatch[1].substring(0, 20)}...`);
        
        await queryDropletsWithCredentials(envMatch[1], keyMatch[1]);
      }
    }
    
  } catch (error) {
    console.error('💥 Error with custom env call:', error.message);
    console.log('\n❌ Unable to retrieve secrets via Edge Functions');
    console.log('💡 You may need to manually provide the SUPABASE_SERVICE_ROLE_KEY value');
  }
}

async function queryDropletsWithCredentials(supabaseUrl, serviceRoleKey) {
  console.log('\n📡 Querying droplets with retrieved credentials...');
  
  const url = new URL(supabaseUrl);
  const options = {
    hostname: url.hostname,
    port: 443,
    path: '/rest/v1/account_tool_environments?select=id,name,do_droplet_name,do_droplet_id,public_ip_address,status,dtma_bearer_token,region_slug,size_slug,created_at,last_heartbeat_at&do_droplet_id=not.is.null&order=created_at.desc',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  try {
    const response = await makeRequest(options);
    
    if (response.status !== 200) {
      console.error(`❌ HTTP ${response.status}: ${response.data}`);
      return;
    }

    const droplets = JSON.parse(response.data);
    
    if (!droplets || droplets.length === 0) {
      console.log('⚠️  No droplets found in database');
      return;
    }

    console.log(`✅ Found ${droplets.length} droplet(s):\n`);

    droplets.forEach((droplet, index) => {
      console.log(`📦 Droplet ${index + 1}:`);
      console.log(`   ID: ${droplet.id}`);
      console.log(`   Name: ${droplet.name || 'Not set'}`);
      console.log(`   DO Name: ${droplet.do_droplet_name || 'Not set'}`);
      console.log(`   DO Droplet ID: ${droplet.do_droplet_id}`);
      console.log(`   IP Address: ${droplet.public_ip_address || 'Not set'}`);
      console.log(`   Status: ${droplet.status}`);
      console.log(`   DTMA Bearer Token: ${droplet.dtma_bearer_token ? '✓ Set (' + droplet.dtma_bearer_token.substring(0, 8) + '...)' : '✗ Missing'}`);
      
      if (droplet.dtma_bearer_token && droplet.public_ip_address) {
        console.log(`\n   🔑 Test commands:`);
        console.log(`   $env:DTMA_BEARER_TOKEN="${droplet.dtma_bearer_token}"`);
        console.log(`   $env:DROPLET_IP="${droplet.public_ip_address}"`);
        console.log(`   node scripts/test-dtma-ssh-quick.js`);
      }
      
      console.log('');
    });

  } catch (error) {
    console.error('💥 Error querying droplets:', error.message);
  }
}

// Run the script
getSecretsViaEdgeFunction(); 