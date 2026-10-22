import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL!;
  const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, { 
    auth: { persistSession: false } 
  });

  console.log('Setting up Vault Encryption Key System\n');
  console.log('=' .repeat(50));

  // Step 1: Create a dedicated encryption key for vault operations
  console.log('\n1. Creating a dedicated encryption key for vault...');
  
  const { data: keyData, error: keyError } = await supabase.rpc('sql', {
    query: "SELECT pgsodium.create_key(name := 'vault_master_key') as key_id"
  }).catch(async () => {
    // If sql RPC doesn't exist, try through a custom function
    console.log('   sql RPC not available, trying alternative...');
    return { data: null, error: 'sql RPC not available' };
  });

  if (keyError || !keyData) {
    console.log('   Could not create key via SQL RPC');
    
    // Let's create a wrapper function to create keys
    console.log('   Creating a wrapper function for key creation...');
    
    const { error: funcError } = await supabase.rpc('sql', {
      query: `
        CREATE OR REPLACE FUNCTION public.create_vault_key()
        RETURNS UUID AS $$
        DECLARE
            new_key_id UUID;
        BEGIN
            -- Create a new encryption key
            SELECT pgsodium.create_key(name := 'vault_master_key_' || gen_random_uuid()::text) 
            INTO new_key_id;
            RETURN new_key_id;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    }).catch(() => ({ error: 'Cannot create function via RPC' }));

    if (funcError) {
      console.log('   Cannot create wrapper function');
    }
  } else {
    console.log(`   Created key: ${keyData}`);
  }

  // Step 2: Test encryption with explicit key
  console.log('\n2. Testing manual encryption/decryption with pgsodium...');
  
  const testValue = 'Test secret value';
  const testNonce = crypto.getRandomValues(new Uint8Array(24));
  const nonceHex = Array.from(testNonce).map(b => b.toString(16).padStart(2, '0')).join('');
  
  console.log(`   Value to encrypt: "${testValue}"`);
  console.log(`   Nonce: ${nonceHex.substring(0, 20)}...`);

  // Try to get the first available key
  const { data: keyList, error: listError } = await supabase.rpc('sql', {
    query: "SELECT id, name FROM pgsodium.valid_key LIMIT 1"
  }).catch(async () => {
    console.log('   Cannot list keys directly');
    return { data: null, error: 'Cannot access pgsodium.valid_key' };
  });

  if (keyList && keyList.length > 0) {
    const keyId = keyList[0].id;
    console.log(`   Using key: ${keyId}`);
    
    // Test direct encryption
    const { data: encrypted, error: encError } = await supabase.rpc('sql', {
      query: `
        SELECT encode(
          pgsodium.crypto_aead_det_encrypt(
            'Test value'::bytea,
            'vault_context'::bytea,
            '${keyId}'::uuid,
            decode('${nonceHex}', 'hex')
          ), 
          'hex'
        ) as encrypted
      `
    }).catch(() => ({ data: null, error: 'Encryption failed' }));

    if (encrypted) {
      console.log(`   Encrypted: ${encrypted[0].encrypted.substring(0, 40)}...`);
      
      // Try to decrypt
      const { data: decrypted, error: decError } = await supabase.rpc('sql', {
        query: `
          SELECT convert_from(
            pgsodium.crypto_aead_det_decrypt(
              decode('${encrypted[0].encrypted}', 'hex'),
              'vault_context'::bytea,
              '${keyId}'::uuid,
              decode('${nonceHex}', 'hex')
            ),
            'UTF8'
          ) as decrypted
        `
      }).catch(() => ({ data: null, error: 'Decryption failed' }));

      if (decrypted) {
        console.log(`   Decrypted: "${decrypted[0].decrypted}"`);
        console.log(`   ✅ Manual encryption/decryption works!`);
      } else {
        console.log(`   ❌ Decryption failed`);
      }
    } else {
      console.log(`   ❌ Encryption failed`);
    }
  }

  // Step 3: Check how vault.create_secret actually works
  console.log('\n3. Analyzing vault.create_secret implementation...');
  
  const { data: vaultImpl, error: implError } = await supabase.rpc('sql', {
    query: `
      SELECT 
        pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'vault' AND p.proname = 'create_secret'
      LIMIT 1
    `
  }).catch(() => ({ data: null, error: 'Cannot inspect vault functions' }));

  if (vaultImpl && vaultImpl.length > 0) {
    console.log('   Vault implementation found (truncated):');
    console.log('   ' + vaultImpl[0].definition.substring(0, 200) + '...');
  } else {
    console.log('   Cannot inspect vault.create_secret implementation');
  }

  console.log('\n' + '=' .repeat(50));
  console.log('ANALYSIS:');
  console.log('The vault system uses pgsodium for encryption, but the key management');
  console.log('is handled internally by Supabase. The issue is likely that:');
  console.log('1. The vault uses a specific key that is not accessible to us');
  console.log('2. The key might be stored in environment variables on the server');
  console.log('3. We cannot directly set or access this key from client-side');
  console.log('\nThe workaround of storing API keys directly (unencrypted) is currently');
  console.log('the most practical solution for this Supabase project.');
}

main().catch(console.error);
