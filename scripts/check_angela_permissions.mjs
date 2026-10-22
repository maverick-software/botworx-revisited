import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing environment variables. Please check .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkAngelaPermissions() {
  try {
    console.log('🔍 Checking Angela\'s permissions and Gmail connections...\n');

    // 1. Find Angela's agent ID
    const { data: angela, error: angelaError } = await supabase
      .from('agents')
      .select('id, name, user_id')
      .ilike('name', '%angela%')
      .single();

    if (angelaError || !angela) {
      console.error('❌ Angela agent not found:', angelaError);
      return;
    }

    console.log(`✅ Found Angela: ID=${angela.id}, User=${angela.user_id}\n`);

    // 2. Check agent_integration_permissions for Gmail
    const { data: permissions, error: permError } = await supabase
      .from('agent_integration_permissions')
      .select(`
        id,
        allowed_scopes,
        is_active,
        created_at,
        user_integration_credentials!inner(
          id,
          connection_name,
          vault_access_token_id,
          connection_status,
          service_providers!inner(name)
        )
      `)
      .eq('agent_id', angela.id)
      .eq('user_integration_credentials.service_providers.name', 'gmail');

    console.log('📋 Gmail Integration Permissions:');
    if (permError || !permissions || permissions.length === 0) {
      console.log('   ✅ No Gmail permissions found (this is correct!)\n');
    } else {
      console.log(`   ❌ FOUND ${permissions.length} Gmail permissions:`);
      permissions.forEach(perm => {
        console.log(`   - ID: ${perm.id}`);
        console.log(`   - Active: ${perm.is_active}`);
        console.log(`   - Scopes: ${JSON.stringify(perm.allowed_scopes)}`);
        console.log(`   - Connection: ${perm.user_integration_credentials?.connection_name}`);
        console.log(`   - Vault Token ID: ${perm.user_integration_credentials?.vault_access_token_id}`);
        console.log('');
      });
    }

    // 3. Check user_integration_credentials for Gmail (all Gmail connections for this user)
    const { data: gmailCreds, error: credsError } = await supabase
      .from('user_integration_credentials')
      .select(`
        id,
        connection_name,
        external_username,
        vault_access_token_id,
        connection_status,
        credential_type,
        created_at,
        service_providers!inner(name)
      `)
      .eq('user_id', angela.user_id)
      .eq('service_providers.name', 'gmail');

    console.log('📧 Gmail Credentials (User Level):');
    if (credsError || !gmailCreds || gmailCreds.length === 0) {
      console.log('   ✅ No Gmail credentials found (this is correct!)\n');
    } else {
      console.log(`   ❌ FOUND ${gmailCreds.length} Gmail credentials:`);
      gmailCreds.forEach(cred => {
        console.log(`   - ID: ${cred.id}`);
        console.log(`   - Name: ${cred.connection_name}`);
        console.log(`   - Username: ${cred.external_username}`);
        console.log(`   - Status: ${cred.connection_status}`);
        console.log(`   - Type: ${cred.credential_type}`);
        console.log(`   - Vault Token: ${cred.vault_access_token_id?.substring(0, 20)}...`);
        console.log(`   - Created: ${cred.created_at}`);
        console.log('');
      });
    }

    // 4. Check vault secrets for Gmail tokens
    console.log('🔐 Checking Vault Secrets...');
    const { data: secrets, error: secretsError } = await supabase
      .from('vault.secrets')
      .select('id, name, description, created_at')
      .ilike('name', '%gmail%');

    if (secretsError) {
      console.log('   ⚠️  Could not access vault secrets (this might be expected)');
    } else if (!secrets || secrets.length === 0) {
      console.log('   ✅ No Gmail secrets found in vault\n');
    } else {
      console.log(`   ❌ FOUND ${secrets.length} Gmail secrets in vault:`);
      secrets.forEach(secret => {
        console.log(`   - ID: ${secret.id}`);
        console.log(`   - Name: ${secret.name}`);
        console.log(`   - Description: ${secret.description}`);
        console.log(`   - Created: ${secret.created_at}`);
        console.log('');
      });
    }

    // 5. Check for any SMTP permissions (should exist)
    const { data: smtpPerms, error: smtpError } = await supabase
      .from('agent_integration_permissions')
      .select(`
        id,
        allowed_scopes,
        is_active,
        user_integration_credentials!inner(
          connection_name,
          service_providers!inner(name)
        )
      `)
      .eq('agent_id', angela.id)
      .in('user_integration_credentials.service_providers.name', ['smtp', 'sendgrid', 'mailgun']);

    console.log('📤 Email (SMTP/SendGrid/Mailgun) Permissions:');
    if (smtpError || !smtpPerms || smtpPerms.length === 0) {
      console.log('   ❌ No email permissions found (Angela should have SMTP access!)');
    } else {
      console.log(`   ✅ Found ${smtpPerms.length} email permissions:`);
      smtpPerms.forEach(perm => {
        const provider = perm.user_integration_credentials?.service_providers?.name;
        const connection = perm.user_integration_credentials?.connection_name;
        console.log(`   - Provider: ${provider}, Connection: ${connection}, Active: ${perm.is_active}`);
      });
    }

  } catch (error) {
    console.error('💥 Error checking permissions:', error);
  }
}

checkAngelaPermissions();
