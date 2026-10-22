#!/usr/bin/env node

/**
 * Initialize WebSocket server secrets in Supabase Vault
 * Run with: node initialize-vault-secrets.js YOUR_ADMIN_PASSWORD
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://txhscptzjrrudnqwavcb.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');

const adminPassword = process.argv[2] || 'ChangeThisPassword123!';

if (adminPassword === 'ChangeThisPassword123!') {
  console.warn('⚠️  WARNING: Using default password. Please provide a secure password as argument!');
  console.warn('   Usage: node initialize-vault-secrets.js YOUR_SECURE_PASSWORD\n');
}

async function initializeVaultSecrets() {
  console.log('🔒 Initializing WebSocket Server Secrets in Supabase Vault...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data, error } = await supabase.rpc('initialize_websocket_server_secrets', {
      p_server_name: 'voice-websocket-server',
      p_supabase_service_key: SUPABASE_SERVICE_KEY,
      p_admin_password: adminPassword
    });

    if (error) {
      console.error('❌ Failed to initialize secrets:', error.message);
      process.exit(1);
    }

    console.log('✅ Success! Secrets initialized in Supabase Vault:\n');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n📋 Next Steps:');
    console.log('1. SSH into your droplet: ssh root@165.227.188.122');
    console.log('2. Deploy vault-enabled server: cd /opt/agentopia-voice-ws && bash deploy-with-vault.sh');
    console.log('3. Access admin dashboard: https://voice.gofragents.com/admin');
    console.log(`4. Login with: admin / ${adminPassword}\n`);

  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

initializeVaultSecrets();

