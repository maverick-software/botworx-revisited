import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL!;
  const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, { 
    auth: { persistSession: false } 
  });

  console.log('Checking Vault configuration...\n');

  // Test 1: Check if pgsodium extension exists
  const { data: extensions, error: extError } = await supabase
    .from('pg_extension')
    .select('extname')
    .eq('extname', 'pgsodium');
  
  if (extError) {
    console.log('Could not query pg_extension:', extError.message);
  } else {
    console.log('pgsodium extension:', extensions?.length ? 'INSTALLED' : 'NOT FOUND');
  }

  // Test 2: Try to create a simple secret
  console.log('\nTesting vault.create_secret...');
  const testSecretName = `test_vault_${Date.now()}`;
  const { data: secretId, error: createError } = await supabase.rpc('create_vault_secret', {
    p_secret: 'test_value_123',
    p_name: testSecretName,
    p_description: 'Testing vault functionality'
  });

  if (createError) {
    console.error('Failed to create secret:', createError);
    return;
  }

  console.log('Created secret with ID:', secretId);

  // Test 3: Check if we can query vault tables directly
  console.log('\nChecking vault schema access...');
  
  // Try different approaches to read the secret
  console.log('\n1. Trying vault_decrypt with UUID...');
  const { data: decrypted1, error: error1 } = await supabase.rpc('vault_decrypt', {
    vault_id: secretId
  });
  console.log('Result:', error1 ? `Error: ${error1.message}` : `Success: ${decrypted1}`);

  console.log('\n2. Trying vault_decrypt with name...');
  const { data: decrypted2, error: error2 } = await supabase.rpc('vault_decrypt', {
    vault_id: testSecretName
  });
  console.log('Result:', error2 ? `Error: ${error2.message}` : `Success: ${decrypted2}`);

  console.log('\n3. Trying get_vault_secrets_by_names...');
  const { data: decrypted3, error: error3 } = await supabase.rpc('get_vault_secrets_by_names', {
    p_secret_names: [testSecretName]
  });
  console.log('Result:', error3 ? `Error: ${error3.message}` : `Success: ${JSON.stringify(decrypted3)}`);

  // Test 4: Check vault key configuration
  console.log('\n4. Checking vault key configuration...');
  const { data: keyCheck, error: keyError } = await supabase.rpc('sql', {
    query: "SELECT current_setting('vault.key', true) IS NOT NULL as has_key"
  }).catch(() => null);
  
  if (keyCheck) {
    console.log('Vault key configured:', keyCheck);
  } else {
    console.log('Could not check vault key configuration');
  }

  console.log('\n=== DIAGNOSIS ===');
  console.log('The "invalid ciphertext" error suggests the vault encryption key is not properly configured.');
  console.log('This is likely a Supabase project configuration issue that needs to be resolved at the project level.');
  console.log('\nPossible solutions:');
  console.log('1. Contact Supabase support to reset/reconfigure the vault encryption key');
  console.log('2. Use environment variables for secrets instead of vault (temporary workaround)');
  console.log('3. Store encrypted secrets in a regular table with your own encryption');
}

main().catch(console.error);
