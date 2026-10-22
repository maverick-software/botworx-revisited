#!/usr/bin/env node
/**
 * Agentopia Test Agent Creation and Deployment Verification
 * 
 * This script creates a test agent, activates its tool environment,
 * and verifies the deployment. It's primarily intended for CI/CD testing.
 * 
 * Usage:
 *   node scripts/create-and-verify-test-agent.js
 * 
 * The script will:
 * 1. Create a test agent with a unique ID
 * 2. Activate its tool environment (trigger DO droplet creation)
 * 3. Wait for the environment to be ready
 * 4. Verify the deployment
 * 5. Clean up (optionally delete the agent and droplet)
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'child_process';

// Get directory path and set up config
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = process.env.CONFIG_FILE || path.join(__dirname, '..', '.env');

// Load environment variables
dotenv.config({ path: CONFIG_FILE });

// Command line arguments
const skipCleanup = process.argv.includes('--skip-cleanup');
const maxWaitTimeMinutes = 15;

// Constants
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const AGENTOPIA_API_URL = process.env.AGENTOPIA_API_URL || 'https://txhscptzjrrudnqwavcb.supabase.co/functions/v1';

const TERMINAL_COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

// Initialization checks
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(`${TERMINAL_COLORS.red}Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required${TERMINAL_COLORS.reset}`);
  process.exit(1);
}

if (!AGENTOPIA_API_URL) {
  console.error(`${TERMINAL_COLORS.red}Error: AGENTOPIA_API_URL is required${TERMINAL_COLORS.reset}`);
  process.exit(1);
}

// Initialize Supabase client with admin privileges
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Log title
console.log(`\n${TERMINAL_COLORS.bright}${TERMINAL_COLORS.cyan}=== Agentopia Test Agent Creation & Deployment ===\n${TERMINAL_COLORS.reset}`);
console.log(`Config: ${CONFIG_FILE}`);
console.log(`Cleanup: ${skipCleanup ? 'Skipped' : 'Enabled'}`);
console.log(`Max wait time: ${maxWaitTimeMinutes} minutes\n`);

async function runTest() {
  let testAgentId = null;
  
  try {
    // Step 1: Create a test agent
    testAgentId = await createTestAgent();
    
    // Step 2: Activate tool environment
    await activateToolEnvironment(testAgentId);
    
    // Step 3: Verify deployment (using the verification script)
    const verificationResult = await verifyDeployment(testAgentId);
    
    if (verificationResult) {
      console.log(`\n${TERMINAL_COLORS.green}${TERMINAL_COLORS.bright}✓ TEST PASSED: Agent tool environment deployed successfully${TERMINAL_COLORS.reset}\n`);
    } else {
      console.error(`\n${TERMINAL_COLORS.red}${TERMINAL_COLORS.bright}✗ TEST FAILED: Agent tool environment deployment verification failed${TERMINAL_COLORS.reset}\n`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`\n${TERMINAL_COLORS.red}${TERMINAL_COLORS.bright}✗ TEST FAILED: ${error.message}${TERMINAL_COLORS.reset}\n`);
    process.exit(1);
  } finally {
    // Step 4: Cleanup (if not skipped)
    if (testAgentId && !skipCleanup) {
      await cleanupResources(testAgentId);
    } else if (testAgentId) {
      console.log(`\n${TERMINAL_COLORS.yellow}Cleanup skipped. Test agent ${testAgentId} and its resources were not deleted.${TERMINAL_COLORS.reset}`);
    }
  }
}

async function createTestAgent() {
  console.log(`\n${TERMINAL_COLORS.bright}${TERMINAL_COLORS.blue}1. Creating Test Agent${TERMINAL_COLORS.reset}`);
  
  // Generate a unique ID for the test agent
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  const testAgentId = `ci-test-agent-${timestamp}-${randomSuffix}`;
  
  console.log(`Creating agent with ID: ${TERMINAL_COLORS.magenta}${testAgentId}${TERMINAL_COLORS.reset}`);
  
  try {
    const { data: agent, error } = await supabase
      .from('agents')
      .insert({
        id: testAgentId,
        name: `CI Test Agent ${timestamp}`,
        description: 'Automatically created for deployment testing',
        active: true,
        created_by: 'ci-system',
        updated_by: 'ci-system',
        is_test_agent: true
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create test agent: ${error.message}`);
    }
    
    console.log(`${TERMINAL_COLORS.green}✓ Test agent created successfully${TERMINAL_COLORS.reset}`);
    return testAgentId;
    
  } catch (error) {
    console.error(`${TERMINAL_COLORS.red}Error creating test agent:${TERMINAL_COLORS.reset}`, error);
    throw error;
  }
}

async function activateToolEnvironment(agentId) {
  console.log(`\n${TERMINAL_COLORS.bright}${TERMINAL_COLORS.blue}2. Activating Tool Environment${TERMINAL_COLORS.reset}`);
  
  try {
    console.log(`Calling manage-agent-tool-environment endpoint for agent ${agentId}...`);
    
    // Create an authenticated client to call the edge function
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await authClient.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL,
      password: process.env.TEST_USER_PASSWORD
    });
    
    // Call the edge function to activate the tool environment
    const { data, error } = await authClient.functions.invoke(
      `manage-agent-tool-environment/${agentId}`,
      {
        method: 'POST'
      }
    );
    
    if (error) {
      throw new Error(`Failed to activate tool environment: ${error.message}`);
    }
    
    console.log(`${TERMINAL_COLORS.green}✓ Tool environment activation initiated${TERMINAL_COLORS.reset}`);
    console.log(`Response: ${JSON.stringify(data)}`);
    
    return true;
  } catch (error) {
    console.error(`${TERMINAL_COLORS.red}Error activating tool environment:${TERMINAL_COLORS.reset}`, error);
    throw error;
  }
}

async function verifyDeployment(agentId) {
  console.log(`\n${TERMINAL_COLORS.bright}${TERMINAL_COLORS.blue}3. Verifying Deployment${TERMINAL_COLORS.reset}`);
  
  try {
    console.log(`Running verification script for agent ${agentId}...`);
    console.log(`Waiting up to ${maxWaitTimeMinutes} minutes for deployment to complete`);
    
    // Use the verify-agent-deployment.js script with --wait-for-ready flag
    const verifyScript = path.join(__dirname, 'verify-agent-deployment.js');
    
    try {
      execFileSync('node', [verifyScript, agentId, '--wait-for-ready'], { 
        stdio: 'inherit',
        timeout: maxWaitTimeMinutes * 60 * 1000
      });
      return true;
    } catch (error) {
      console.error(`${TERMINAL_COLORS.red}Verification script failed:${TERMINAL_COLORS.reset}`, error);
      return false;
    }
    
  } catch (error) {
    console.error(`${TERMINAL_COLORS.red}Error verifying deployment:${TERMINAL_COLORS.reset}`, error);
    return false;
  }
}

async function cleanupResources(agentId) {
  console.log(`\n${TERMINAL_COLORS.bright}${TERMINAL_COLORS.blue}4. Cleaning Up Resources${TERMINAL_COLORS.reset}`);
  
  try {
    // First, deactivate the tool environment
    console.log(`Deactivating tool environment for agent ${agentId}...`);
    
    // Create an authenticated client to call the edge function
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await authClient.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL,
      password: process.env.TEST_USER_PASSWORD
    });
    
    // Call the edge function to deactivate the tool environment
    const { error: deactivateError } = await authClient.functions.invoke(
      `manage-agent-tool-environment/${agentId}`,
      {
        method: 'DELETE'
      }
    );
    
    if (deactivateError) {
      console.error(`${TERMINAL_COLORS.yellow}Warning: Failed to deactivate tool environment: ${deactivateError.message}${TERMINAL_COLORS.reset}`);
    } else {
      console.log(`${TERMINAL_COLORS.green}✓ Tool environment deactivation initiated${TERMINAL_COLORS.reset}`);
    }
    
    // Wait a bit for the deactivation to process
    console.log('Waiting 10 seconds for deactivation to process...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Delete the test agent
    console.log(`Deleting test agent ${agentId}...`);
    const { error: deleteError } = await supabase
      .from('agents')
      .delete()
      .eq('id', agentId);
    
    if (deleteError) {
      console.error(`${TERMINAL_COLORS.yellow}Warning: Failed to delete test agent: ${deleteError.message}${TERMINAL_COLORS.reset}`);
    } else {
      console.log(`${TERMINAL_COLORS.green}✓ Test agent deleted${TERMINAL_COLORS.reset}`);
    }
    
    return true;
  } catch (error) {
    console.error(`${TERMINAL_COLORS.yellow}Warning: Error during cleanup:${TERMINAL_COLORS.reset}`, error);
    return false;
  }
}

// Run the test
runTest(); 