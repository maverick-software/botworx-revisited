#!/usr/bin/env node

// SSH Key Verification Script
// Checks if SSH keys are properly stored and diagnoses test failures

import { createClient } from '@supabase/supabase-js';
import http from 'http';

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const DTMA_BEARER_TOKEN = process.env.DTMA_BEARER_TOKEN;
const DROPLET_IP = process.env.DROPLET_IP || '147.182.160.136';
const DTMA_PORT = process.env.DTMA_PORT || '30000';

console.log('🔍 SSH Key Storage & Test Failure Diagnosis');
console.log('==========================================\n');

// Check environment variables
console.log('📋 Environment Check:');
console.log(`  SUPABASE_URL: ${SUPABASE_URL ? '✓ Set' : '✗ Missing'}`);
console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing'}`);
console.log(`  DTMA_BEARER_TOKEN: ${DTMA_BEARER_TOKEN ? '✓ Set' : '✗ Missing'}`);
console.log(`  DROPLET_IP: ${DROPLET_IP}`);
console.log(`  DTMA_PORT: ${DTMA_PORT}\n`);

async function checkSSHKeysInDatabase() {
  console.log('🔑 Checking SSH Keys in Database...');
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('  ❌ Cannot check database - missing Supabase credentials');
    return false;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Check if user_ssh_keys table exists and has data
    const { data: sshKeys, error } = await supabase
      .from('user_ssh_keys')
      .select('*')
      .limit(10);

    if (error) {
      console.log(`  ❌ Database error: ${error.message}`);
      return false;
    }

    if (!sshKeys || sshKeys.length === 0) {
      console.log('  ⚠️  No SSH keys found in database');
      console.log('     This means SSH keys haven\'t been generated yet');
      return false;
    }

    console.log(`  ✅ Found ${sshKeys.length} SSH key(s) in database:`);
    sshKeys.forEach((key, index) => {
      console.log(`     ${index + 1}. User: ${key.user_id}`);
      console.log(`        Key Name: ${key.key_name}`);
      console.log(`        Fingerprint: ${key.fingerprint}`);
      console.log(`        Created: ${key.created_at}`);
      console.log(`        Public Vault ID: ${key.public_key_vault_id}`);
      console.log(`        Private Vault ID: ${key.private_key_vault_id || 'Not set'}`);
      console.log('');
    });

    return true;

  } catch (error) {
    console.log(`  ❌ Error checking database: ${error.message}`);
    return false;
  }
}

async function checkDropletConnectivity() {
  console.log('🌐 Checking Droplet Connectivity...');
  
  return new Promise((resolve) => {
    const req = http.request({
      hostname: DROPLET_IP,
      port: DTMA_PORT,
      path: '/health',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      console.log(`  ✅ Droplet responds on port ${DTMA_PORT} (HTTP ${res.statusCode})`);
      resolve(true);
    });

    req.on('error', (error) => {
      console.log(`  ❌ Cannot connect to droplet: ${error.message}`);
      console.log(`     Possible issues:`);
      console.log(`     - DTMA service not running`);
      console.log(`     - Port ${DTMA_PORT} blocked by firewall`);
      console.log(`     - Wrong IP address (${DROPLET_IP})`);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log(`  ❌ Connection timeout to ${DROPLET_IP}:${DTMA_PORT}`);
      resolve(false);
    });

    req.end();
  });
}

