import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing environment variables. Please check .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAngelaTools() {
  console.log('🔍 Testing Angela\'s Tool Authorization System\n');
  console.log('='.repeat(50));

  try {
    // 1. Find Angela's agent
    const { data: angela, error: angelaError } = await supabase
      .from('agents')
      .select('id, name, user_id, metadata')
      .ilike('name', '%angela%')
      .single();

    if (angelaError || !angela) {
      console.error('❌ Angela agent not found:', angelaError);
      return;
    }

    console.log(`✅ Found Agent Angela`);
    console.log(`   ID: ${angela.id}`);
    console.log(`   User: ${angela.user_id}\n`);

    // 2. Check what integrations Angela has permissions for
    console.log('📋 Angela\'s Integration Permissions:');
    console.log('-'.repeat(50));
    
    const { data: permissions, error: permError } = await supabase
      .from('agent_integration_permissions')
      .select(`
        id,
        allowed_scopes,
        is_active,
        permission_level,
        user_integration_credentials!inner(
          id,
          connection_name,
          credential_type,
          connection_status,
          service_providers!inner(name)
        )
      `)
      .eq('agent_id', angela.id)
      .eq('is_active', true);

    if (permError) {
      console.error('❌ Error fetching permissions:', permError);
      return;
    }

    if (!permissions || permissions.length === 0) {
      console.log('   ⚠️  No active permissions found');
    } else {
      permissions.forEach(perm => {
        const provider = perm.user_integration_credentials?.service_providers?.name;
        const connection = perm.user_integration_credentials?.connection_name;
        const status = perm.user_integration_credentials?.connection_status;
        
        console.log(`   📌 Provider: ${provider}`);
        console.log(`      Connection: ${connection}`);
        console.log(`      Status: ${status}`);
        console.log(`      Scopes: ${JSON.stringify(perm.allowed_scopes)}`);
        console.log('');
      });
    }

    // 3. Simulate what tools Angela would see
    console.log('\n🛠️  Expected Tools for Angela:');
    console.log('-'.repeat(50));
    
    const expectedTools = [];
    
    // Check for Gmail
    const gmailPerms = permissions?.filter(p => 
      p.user_integration_credentials?.service_providers?.name === 'gmail'
    );
    if (gmailPerms?.length > 0) {
      expectedTools.push('gmail_send_email', 'gmail_read_emails', 'gmail_search_emails', 'gmail_email_actions');
      console.log('   ❌ PROBLEM: Gmail tools would be available (should NOT be!)');
    } else {
      console.log('   ✅ No Gmail tools (correct!)');
    }
    
    // Check for SMTP
    const smtpPerms = permissions?.filter(p => 
      p.user_integration_credentials?.service_providers?.name === 'smtp'
    );
    if (smtpPerms?.length > 0) {
      expectedTools.push('smtp_send_email', 'smtp_test_connection');
      console.log('   ✅ SMTP tools: smtp_send_email, smtp_test_connection');
    }
    
    // Check for SendGrid
    const sendgridPerms = permissions?.filter(p => 
      p.user_integration_credentials?.service_providers?.name === 'sendgrid'
    );
    if (sendgridPerms?.length > 0) {
      expectedTools.push('sendgrid_send_email');
      console.log('   ✅ SendGrid tools: sendgrid_send_email');
    }
    
    // Check for Mailgun
    const mailgunPerms = permissions?.filter(p => 
      p.user_integration_credentials?.service_providers?.name === 'mailgun'
    );
    if (mailgunPerms?.length > 0) {
      expectedTools.push('mailgun_send_email', 'mailgun_validate_email');
      console.log('   ✅ Mailgun tools: mailgun_send_email, mailgun_validate_email');
    }

    // 4. Verify no Gmail connections exist
    console.log('\n🔒 Security Check - Gmail Connections:');
    console.log('-'.repeat(50));
    
    const { data: gmailCreds, error: gmailError } = await supabase
      .from('user_integration_credentials')
      .select(`
        id,
        connection_name,
        external_username,
        connection_status,
        service_providers!inner(name)
      `)
      .eq('user_id', angela.user_id)
      .eq('service_providers.name', 'gmail');

    if (gmailCreds && gmailCreds.length > 0) {
      console.log(`   ⚠️  WARNING: Found ${gmailCreds.length} Gmail credential(s) for user`);
      console.log('   These should be removed or Angela could potentially access them');
      gmailCreds.forEach(cred => {
        console.log(`      - ${cred.connection_name} (${cred.external_username})`);
      });
    } else {
      console.log('   ✅ No Gmail credentials found for user (secure!)');
    }

    // 5. Summary
    console.log('\n📊 Summary:');
    console.log('-'.repeat(50));
    console.log(`   Total Tools Available: ${expectedTools.length}`);
    console.log(`   Tool Names: ${expectedTools.join(', ') || 'None'}`);
    console.log('');
    console.log('✨ With proper namespacing:');
    console.log('   - No tool name collisions (gmail_send_email vs smtp_send_email)');
    console.log('   - Angela cannot call Gmail tools (she doesn\'t know they exist)');
    console.log('   - Each tool is prefixed with its provider');
    console.log('   - LLM chooses the right tool based on what\'s available');

  } catch (error) {
    console.error('💥 Error testing Angela\'s tools:', error);
  }
}

testAngelaTools();
