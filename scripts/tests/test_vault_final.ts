import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL!;
  const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, { 
    auth: { persistSession: false } 
  });

  console.log('Testing Vault Encrypt/Decrypt Functionality\n');
  console.log('=' .repeat(50));

  // Test 1: Create a new secret
  const testSecretName = `vault_test_${Date.now()}`;
  const testSecretValue = 'This is a test secret value!';
  
  console.log('\n1. Creating a new vault secret...');
  console.log(`   Name: ${testSecretName}`);
  console.log(`   Value: ${testSecretValue}`);
  
  const { data: secretId, error: createError } = await supabase.rpc('create_vault_secret', {
    p_secret: testSecretValue,
    p_name: testSecretName,
    p_description: 'Testing vault encryption'
  });

  if (createError) {
    console.error('❌ Failed to create secret:', createError.message);
    return;
  }

  console.log(`✅ Secret created with ID: ${secretId}`);

  // Test 2: Decrypt using vault_decrypt with UUID
  console.log('\n2. Testing vault_decrypt with UUID...');
  const { data: decrypted1, error: error1 } = await supabase.rpc('vault_decrypt', {
    vault_id: secretId
  });

  if (error1) {
    console.error(`❌ Decrypt by ID failed: ${error1.message}`);
  } else {
    console.log(`✅ Decrypted value: "${decrypted1}"`);
    console.log(`   Match: ${decrypted1 === testSecretValue ? '✅ SUCCESS' : '❌ MISMATCH'}`);
  }

  // Test 3: Decrypt using vault_decrypt with name
  console.log('\n3. Testing vault_decrypt with name...');
  const { data: decrypted2, error: error2 } = await supabase.rpc('vault_decrypt', {
    vault_id: testSecretName
  });

  if (error2) {
    console.error(`❌ Decrypt by name failed: ${error2.message}`);
  } else {
    console.log(`✅ Decrypted value: "${decrypted2}"`);
    console.log(`   Match: ${decrypted2 === testSecretValue ? '✅ SUCCESS' : '❌ MISMATCH'}`);
  }

  // Test 4: Test with API key format (fallback mechanism)
  console.log('\n4. Testing vault_decrypt with API key format (fallback)...');
  const fakeApiKey = 'z_test_api_key_123456';
  const { data: decrypted3, error: error3 } = await supabase.rpc('vault_decrypt', {
    vault_id: fakeApiKey
  });

  if (error3) {
    console.error(`❌ API key fallback failed: ${error3.message}`);
  } else if (decrypted3 === fakeApiKey) {
    console.log(`✅ API key fallback working: "${decrypted3}"`);
  } else {
    console.log(`❓ Unexpected result: "${decrypted3}"`);
  }

  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('SUMMARY:');
  
  if (!error1 && decrypted1 === testSecretValue) {
    console.log('✅ Vault encryption/decryption is WORKING!');
    console.log('   - Secrets can be created');
    console.log('   - Secrets can be decrypted by ID');
    console.log('   - The decrypted value matches the original');
  } else if (error1?.message.includes('invalid ciphertext')) {
    console.log('❌ Vault encryption is BROKEN');
    console.log('   - Secrets are created but cannot be decrypted');
    console.log('   - This is a Supabase infrastructure issue');
    console.log('   - The vault encryption key is not properly configured');
    console.log('\n   WORKAROUND: Our vault_decrypt function has a fallback');
    console.log('   that treats API keys (starting with z_, sk_, pk_) as plain text.');
    console.log('   This allows GetZep to work despite the vault issue.');
  } else {
    console.log('⚠️  Vault status: PARTIALLY WORKING');
    console.log(`   - Issue: ${error1?.message || 'Unknown'}`);
  }
}

main().catch(console.error);
