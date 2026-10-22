import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkVaultStructure() {
  console.log('Checking Vault Structure\n');
  console.log('=======================\n');

  try {
    // Test if we can create a test secret
    console.log('Testing create_vault_secret function...');
    const { data: testSecretId, error: createError } = await supabase.rpc('create_vault_secret', {
      secret_value: 'test_secret_value',
      name: `test_secret_${Date.now()}`,
      description: 'Test secret for debugging'
    });

    console.log('create_vault_secret result:', {
      secretId: testSecretId,
      error: createError
    });

    if (testSecretId) {
      // Try to retrieve the test secret
      console.log('\nTrying to retrieve test secret...');
      const { data: retrievedSecret, error: getError } = await supabase.rpc('get_secret', {
        secret_id: testSecretId
      });

      console.log('get_secret result:', {
        data: retrievedSecret,
        error: getError
      });

      // Check available schemas
      console.log('\n\nChecking available schemas...');
      const { data: schemas, error: schemaError } = await supabase
        .from('information_schema.schemata')
        .select('schema_name')
        .order('schema_name');

      if (schemaError) {
        console.log('Error checking schemas:', schemaError.message);
      } else {
        console.log('Available schemas:', schemas?.map(s => s.schema_name).join(', '));
      }
    }

    // Check if vault functions exist
    console.log('\n\nChecking vault functions...');
    const { data: functions, error: funcError } = await supabase
      .from('pg_catalog.pg_proc')
      .select('proname')
      .or('proname.eq.create_vault_secret,proname.eq.get_secret,proname.eq.vault_create_secret');

    if (funcError) {
      console.log('Error checking functions:', funcError.message);
    } else {
      console.log('Found functions:', functions?.map(f => f.proname).join(', '));
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

checkVaultStructure(); 