async function checkDTMAService() {
  console.log('🖥️  Checking DTMA Service Status...');
  
  if (!DTMA_BEARER_TOKEN) {
    console.log('  ❌ Cannot check DTMA - missing bearer token');
    return false;
  }

  return new Promise((resolve) => {
    const postData = JSON.stringify({ command: 'systemctl status dtma' });
    
    const req = http.request({
      hostname: DROPLET_IP,
      port: DTMA_PORT,
      path: '/ssh/execute',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DTMA_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.success) {
            console.log('  ✅ DTMA service status check successful');
            console.log(`     Output: ${response.stdout.substring(0, 200)}...`);
          } else {
            console.log('  ❌ DTMA service status check failed');
            console.log(`     Error: ${response.stderr}`);
          }
          resolve(response.success);
        } catch (e) {
          console.log('  ❌ Invalid response from DTMA service');
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`  ❌ DTMA service check failed: ${error.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log('  ❌ DTMA service check timeout');
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

async function checkSSHKeyGeneration() {
  console.log('🔧 Testing SSH Key Generation...');
  
  try {
    // Import the SSH utilities
    const { generateSSHKeyPair } = await import('../src/lib/utils/ssh_utils.js');
    
    const keyPair = await generateSSHKeyPair({
      type: 'ed25519',
      comment: 'test-key-verification'
    });

    console.log('  ✅ SSH key generation works');
    console.log(`     Key type: ${keyPair.keyType}`);
    console.log(`     Public key length: ${keyPair.publicKey.length} chars`);
    console.log(`     Private key length: ${keyPair.privateKey.length} chars`);
    console.log(`     Fingerprint: ${keyPair.fingerprint}`);
    
    return true;

  } catch (error) {
    console.log(`  ❌ SSH key generation failed: ${error.message}`);
    return false;
  }
}

async function diagnoseTestFailures() {
  console.log('\n🩺 Test Failure Diagnosis:');
  console.log('==========================');

  const issues = [];
  
  // Check each component
  const hasSSHKeys = await checkSSHKeysInDatabase();
  const canConnectToDroplet = await checkDropletConnectivity();
  const dtmaServiceOK = await checkDTMAService();
  const keyGenerationOK = await checkSSHKeyGeneration();

  console.log('\n📊 Summary:');
  console.log(`  SSH Keys in Database: ${hasSSHKeys ? '✅' : '❌'}`);
  console.log(`  Droplet Connectivity: ${canConnectToDroplet ? '✅' : '❌'}`);
  console.log(`  DTMA Service: ${dtmaServiceOK ? '✅' : '❌'}`);
  console.log(`  SSH Key Generation: ${keyGenerationOK ? '✅' : '❌'}`);

  // Provide specific recommendations
  console.log('\n💡 Recommendations:');
  
  if (!hasSSHKeys) {
    console.log('  1. SSH keys not found - run deployment to generate them:');
    console.log('     - Deploy an agent/toolbox through the UI');
    console.log('     - Or run: node scripts/store-ssh-keys.ts');
  }
  
  if (!canConnectToDroplet) {
    console.log('  2. Fix droplet connectivity:');
    console.log('     - SSH into droplet and check DTMA service');
    console.log('     - Verify firewall allows port 30000');
    console.log('     - Check if IP address is correct');
  }
  
  if (!dtmaServiceOK) {
    console.log('  3. Fix DTMA service:');
    console.log('     - SSH to droplet: ssh root@' + DROPLET_IP);
    console.log('     - Check status: systemctl status dtma');
    console.log('     - Start service: systemctl start dtma');
    console.log('     - Check logs: journalctl -u dtma -f');
  }
  
  if (!keyGenerationOK) {
    console.log('  4. Fix SSH key generation:');
    console.log('     - Check if crypto libraries are available');
    console.log('     - Verify Node.js version compatibility');
  }

  console.log('\n🎯 Next Steps:');
  if (!canConnectToDroplet) {
    console.log('  → Start by fixing droplet connectivity');
  } else if (!dtmaServiceOK) {
    console.log('  → DTMA service needs attention');
  } else if (!hasSSHKeys) {
    console.log('  → Generate SSH keys by deploying something');
  } else {
    console.log('  → All components look good - tests should work!');
  }
}

// Run the diagnosis
diagnoseTestFailures().catch(error => {
  console.error('💥 Diagnosis failed:', error);
  process.exit(1);
}); 