#!/usr/bin/env node

/**
 * Script to get DTMA bearer token for existing droplets
 * This will help us test the DTMA endpoints with the correct token
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Add fetch polyfill for Node.js if needed
if (!globalThis.fetch) {
  const { default: fetch } = await import('node-fetch');
  globalThis.fetch = fetch;
}

// From the Supabase secrets, we can see SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mailbensnyodigital.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Supabase Configuration:');
console.log(`   URL: ${SUPABASE_URL}`);
console.log(`   Service Key: ${SUPABASE_SERVICE_ROLE_KEY ? '✓ Set (' + SUPABASE_SERVICE_ROLE_KEY.substring(0, 8) + '...)' : '✗ Missing'}`);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n❌ Missing required environment variables');
  console.error('From the Supabase dashboard secrets, we need:');
  console.error('   SUPABASE_URL (visible in secrets)');
  console.error('   SUPABASE_SERVICE_ROLE_KEY (visible in secrets)');
  console.error('\nPlease copy these values from the Supabase Edge Function Secrets');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getDropletInfo() {
  console.log('🔍 Retrieving Droplet Information from Database...\n');
  
  try {
    // Get all active droplets with their bearer tokens
    const { data: droplets, error } = await supabase
      .from('account_tool_environments')
      .select(`
        id,
        name,
        do_droplet_name,
        do_droplet_id,
        public_ip_address,
        status,
        dtma_bearer_token,
        region_slug,
        size_slug,
        created_at,
        last_heartbeat_at
      `)
      .not('do_droplet_id', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching droplets:', error.message);
      return;
    }

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
        console.log(`\n   🔑 To test this droplet, set:`);
        console.log(`   export DTMA_BEARER_TOKEN="${droplet.dtma_bearer_token}"`);
        console.log(`   export DROPLET_IP="${droplet.public_ip_address}"`);
        console.log(`\n   Then run: node scripts/test-dtma-ssh-quick.js`);
      }
      
      console.log('');
    });

    // Show the most recent active droplet info
    const activeDroplet = droplets.find(d => d.status === 'active');
    if (activeDroplet && activeDroplet.dtma_bearer_token) {
      console.log('🎯 Most Recent Active Droplet:');
      console.log(`   IP: ${activeDroplet.public_ip_address}`);
      console.log(`   Token: ${activeDroplet.dtma_bearer_token}`);
      console.log('\n💡 Quick test command:');
      console.log(`   DTMA_BEARER_TOKEN="${activeDroplet.dtma_bearer_token}" DROPLET_IP="${activeDroplet.public_ip_address}" node scripts/test-dtma-ssh-quick.js`);
    }

  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

async function main() {
  await getDropletInfo();
}

main().catch(console.error); 