#!/usr/bin/env tsx

/**
 * Script to migrate existing SSH keys to Supabase Vault
 * 
 * Usage: npm run tsx scripts/migrate-ssh-keys-to-supabase.ts
 */

import fs from 'fs';
import path from 'path';
import { SSHKeyService } from '../src/services/ssh_key_service';
import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = process.env.USER_ID; // Set this to your user ID

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }

  if (!USER_ID) {
    console.error('❌ USER_ID environment variable is required');
    console.error('   Set USER_ID to your Supabase auth.users.id');
    process.exit(1);
  }

  console.log('🔐 SSH Key Migration to Supabase Vault');
  console.log('=====================================');

  const sshService = new SSHKeyService(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check if user already has SSH keys in Supabase
  const existingKeys = await sshService.listUserSSHKeys(USER_ID);
  if (existingKeys.length > 0) {
    console.log('📋 Existing SSH keys in Supabase:');
    existingKeys.forEach(key => {
      console.log(`  - ${key.key_name} (${key.fingerprint}) - ${key.created_at}`);
    });
    console.log('');
  }

  // Migrate local SSH keys
  await migrateLocalSSHKeys(sshService, USER_ID);

  // Generate new SSH key pair as example
  await generateNewSSHKeyExample(sshService, USER_ID);

  console.log('✅ Migration completed successfully!');
}

async function migrateLocalSSHKeys(sshService: SSHKeyService, userId: string) {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    console.log('⚠️  Could not determine home directory');
    return;
  }

  const sshDir = path.join(homeDir, '.ssh');
  
  // Common SSH key file patterns
  const keyPatterns = [
    { private: 'id_rsa', public: 'id_rsa.pub', name: 'default-rsa' },
    { private: 'id_ed25519', public: 'id_ed25519.pub', name: 'default-ed25519' },
    { private: 'id_ecdsa', public: 'id_ecdsa.pub', name: 'default-ecdsa' }
  ];

  console.log('🔍 Searching for local SSH keys...');
  
  for (const pattern of keyPatterns) {
    const privatePath = path.join(sshDir, pattern.private);
    const publicPath = path.join(sshDir, pattern.public);
    
    if (fs.existsSync(privatePath) && fs.existsSync(publicPath)) {
      try {
        console.log(`📁 Found SSH key pair: ${pattern.name}`);
        
        const privateKey = fs.readFileSync(privatePath, 'utf8');
        const publicKey = fs.readFileSync(publicPath, 'utf8');
        
        // Check if already exists in Supabase
        const existingKey = await sshService.getSSHKeyPair(userId, pattern.name);
        if (existingKey) {
          console.log(`   ⚠️  Key '${pattern.name}' already exists in Supabase - skipping`);
          continue;
        }
        
        // Store in Supabase Vault
        const result = await sshService.storeSSHKeyPair(
          userId,
          publicKey.trim(),
          privateKey.trim(),
          pattern.name
        );
        
        console.log(`   ✅ Stored '${pattern.name}' in Supabase Vault`);
        console.log(`      Public Key ID: ${result.publicKeyId}`);
        console.log(`      Private Key ID: ${result.privateKeyId}`);
        
      } catch (error) {
        console.error(`   ❌ Failed to store '${pattern.name}':`, error);
      }
    }
  }
}

async function generateNewSSHKeyExample(sshService: SSHKeyService, userId: string) {
  console.log('\n🔑 Example: Generating new SSH key pair...');
  
  try {
    const result = await sshService.generateAndStoreSSHKeyPair(
      userId,
      'agentopia-generated',
      'rsa'
    );
    
    console.log('✅ Generated and stored new SSH key:');
    console.log(`   Key Name: agentopia-generated`);
    console.log(`   Fingerprint: ${result.fingerprint}`);
    console.log(`   Public Key Vault ID: ${result.publicKeyId}`);
    console.log(`   Private Key Vault ID: ${result.privateKeyId}`);
    console.log('\n📝 Public key content:');
    console.log(result.publicKey);
    
  } catch (error) {
    console.error('❌ Failed to generate new SSH key:', error);
  }
}

async function testSSHKeyRetrieval(sshService: SSHKeyService, userId: string) {
  console.log('\n🧪 Testing SSH key retrieval...');
  
  const keyPair = await sshService.getSSHKeyPair(userId, 'default-rsa');
  if (keyPair) {
    console.log('✅ Successfully retrieved SSH key from Supabase Vault');
    console.log(`   Public key length: ${keyPair.publicKey.length} characters`);
    console.log(`   Private key length: ${keyPair.privateKey.length} characters`);
  } else {
    console.log('⚠️  No SSH key found with name "default-rsa"');
  }
}

// Run the migration
main().catch(error => {
  console.error('💥 Migration failed:', error);
  process.exit(1);
}); 