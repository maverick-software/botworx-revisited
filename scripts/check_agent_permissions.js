#!/usr/bin/env node

/**
 * Check Agent Permissions Script
 * Investigates permission issues for specific agent
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

async function checkAgentPermissions() {
  console.log('🔍 Checking Agent Permissions');
  console.log(`Agent ID: ${AGENT_ID}`);
  console.log(`User ID: ${USER_ID}`);
  console.log('─'.repeat(50));

  try {
    // 1. Check Gmail permissions
    console.log('\n📧 Gmail Permissions:');
    const { data: gmailPerms, error: gmailError } = await supabase
      .from('agent_integration_permissions')
      .select(`
        id,
        allowed_scopes,
        is_active,
        user_integration_credentials!inner(
          id,
          connection_name,
          oauth_provider_id,
          credential_type,
          service_providers!inner(name)
        )
      `)
      .eq('agent_id', AGENT_ID)
      .eq('user_integration_credentials.user_id', USER_ID)
      .eq('user_integration_credentials.service_providers.name', 'gmail')
      .eq('user_integration_credentials.credential_type', 'oauth')
      .eq('is_active', true);

    if (gmailError) {
      console.error('❌ Gmail permissions query error:', gmailError);
    } else if (!gmailPerms || gmailPerms.length === 0) {
      console.log('❌ No Gmail permissions found for this agent');
    } else {
      console.log('✅ Gmail permissions found:');
      gmailPerms.forEach(perm => {
        console.log(`  - Connection: ${perm.user_integration_credentials?.connection_name}`);
        console.log(`  - Scopes: ${JSON.stringify(perm.allowed_scopes)}`);
        console.log(`  - Active: ${perm.is_active}`);
      });
    }

    // 2. Check SMTP permissions
    console.log('\n📨 SMTP Permissions:');
    const { data: smtpPerms, error: smtpError } = await supabase
      .from('agent_integration_permissions')
      .select(`
        id,
        allowed_scopes,
        is_active,
        user_integration_credentials!inner(
          id,
          connection_name,
          oauth_provider_id,
          credential_type,
          service_providers!inner(name)
        )
      `)
      .eq('agent_id', AGENT_ID)
      .eq('user_integration_credentials.user_id', USER_ID)
      .eq('user_integration_credentials.service_providers.name', 'smtp')
      .eq('user_integration_credentials.credential_type', 'api_key')
      .eq('is_active', true);

    if (smtpError) {
      console.error('❌ SMTP permissions query error:', smtpError);
    } else if (!smtpPerms || smtpPerms.length === 0) {
      console.log('❌ No SMTP permissions found for this agent');
    } else {
      console.log('✅ SMTP permissions found:');
      smtpPerms.forEach(perm => {
        console.log(`  - Connection: ${perm.user_integration_credentials?.connection_name}`);
        console.log(`  - Scopes: ${JSON.stringify(perm.allowed_scopes)}`);
        console.log(`  - Active: ${perm.is_active}`);
      });
    }

    // 3. Check all user integration credentials
    console.log('\n🔗 All User Integration Credentials:');
    const { data: allCreds, error: credsError } = await supabase
      .from('user_integration_credentials')
      .select(`
        id,
        connection_name,
        credential_type,
        service_providers!inner(name)
      `)
      .eq('user_id', USER_ID);

    if (credsError) {
      console.error('❌ Credentials query error:', credsError);
    } else if (!allCreds || allCreds.length === 0) {
      console.log('❌ No integration credentials found for this user');
    } else {
      console.log('✅ User integration credentials:');
      allCreds.forEach(cred => {
        console.log(`  - Provider: ${cred.service_providers?.name}`);
        console.log(`  - Name: ${cred.connection_name}`);
        console.log(`  - Type: ${cred.credential_type}`);
        console.log(`  - ID: ${cred.id}`);
      });
    }

    // 4. Check all agent permissions 
    console.log('\n🤖 All Agent Permissions:');
    const { data: allPerms, error: permsError } = await supabase
      .from('agent_integration_permissions')
      .select(`
        id,
        allowed_scopes,
        is_active,
        user_integration_credentials!inner(
          id,
          connection_name,
          service_providers!inner(name)
        )
      `)
      .eq('agent_id', AGENT_ID);

    if (permsError) {
      console.error('❌ Agent permissions query error:', permsError);
    } else if (!allPerms || allPerms.length === 0) {
      console.log('❌ No permissions found for this agent');
    } else {
      console.log('✅ All agent permissions:');
      allPerms.forEach(perm => {
        console.log(`  - Provider: ${perm.user_integration_credentials?.service_providers?.name}`);
        console.log(`  - Connection: ${perm.user_integration_credentials?.connection_name}`);
        console.log(`  - Scopes: ${JSON.stringify(perm.allowed_scopes)}`);
        console.log(`  - Active: ${perm.is_active}`);
        console.log(`  - Permission ID: ${perm.id}`);
        console.log();
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the check
checkAgentPermissions()
  .then(() => {
    console.log('\n✨ Permission check complete');
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
