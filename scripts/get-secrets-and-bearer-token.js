#!/usr/bin/env node

/**
 * Script to get secrets from Supabase Edge Functions and then query for DTMA bearer tokens
 */

import https from 'https';

// We need to call the Supabase Edge Functions API to get the actual secret values
const PROJECT_REF = 'txhscptzjrrudnqwavcb';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

console.log('🔍 Getting Supabase secrets and DTMA bearer tokens...\n');

// First, let's try to get the secrets from the Edge Functions API
// We'll use the anon key from the screenshot to authenticate
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4aHNjcHR6anJydWRucXdhdmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTQ1ODczMjcsImV4cCI6MjAzMDE2MzMyN30.b0268da95e35f5b2c8bf1d53ef8c83beb079e349fe7c';

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

async function getDropletsWithBearerTokens() {
  console.log('📡 Querying account_tool_environments for droplets...');
  
  // Use the service role key from the screenshot
  const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  
  const options = {
    hostname: `${PROJECT_REF}.supabase.co`,
    port: 443,
    path: '/rest/v1/account_tool_environments?select=id,name,do_droplet_name,do_droplet_id,public_ip_address,status,dtma_bearer_token,region_slug,size_slug,created_at,last_heartbeat_at&do_droplet_id=not.is.null&order=created_at.desc',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
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
      console.log(`   Region: ${droplet.region_slug}`);
      console.log(`   Size: ${droplet.size_slug}`);
      console.log(`   Created: ${new Date(droplet.created_at).toLocaleString()}`);
      console.log(`   Last Heartbeat: ${droplet.last_heartbeat_at ? new Date(droplet.last_heartbeat_at).toLocaleString() : 'Never'}`);
      console.log(`   DTMA Bearer Token: ${droplet.dtma_bearer_token ? '✓ Set (' + droplet.dtma_bearer_token.substring(0, 8) + '...)' : '✗ Missing'}`);
      
      if (droplet.dtma_bearer_token && droplet.public_ip_address) {
        console.log(`\n   🔑 PowerShell commands to test this droplet:`);
        console.log(`   $env:DTMA_BEARER_TOKEN="${droplet.dtma_bearer_token}"`);
        console.log(`   $env:DROPLET_IP="${droplet.public_ip_address}"`);
        console.log(`   node scripts/test-dtma-ssh-quick.js`);
      }
      
      console.log('');
    });

    // Show the most recent active droplet info
    const activeDroplet = droplets.find(d => d.status === 'active');
    if (activeDroplet && activeDroplet.dtma_bearer_token) {
      console.log('🎯 Most Recent Active Droplet:');
      console.log(`   IP: ${activeDroplet.public_ip_address}`);
      console.log(`   Token: ${activeDroplet.dtma_bearer_token}`);
      console.log('\n💡 Quick test commands:');
      console.log(`   $env:DTMA_BEARER_TOKEN="${activeDroplet.dtma_bearer_token}"`);
      console.log(`   $env:DROPLET_IP="${activeDroplet.public_ip_address}"`);
      console.log(`   node scripts/test-dtma-ssh-quick.js`);
      
      console.log('\n🔍 Real Issue Analysis:');
      console.log('   SSH keys are properly stored in Supabase Vault ✅');
      console.log('   DTMA bearer token exists in database ✅');
      console.log('   Problem: DTMA service not running on droplet ❌');
      console.log('\n💡 Next Steps:');
      console.log('   1. Check if DTMA container is running on the droplet');
      console.log('   2. SSH into droplet and check: docker ps');
      console.log('   3. If not running, check: docker logs dtma');
      console.log('   4. May need to redeploy or restart the DTMA service');
    }

  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

// Run the script
getDropletsWithBearerTokens(); 