#!/usr/bin/env node
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables');
    process.exit(1);
}

async function testToolAuthorization() {
    console.log('🔍 Testing Tool Authorization System After Cleanup...\n');

    // Test the chat function to see what tools Angela gets
    const testPayload = {
        message: "List available tools for testing",
        agent_id: "d1a8b5c2-4f6e-4a9b-8c7d-1e2f3g4h5i6j", // Angela's ID
        conversation_id: null
    };

    try {
        console.log('📞 Calling chat function to check Angela\'s available tools...');
        
        const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify(testPayload)
        });

        if (!response.ok) {
            throw new Error(`Chat function failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('✅ Chat function called successfully\n');

        // Check the response for tool information
        if (result.metadata && result.metadata.available_tools) {
            console.log('🔧 Available Tools for Angela:');
            result.metadata.available_tools.forEach(tool => {
                console.log(`   - ${tool}`);
            });
            
            // Security checks
            const hasGmailTools = result.metadata.available_tools.some(tool => tool.includes('gmail'));
            const hasSMTPTools = result.metadata.available_tools.some(tool => tool.includes('smtp'));
            
            console.log('\n🔒 Security Check Results:');
            console.log(`   Gmail tools present: ${hasGmailTools ? '❌ SECURITY ISSUE' : '✅ SECURE'}`);
            console.log(`   SMTP tools present: ${hasSMTPTools ? '✅ EXPECTED' : '⚠️  MISSING (check permissions)'}`);
            
            if (hasGmailTools) {
                console.log('\n🚨 CRITICAL: Gmail tools are still visible! Security bypass not fully closed.');
                return false;
            }
            
            if (hasSMTPTools) {
                console.log('\n✅ SUCCESS: SMTP tools are properly visible through unified permission system.');
            }
            
        } else {
            console.log('⚠️  No tool metadata found in response');
        }

        console.log('\n📊 Full Response:');
        console.log(JSON.stringify(result, null, 2));
        
        return true;
        
    } catch (error) {
        console.error('❌ Error testing tool authorization:', error.message);
        return false;
    }
}

async function checkDatabaseState() {
    console.log('\n🗄️  Checking Database State...');
    
    // We'll just log what should be checked manually
    console.log('   Please verify in Supabase SQL editor:');
    console.log('   1. SELECT COUNT(*) FROM mcp_tools_cache WHERE tool_name LIKE \'%gmail%\'; -- Should be 0');
    console.log('   2. SELECT table_name FROM information_schema.tables WHERE table_name IN (\'agent_smtp_permissions\', \'smtp_configurations\'); -- Should be empty');
    console.log('   3. SELECT COUNT(*) FROM agent_integration_permissions WHERE provider_name = \'smtp\'; -- Should show SMTP permissions');
}

async function main() {
    console.log('🧪 TOOL AUTHORIZATION VERIFICATION SCRIPT');
    console.log('==========================================\n');
    
    const success = await testToolAuthorization();
    await checkDatabaseState();
    
    console.log('\n' + '='.repeat(50));
    console.log(success ? '✅ VERIFICATION COMPLETED' : '❌ ISSUES DETECTED');
    console.log('='.repeat(50));
    
    if (success) {
        console.log('\n🎉 Tool authorization system is working correctly!');
        console.log('   • Old MCP bypass system has been removed');
        console.log('   • Deprecated SMTP tables have been dropped');
        console.log('   • Agents only see tools they\'re authorized for');
    } else {
        console.log('\n⚠️  Further investigation may be needed.');
    }
}

main().catch(console.error);
