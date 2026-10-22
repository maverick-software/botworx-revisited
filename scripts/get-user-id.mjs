#!/usr/bin/env node

/**
 * Script to get your Supabase User ID
 * 
 * Usage: node scripts/get-user-id.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log('🔍 Finding your Supabase User ID');
  console.log('===============================');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('   VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('🔄 Connecting to Supabase...');
    
    // Try a simple query first
    const { data: testData, error: testError } = await supabase
      .rpc('get_secret', { secret_id: 'test' });
      
    if (testError && testError.code !== 'PGRST116') {
      console.log('✅ Connected to Supabase successfully');
    }

    // Get users from auth schema using direct query
    console.log('📋 Fetching user information...');
    
    // Try to query users - this might need admin access
    const { data: users, error } = await supabase
      .from('profiles') // Try profiles table first
      .select('*')
      .limit(10);

    if (error) {
      console.log('⚠️  Could not access profiles table, trying alternative...');
      
      // Alternative: check if we can access any user data
      console.log('\n💡 Manual method to find your User ID:');
      console.log('   1. Go to https://app.supabase.com');
      console.log('   2. Select your project');
      console.log('   3. Go to Authentication -> Users');
      console.log('   4. Find your user and copy the ID');
      console.log('   5. Set it as: set USER_ID=your-user-id');
      
      return;
    }

    if (!users || users.length === 0) {
      console.log('❌ No users found in profiles table');
      console.log('\n💡 Please check your Supabase dashboard:');
      console.log('   1. Go to https://app.supabase.com');
      console.log('   2. Select your project');
      console.log('   3. Go to Authentication -> Users');
      return;
    }

    console.log('📋 Users found in your project:');
    console.log('');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id || user.user_id}`);
      if (user.email) console.log(`   Email: ${user.email}`);
      if (user.created_at) console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log('');
    });

    console.log('💡 To use an ID, set it as an environment variable:');
    console.log('   set USER_ID=your-chosen-user-id');

  } catch (error) {
    console.error('💥 Script failed:', error.message);
    console.log('\n💡 Manual method: Check your Supabase dashboard:');
    console.log('   1. Go to https://app.supabase.com');
    console.log('   2. Select your project');
    console.log('   3. Go to Authentication -> Users');
    console.log('   4. Find your user and copy the ID');
    console.log('   5. Set it as: set USER_ID=your-user-id');
  }
}

main(); 