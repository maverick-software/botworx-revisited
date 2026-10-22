#!/usr/bin/env node

/**
 * Simple script to get DTMA bearer token using direct REST API
 */

import https from 'https';

const SUPABASE_URL = 'https://txhscptzjrrudnqwavcb.supabase.co';
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');

console.log('🔍 Fetching Droplet Information...\n');

const options = {
  hostname: 'txhscptzjrrudnqwavcb.supabase.co',
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

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      if (res.statusCode !== 200) {
        console.error(`❌ HTTP ${res.statusCode}: ${data}`);
        return;
      }

      const droplets = JSON.parse(data);
      
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
          console.log(`\n   🔑 To test this droplet:`);
          console.log(`   set DTMA_BEARER_TOKEN=${droplet.dtma_bearer_token}`);
          console.log(`   set DROPLET_IP=${droplet.public_ip_address}`);
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
        console.log(`   set DTMA_BEARER_TOKEN=${activeDroplet.dtma_bearer_token}`);
        console.log(`   set DROPLET_IP=${activeDroplet.public_ip_address}`);
        console.log(`   node scripts/test-dtma-ssh-quick.js`);
      }

    } catch (error) {
      console.error('💥 Error parsing response:', error.message);
      console.error('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('💥 Request error:', error.message);
});

req.end(); 