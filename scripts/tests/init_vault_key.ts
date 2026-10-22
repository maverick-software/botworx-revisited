import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL!;
  const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, { 
    auth: { persistSession: false } 
  });

  console.log('Checking and initializing vault encryption keys...\n');

  // Check if pgsodium has any keys
  console.log('1. Checking existing keys...');
  try {
    const { data: keyList, error: keyListError } = await supabase.rpc('sql', {
      query: "SELECT id, name, created FROM pgsodium.valid_key LIMIT 5"
    });
    
    if (keyListError) {
      console.log('Could not list keys:', keyListError.message);
      
      // Try to check if there's a default key
      const { data: defaultKey, error: defaultKeyError } = await supabase.rpc('sql', {
        query: "SELECT pgsodium.get_key_id_by_name('default') as key_id"
      });
      
      if (defaultKeyError) {
        console.log('No default key found:', defaultKeyError.message);
      } else {
        console.log('Default key ID:', defaultKey);
      }
    } else {
      console.log('Existing keys:', keyList);
    }
  } catch (e) {
    console.log('Keys check failed:', e);
  }

  // Try to create a new key
  console.log('\n2. Creating a new encryption key...');
  try {
    const { data: newKey, error: newKeyError } = await supabase.rpc('sql', {
      query: "SELECT pgsodium.create_key(name := 'vault_key_' || gen_random_uuid()::text) as new_key_id"
    });
    
    if (newKeyError) {
      console.log('Could not create key:', newKeyError.message);
    } else {
      console.log('Created new key:', newKey);
      
      // Try to set it as the default for vault
      const keyId = newKey?.[0]?.new_key_id;
      if (keyId) {
        console.log('\n3. Setting as vault default key...');
        const { error: setError } = await supabase.rpc('sql', {
          query: `SELECT pgsodium.set_config('vault.key_id', '${keyId}', false)`
        });
        
        if (setError) {
          console.log('Could not set vault key:', setError.message);
        } else {
          console.log('Set vault key successfully');
        }
      }
    }
  } catch (e) {
    console.log('Key creation failed:', e);
  }

  // Test if vault works now
  console.log('\n4. Testing vault with new key...');
  const testName = `test_with_key_${Date.now()}`;
  const { data: secretId, error: createError } = await supabase.rpc('create_vault_secret', {
    p_secret: 'test_value',
    p_name: testName,
    p_description: 'Testing with initialized key'
  });

  if (createError) {
    console.log('Failed to create secret:', createError.message);
  } else {
    console.log('Created secret:', secretId);
    
    // Try to decrypt it
    const { data: decrypted, error: decryptError } = await supabase.rpc('vault_decrypt', {
      vault_id: secretId
    });
    
    if (decryptError) {
      console.log('Decryption still failed:', decryptError.message);
    } else {
      console.log('Successfully decrypted:', decrypted);
    }
  }

  console.log('\n=== ANALYSIS ===');
  console.log('The vault encryption system in Supabase requires a server-side key that is managed by Supabase.');
  console.log('If the key is not properly initialized, it needs to be fixed at the Supabase project level.');
  console.log('\nRecommendation: Contact Supabase support to properly initialize the vault encryption key for your project.');
}

main().catch(console.error);
