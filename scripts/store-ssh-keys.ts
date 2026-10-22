#!/usr/bin/env tsx

/**
 * Simple script to store your SSH keys in Supabase Vault
 * 
 * Usage: npm run tsx scripts/store-ssh-keys.ts
 */

import fs from 'fs';
import path from 'path';
import { storeUserSSHKey } from '../src/services/ssh_key_service';

// Configuration - you'll need to set these
const USER_ID = process.env.USER_ID || 'your-user-id-here'; // Get this from Supabase auth.users table
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log('🔐 Storing SSH Keys in Supabase Vault');
  console.log('===================================');

  // Validation
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('   VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }

  if (USER_ID === 'your-user-id-here') {
    console.error('❌ Please set your USER_ID:');
    console.error('   1. Go to your Supabase dashboard -> Authentication -> Users');
    console.error('   2. Find your user and copy the ID');
    console.error('   3. Set USER_ID environment variable or update this script');
    process.exit(1);
  }

  // Get your SSH keys from the Windows .ssh directory
  const homeDir = process.env.USERPROFILE;
  if (!homeDir) {
    console.error('❌ Could not determine user home directory');
    process.exit(1);
  }

  const privatePath = path.join(homeDir, '.ssh', 'id_rsa');
  const publicPath = path.join(homeDir, '.ssh', 'id_rsa.pub');

  // Check if SSH keys exist
  if (!fs.existsSync(privatePath) || !fs.existsSync(publicPath)) {
    console.error('❌ SSH keys not found at:');
    console.error(`   Private: ${privatePath}`);
    console.error(`   Public: ${publicPath}`);
    console.error('   Please make sure your SSH keys exist');
    process.exit(1);
  }

  try {
    // Read the SSH keys
    console.log('📖 Reading SSH keys...');
    const privateKey = fs.readFileSync(privatePath, 'utf8');
    const publicKey = fs.readFileSync(publicPath, 'utf8');

    console.log(`   ✅ Private key: ${privateKey.length} characters`);
    console.log(`   ✅ Public key: ${publicKey.length} characters`);

    // Store in Supabase Vault
    console.log('\n🔒 Storing in Supabase Vault...');
    const result = await storeUserSSHKey(
      USER_ID,
      publicKey.trim(),
      privateKey.trim(),
      'digitalocean-access'
    );

    console.log('🎉 Success! SSH keys stored in Supabase Vault:');
    console.log(`   Public Key Vault ID: ${result.publicKeyId}`);
    console.log(`   Private Key Vault ID: ${result.privateKeyId}`);
    console.log('\n📝 What happens next:');
    console.log('   1. Your SSH keys are now securely stored in Supabase Vault');
    console.log('   2. Only vault IDs are stored in the database table');
    console.log('   3. Your DigitalOcean droplets can now use these keys automatically');
    console.log('   4. You can delete the local .ssh keys if desired (they\'re backed up in Supabase)');

  } catch (error) {
    console.error('💥 Error storing SSH keys:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
}); 