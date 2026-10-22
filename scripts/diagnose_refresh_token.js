#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnoseRefreshToken() {
  console.log('🔍 Gmail Refresh Token Diagnostic');
  console.log('==================================\n');

  try {
    const userId = '3f966af2-72a1-41bc-8fac-400b8002664b';
    const connectionId = 'bf521b7d-07a5-4197-a861-f0b0bd07fe1e';
    
    // Get the connection details
    const { data: connection, error: connError } = await supabase
      .from('user_oauth_connections')
      .select(`
        *,
        service_providers!inner(name, display_name)
      `)
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (connError || !connection) {
      console.error('❌ Error fetching connection:', connError);
      return;
    }

    console.log('📊 Connection Details:');
    console.log(`   ID: ${connection.id}`);
    console.log(`   Provider: ${connection.service_providers.display_name}`);
    console.log(`   Status: ${connection.connection_status}`);
    console.log(`   External User: ${connection.external_username}`);
    console.log(`   Created: ${new Date(connection.created_at).toLocaleString()}`);
    console.log(`   Updated: ${new Date(connection.updated_at).toLocaleString()}`);
    console.log(`   Last Refresh: ${connection.last_token_refresh || 'Never'}`);
    console.log('');

    console.log('🔑 Token Information:');
    console.log(`   Access Token ID: ${connection.vault_access_token_id?.substring(0, 20)}...`);
    console.log(`   Refresh Token ID: ${connection.vault_refresh_token_id?.substring(0, 20)}...`);
    console.log(`   Token Expires: ${connection.token_expires_at}`);
    console.log('');

    // Check token expiry
    const tokenExpiresAt = new Date(connection.token_expires_at);
    const now = new Date();
    const isExpired = tokenExpiresAt <= now;
    const hoursExpired = isExpired ? Math.floor((now - tokenExpiresAt) / (1000 * 60 * 60)) : 0;
    
    console.log('⏰ Token Status:');
    console.log(`   Current Time: ${now.toISOString()}`);
    console.log(`   Token Expires: ${tokenExpiresAt.toISOString()}`);
    console.log(`   Is Expired: ${isExpired ? '❌ YES' : '✅ NO'}`);
    if (isExpired) {
      console.log(`   Hours Expired: ${hoursExpired} hours`);
    }
    console.log('');

    // Analyze the refresh token format
    const refreshToken = connection.vault_refresh_token_id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(refreshToken);
    const looksLikeGoogleToken = refreshToken.startsWith('1//');
    
    console.log('🔍 Refresh Token Analysis:');
    console.log(`   Length: ${refreshToken.length} characters`);
    console.log(`   Is UUID: ${isUuid ? '✅ YES' : '❌ NO'}`);
    console.log(`   Looks like Google token: ${looksLikeGoogleToken ? '✅ YES' : '❌ NO'}`);
    console.log(`   Starts with: ${refreshToken.substring(0, 10)}...`);
    console.log('');

    // Check Google OAuth configuration
    console.log('🔧 Google OAuth Configuration Check:');
    
    // Test if we can make a basic request to Google's token endpoint
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    console.log(`   Client ID configured: ${clientId ? '✅ YES' : '❌ NO'}`);
    console.log(`   Client Secret configured: ${clientSecret ? '✅ YES' : '❌ NO'}`);
    
    if (clientId) {
      console.log(`   Client ID: ${clientId.substring(0, 20)}...`);
    }
    console.log('');

    // Analyze why refresh might be failing
    console.log('💡 Potential Issues:');
    
    if (hoursExpired > 168) { // 7 days
      console.log('   ⚠️  Token has been expired for over 7 days - Google may have revoked it');
    }
    
    if (!looksLikeGoogleToken && !isUuid) {
      console.log('   ⚠️  Refresh token format doesn\'t match expected Google or UUID format');
    }
    
    if (!clientId || !clientSecret) {
      console.log('   ⚠️  Google OAuth credentials not configured in environment');
    }
    
    // Check if the connection was created a long time ago
    const createdAt = new Date(connection.created_at);
    const daysOld = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
    
    if (daysOld > 180) { // 6 months
      console.log(`   ⚠️  Connection is ${daysOld} days old - refresh token may have expired due to inactivity`);
    }
    
    console.log('');
    console.log('📋 Recommendations:');
    
    if (hoursExpired > 168 || daysOld > 180) {
      console.log('   🔄 User needs to re-authenticate with Gmail (refresh token likely permanently expired)');
      console.log('   🔗 Direct them to disconnect and reconnect their Gmail account');
    } else if (!clientId || !clientSecret) {
      console.log('   ⚙️  Configure Google OAuth credentials in environment variables');
    } else {
      console.log('   🔍 Investigate Google OAuth app settings and permissions');
      console.log('   📞 Check if the Google OAuth app is still active and approved');
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the diagnostic
diagnoseRefreshToken().catch(console.error);
