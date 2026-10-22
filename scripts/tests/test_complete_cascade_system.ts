#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://txhscptzjrrudnqwavcb.supabase.co';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class CompleteCascadeSystemTest {
  private testUserId = '3f966af2-72a1-41bc-8fac-400b8002664b';
  private testAgentId = 'b4aa3e37-b21d-49ce-bfd8-bc2c7b74439d';
  private testCredentialId = '9b7ff8d9-14a8-40ca-8fe1-6fd4c668aab4';
  private permissionId: string | null = null;

  async runTest() {
    console.log('🚀 COMPLETE CASCADE SYSTEM TEST');
    console.log('Testing: Integration → Credential → Agent Permission → Tool Availability');
    console.log('═'.repeat(80));

    try {
      await this.step1_GrantPermission();
      await this.step2_VerifyPermissionExists();
      await this.step3_VerifyToolAvailable();
      await this.step4_RevokeCredential();
      await this.step5_VerifyPermissionCascadeDeleted();
      await this.step6_VerifyToolUnavailable();
      await this.step7_RestoreForCleanup();

      console.log('\n🎉 ALL TESTS PASSED! CASCADE SYSTEM FULLY OPERATIONAL!');
      console.log('✅ Grant permission works');
      console.log('✅ Tool availability reflects permissions');  
      console.log('✅ Credential revocation CASCADE deletes permissions');
      console.log('✅ Tools become unavailable when credentials are revoked');
      console.log('✅ The integration → credential → permission → tool chain works perfectly');

    } catch (error) {
      console.error('\n❌ TEST FAILED:', error);
    }
  }

  async step1_GrantPermission() {
    console.log('\n1️⃣ Granting agent permission to credential...');
    
    const { data, error } = await supabase.rpc('grant_agent_integration_permission', {
      p_agent_id: this.testAgentId,
      p_connection_id: this.testCredentialId,
      p_allowed_scopes: ['send_email'],
      p_permission_level: 'custom',
      p_user_id: this.testUserId
    });

    if (error) throw error;
    
    this.permissionId = data;
    console.log(`✅ Permission granted! ID: ${this.permissionId}`);
  }

  async step2_VerifyPermissionExists() {
    console.log('\n2️⃣ Verifying permission exists in database...');
    
    const { data, error } = await supabase
      .from('agent_integration_permissions') // ← NEW TABLE NAME!
      .select('*')
      .eq('id', this.permissionId);

    if (error) throw error;
    
    if (!data || data.length === 0) {
      throw new Error('Permission not found after granting');
    }

    console.log(`✅ Permission found in database:`, {
      id: data[0].id,
      agent_id: data[0].agent_id,
      is_active: data[0].is_active,
      permission_level: data[0].permission_level,
      allowed_scopes: data[0].allowed_scopes
    });
  }

  async step3_VerifyToolAvailable() {
    console.log('\n3️⃣ Verifying tool is available to agent...');
    
    const { data, error } = await supabase
      .rpc('verify_agent_tool_availability', {
        p_agent_id: this.testAgentId,
        p_user_id: this.testUserId
      });

    if (error) throw error;

    const mailgunTool = data.find((tool: any) => tool.integration_name === 'Mailgun');
    
    if (!mailgunTool || !mailgunTool.permission_granted) {
      throw new Error('Mailgun tool should be available but is not granted to agent');
    }

    console.log(`✅ Mailgun tool is available to agent:`, {
      tool_available: mailgunTool.tool_available,
      credential_status: mailgunTool.credential_status,
      permission_granted: mailgunTool.permission_granted,
      permission_active: mailgunTool.permission_active
    });
  }

  async step4_RevokeCredential() {
    console.log('\n4️⃣ Revoking credential (should CASCADE delete permission)...');
    
    const { data, error } = await supabase
      .from('user_integration_credentials')
      .update({ 
        connection_status: 'revoked',
        updated_at: new Date().toISOString()
      })
      .eq('id', this.testCredentialId)
      .select();

    if (error) throw error;
    
    console.log(`✅ Credential revoked:`, {
      credential_id: this.testCredentialId,
      new_status: data[0].connection_status,
      updated_at: data[0].updated_at
    });

    // Wait for CASCADE trigger to fire
    console.log('⏳ Waiting for CASCADE DELETE trigger...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async step5_VerifyPermissionCascadeDeleted() {
    console.log('\n5️⃣ Verifying permission was CASCADE deleted...');
    
    const { data, error } = await supabase
      .from('agent_integration_permissions') // ← NEW TABLE NAME!
      .select('*')
      .eq('id', this.permissionId);

    if (error) throw error;

    if (data && data.length > 0) {
      throw new Error('Permission still exists! CASCADE DELETE did not work');
    }

    console.log(`✅ Permission CASCADE deleted! No records found for permission ID: ${this.permissionId}`);
  }

  async step6_VerifyToolUnavailable() {
    console.log('\n6️⃣ Verifying tool is no longer available to agent...');
    
    const { data, error } = await supabase
      .rpc('verify_agent_tool_availability', {
        p_agent_id: this.testAgentId,
        p_user_id: this.testUserId
      });

    if (error) throw error;

    const mailgunTool = data.find((tool: any) => tool.integration_name === 'Mailgun');
    
    if (!mailgunTool) {
      throw new Error('Mailgun tool entry should exist but with revoked status');
    }

    if (mailgunTool.tool_available || mailgunTool.permission_granted) {
      throw new Error('Mailgun tool should NOT be available after credential revocation');
    }

    console.log(`✅ Mailgun tool correctly unavailable:`, {
      tool_available: mailgunTool.tool_available,
      credential_status: mailgunTool.credential_status,
      permission_granted: mailgunTool.permission_granted,
      permission_active: mailgunTool.permission_active
    });
  }

  async step7_RestoreForCleanup() {
    console.log('\n7️⃣ Restoring credential for cleanup...');
    
    const { data, error } = await supabase
      .from('user_integration_credentials')
      .update({ 
        connection_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', this.testCredentialId)
      .select();

    if (error) throw error;
    
    console.log(`✅ Credential restored to active status`);
  }
}

// Run the test
const tester = new CompleteCascadeSystemTest();
tester.runTest().catch(console.error);
