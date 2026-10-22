#!/usr/bin/env node

/**
 * Grant Gmail Permissions Script
 * Grants Gmail permissions to a specific agent
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Required: VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const AGENT_ID = '87e6e948-694d-4f8c-8e94-2b4f6281ffc3';
const USER_ID = '3f966af2-72a1-41bc-8fac-400b8002664b';
const GMAIL_CREDENTIAL_ID = 'c35127fe-2090-40a6-9e9f-43ddbbb32023';

async function grantGmailPermissions() {
  console.log('🔐 Granting Gmail Permissions');
  console.log(`Agent ID: ${AGENT_ID}`);
  console.log(`User ID: ${USER_ID}`);
  console.log(`Gmail Credential ID: ${GMAIL_CREDENTIAL_ID}`);
  console.log('─'.repeat(50));

  try {
    // First, verify the Gmail credential exists
    const { data: credential, error: credError } = await supabase
      .from('user_integration_credentials')
      .select(`
        id,
        connection_name,
        service_providers!inner(name)
      `)
      .eq('id', GMAIL_CREDENTIAL_ID)
      .eq('user_id', USER_ID)
      .eq('service_providers.name', 'gmail')
      .single();

    if (credError || !credential) {
      console.error('❌ Gmail credential not found or error:', credError);
      return;
    }

    console.log(`✅ Found Gmail credential: ${credential.connection_name}`);

    // Grant standard Gmail permissions
    const gmailScopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ];

    const { data: permission, error: permError } = await supabase
      .from('agent_integration_permissions')
      .insert({
        agent_id: AGENT_ID,
        user_oauth_connection_id: GMAIL_CREDENTIAL_ID,
        allowed_scopes: gmailScopes,
        permission_level: 'custom',
        granted_by_user_id: USER_ID,
        is_active: true
      })
      .select()
      .single();

    if (permError) {
      console.error('❌ Error granting permissions:', permError);
      return;
    }

    console.log('✅ Gmail permissions granted successfully!');
    console.log(`Permission ID: ${permission.id}`);
    console.log(`Granted scopes: ${JSON.stringify(gmailScopes)}`);

    // Verify the permissions were granted correctly
    console.log('\n🔍 Verifying permissions...');
    const { data: verification, error: verifyError } = await supabase
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
      .eq('agent_id', AGENT_ID)
      .eq('user_oauth_connection_id', GMAIL_CREDENTIAL_ID);

    if (verifyError) {
      console.error('❌ Verification error:', verifyError);
    } else if (verification && verification.length > 0) {
      console.log('✅ Permission verification successful:');
      verification.forEach(perm => {
        console.log(`  - Connection: ${perm.user_integration_credentials?.connection_name}`);
        console.log(`  - Scopes: ${JSON.stringify(perm.allowed_scopes)}`);
        console.log(`  - Active: ${perm.is_active}`);
      });
    } else {
      console.log('❌ Verification failed - no permissions found');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
grantGmailPermissions()
  .then(() => {
    console.log('\n✨ Gmail permission granting complete');
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
