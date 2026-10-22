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

async function checkGmailTokenHealth() {
  console.log('🏥 Gmail Token Health Check');
  console.log('============================\n');

  try {
    // Get all Gmail connections
    const { data: connections, error: connError } = await supabase
      .from('user_oauth_connections')
      .select(`
        id,
        user_id,
        external_username,
        token_expires_at,
        connection_status,
        last_token_refresh,
        created_at,
        service_providers!inner(name, display_name)
      `)
      .eq('service_providers.name', 'gmail');

    if (connError) {
      console.error('❌ Error fetching Gmail connections:', connError);
      return;
    }

    if (!connections || connections.length === 0) {
      console.log('📭 No Gmail connections found.');
      return;
    }

    console.log(`📊 Found ${connections.length} Gmail connection(s)\n`);

    const now = new Date();
    let healthyCount = 0;
    let expiredCount = 0;
    let soonToExpireCount = 0;

    connections.forEach((conn, index) => {
      console.log(`🔍 Connection ${index + 1}:`);
      console.log(`   User: ${conn.external_username}`);
      console.log(`   Status: ${conn.connection_status}`);
      console.log(`   Created: ${new Date(conn.created_at).toLocaleDateString()}`);
      
      if (conn.token_expires_at) {
        const expiresAt = new Date(conn.token_expires_at);
        const hoursUntilExpiry = Math.floor((expiresAt - now) / (1000 * 60 * 60));
        const isExpired = expiresAt <= now;
        const soonToExpire = hoursUntilExpiry > 0 && hoursUntilExpiry <= 24;

        console.log(`   Token Expires: ${expiresAt.toLocaleString()}`);
        
        if (isExpired) {
          const hoursExpired = Math.floor((now - expiresAt) / (1000 * 60 * 60));
          console.log(`   ❌ EXPIRED: ${hoursExpired} hours ago`);
          expiredCount++;
        } else if (soonToExpire) {
          console.log(`   ⚠️  EXPIRES SOON: ${hoursUntilExpiry} hours`);
          soonToExpireCount++;
        } else {
          console.log(`   ✅ HEALTHY: ${hoursUntilExpiry} hours remaining`);
          healthyCount++;
        }
      } else {
        console.log(`   ⚠️  No expiry date recorded`);
      }

      console.log(`   Last Refresh: ${conn.last_token_refresh || 'Never'}`);
      console.log('');
    });

    // Summary
    console.log('📈 Health Summary:');
    console.log(`   ✅ Healthy: ${healthyCount}`);
    console.log(`   ⚠️  Expiring Soon: ${soonToExpireCount}`);
    console.log(`   ❌ Expired: ${expiredCount}`);
    console.log('');

    // Recommendations
    if (expiredCount > 0) {
      console.log('🚨 IMMEDIATE ACTION REQUIRED:');
      console.log(`   ${expiredCount} Gmail connection(s) have expired`);
      console.log('   Users need to disconnect and reconnect their Gmail accounts');
      console.log('');
    }

    if (soonToExpireCount > 0) {
      console.log('⚠️  UPCOMING EXPIRATIONS:');
      console.log(`   ${soonToExpireCount} Gmail connection(s) expire within 24 hours`);
      console.log('   Consider refreshing tokens or notifying users');
      console.log('');
    }

    if (healthyCount === connections.length) {
      console.log('🎉 All Gmail connections are healthy!');
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the health check
checkGmailTokenHealth().catch(console.error);
