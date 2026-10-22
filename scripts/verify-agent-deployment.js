#!/usr/bin/env node
/**
 * Agentopia Agent Environment Deployment Verification Test
 * 
 * This script performs comprehensive tests to verify that an agent's tool environment
 * (DigitalOcean droplet) has been properly deployed and is functional.
 * 
 * Usage:
 *   node scripts/verify-agent-deployment.js <agent-id> [--wait-for-ready]
 * 
 * The --wait-for-ready flag will poll until the droplet is active and the DTMA agent is running,
 * or until a timeout is reached.
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// Get directory path and set up config
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = process.env.CONFIG_FILE || path.join(__dirname, '..', '.env');

// Load environment variables
dotenv.config({ path: CONFIG_FILE });

// Extract command line args
const agentId = process.argv[2];
const waitForReady = process.argv.includes('--wait-for-ready');
const maxWaitTimeMinutes = 15;
const pollingIntervalSeconds = 30;

// Constants
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
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

if (!agentId) {
  console.error(`${TERMINAL_COLORS.red}Error: Agent ID is required${TERMINAL_COLORS.reset}`);
  console.error(`Usage: node ${path.basename(__filename)} <agent-id> [--wait-for-ready]`);
  process.exit(1);
}

// Log title
console.log(`\n${TERMINAL_COLORS.bright}${TERMINAL_COLORS.cyan}=== Agentopia Agent Deployment Verification ===\n${TERMINAL_COLORS.reset}`);
console.log(`Agent ID: ${TERMINAL_COLORS.magenta}${agentId}${TERMINAL_COLORS.reset}`);
console.log(`Mode: ${waitForReady ? 'Wait for ready (up to ' + maxWaitTimeMinutes + ' minutes)' : 'Immediate check'}`);
console.log(`Configuration: ${CONFIG_FILE}\n`);

// Initialize Supabase client
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

async function runVerification() {
  try {
    let results = {
      environment: await verifyEnvironment(),
      agent: await verifyAgent(agentId),
      droplet: await verifyDroplet(agentId),
      dtma: await verifyDTMA(agentId),
      connections: await verifyConnections(agentId)
    };

    if (waitForReady && !results.droplet.isReady) {
      const startTime = new Date();
      const timeoutTime = new Date(startTime.getTime() + (maxWaitTimeMinutes * 60 * 1000));
      
      console.log(`\n${TERMINAL_COLORS.yellow}Droplet not ready. Waiting for ready state...${TERMINAL_COLORS.reset}`);
      
      let pollCount = 0;
      while (new Date() < timeoutTime) {
        pollCount++;
        console.log(`\n${TERMINAL_COLORS.cyan}[Poll ${pollCount}] Checking droplet status...${TERMINAL_COLORS.reset}`);
        
        results.droplet = await verifyDroplet(agentId);
        if (results.droplet.isReady) {
          console.log(`${TERMINAL_COLORS.green}Droplet is now ready!${TERMINAL_COLORS.reset}`);
          
          // Check DTMA once the droplet is ready
          results.dtma = await verifyDTMA(agentId);
          if (results.dtma.isRunning) {
            console.log(`${TERMINAL_COLORS.green}DTMA agent is running!${TERMINAL_COLORS.reset}`);
            break;
          }
        }
        
        const timeRemaining = Math.floor((timeoutTime - new Date()) / 1000);
        if (timeRemaining <= 0) {
          console.log(`${TERMINAL_COLORS.red}Timeout reached waiting for droplet to be ready.${TERMINAL_COLORS.reset}`);
          break;
        }
        
        console.log(`Waiting ${pollingIntervalSeconds} seconds before next check. Timeout in ${Math.floor(timeRemaining / 60)}m ${timeRemaining % 60}s`);
        await new Promise(resolve => setTimeout(resolve, pollingIntervalSeconds * 1000));
      }
    }

    // Print final summary
    printFinalSummary(results);
    
    // Exit with appropriate code
    const isSuccess = results.environment.success && 
                      results.agent.exists && 
                      results.droplet.exists && 
                      (results.droplet.isReady || !waitForReady) &&
                      (results.dtma.isRunning || !waitForReady);
                      
    process.exit(isSuccess ? 0 : 1);
    
  } catch (error) {
    console.error(`\n${TERMINAL_COLORS.red}Verification failed with error:${TERMINAL_COLORS.reset}`, error);
    process.exit(1);
  }
}

async function verifyEnvironment() {
  console.log(`\n${TERMINAL_COLORS.bright}${TERMINAL_COLORS.blue}1. Environment Verification${TERMINAL_COLORS.reset}`);
  
  const requiredVars = [
    'DO_API_TOKEN',
    'DO_DEFAULT_REGION',
    'DO_DEFAULT_SIZE',
    'DO_DEFAULT_IMAGE',
    'DTMA_GIT_REPO_URL',
    'AGENTOPIA_API_URL'
  ];
  
  const missingVars = [];
  
  for (const varName of requiredVars) {
    const exists = typeof process.env[varName] !== 'undefined' && process.env[varName] !== '';
    console.log(`- ${varName}: ${exists ? `${TERMINAL_COLORS.green}✓ Found${TERMINAL_COLORS.reset}` : `${TERMINAL_COLORS.red}✗ Missing${TERMINAL_COLORS.reset}`}`);
    if (!exists) missingVars.push(varName);
  }
  
  if (supabase) {
    console.log(`- ${TERMINAL_COLORS.green}✓ Supabase client initialized${TERMINAL_COLORS.reset}`);
  } else {
    console.log(`- ${TERMINAL_COLORS.red}✗ Supabase client not initialized (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)${TERMINAL_COLORS.reset}`);
    missingVars.push('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return {
    success: missingVars.length === 0,
    missingVars
  };
}

async function verifyAgent(agentId) {
  console.log(`\n${TERMINAL_COLORS.bright}${TERMINAL_COLORS.blue}2. Agent Verification${TERMINAL_COLORS.reset}`);
  
  if (!supabase) {
    console.log(`- ${TERMINAL_COLORS.red}Cannot verify agent: Supabase client not initialized${TERMINAL_COLORS.reset}`);
    return { exists: false, error: 'Supabase client not initialized' };
  }
  
  try {
    console.log(`Checking agent ${agentId} in Supabase...`);
    const { data: agent, error } = await supabase
      .from('agents')
      .select('id, name, active')
      .eq('id', agentId)
      .single();
    
    if (error) {
      console.log(`- ${TERMINAL_COLORS.red}✗ Error checking agent: ${error.message}${TERMINAL_COLORS.reset}`);
      return { exists: false, error: error.message };
    }
    
    if (!agent) {
      console.log(`- ${TERMINAL_COLORS.red}✗ Agent does not exist in database${TERMINAL_COLORS.reset}`);
      return { exists: false };
    }
    
    console.log(`- ${TERMINAL_COLORS.green}✓ Agent exists${TERMINAL_COLORS.reset}`);
    console.log(`  Name: ${agent.name}`);
    console.log(`  Active: ${agent.active ? 'Yes' : 'No'}`);
    
    return { 
      exists: true,
      data: agent
    };
    
  } catch (error) {
    console.log(`- ${TERMINAL_COLORS.red}✗ Error checking agent: ${error.message}${TERMINAL_COLORS.reset}`);
    return { exists: false, error: error.message };
  }
}

async function verifyDroplet(agentId) {
  console.log(`\n${TERMINAL_COLORS.bright}${TERMINAL_COLORS.blue}3. Droplet Verification${TERMINAL_COLORS.reset}`);
  
  if (!supabase) {
    console.log(`- ${TERMINAL_COLORS.red}Cannot verify droplet: Supabase client not initialized${TERMINAL_COLORS.reset}`);
    return { exists: false, isReady: false, error: 'Supabase client not initialized' };
  }
  
  try {
    console.log(`Checking droplet for agent ${agentId} in Supabase...`);
    const { data: droplet, error } = await supabase
      .from('agent_droplets')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.log(`- ${TERMINAL_COLORS.red}✗ Error checking droplet: ${error.message}${TERMINAL_COLORS.reset}`);
      return { exists: false, isReady: false, error: error.message };
    }
    
    if (!droplet) {
      console.log(`- ${TERMINAL_COLORS.red}✗ No droplet found for this agent${TERMINAL_COLORS.reset}`);
      return { exists: false, isReady: false };
    }
    
    console.log(`- ${TERMINAL_COLORS.green}✓ Droplet exists in database${TERMINAL_COLORS.reset}`);
    console.log(`  ID: ${droplet.id}`);
    console.log(`  DO Droplet ID: ${droplet.do_droplet_id || 'Not set'}`);
    console.log(`  Status: ${droplet.status}`);
    console.log(`  IP Address: ${droplet.ip_address || 'Not assigned yet'}`);
    console.log(`  Region: ${droplet.region_slug}`);
    console.log(`  Size: ${droplet.size_slug}`);
    console.log(`  Created: ${new Date(droplet.created_at).toLocaleString()}`);
    
    const isReady = droplet.status === 'active' && droplet.ip_address;
    
    if (isReady) {
      console.log(`- ${TERMINAL_COLORS.green}✓ Droplet is active and has an IP address${TERMINAL_COLORS.reset}`);
    } else {
      console.log(`- ${TERMINAL_COLORS.yellow}⚠ Droplet is not ready (status: ${droplet.status}, ip: ${droplet.ip_address || 'none'})${TERMINAL_COLORS.reset}`);
    }
    
    // Verify in DigitalOcean directly if we have a DO droplet ID
    if (droplet.do_droplet_id && process.env.DO_API_TOKEN) {
      try {
        console.log(`Checking droplet ${droplet.do_droplet_id} in DigitalOcean...`);
        const doResponse = await axios.get(`https://api.digitalocean.com/v2/droplets/${droplet.do_droplet_id}`, {
          headers: {
            'Authorization': `Bearer ${process.env.DO_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (doResponse.data && doResponse.data.droplet) {
          const doDroplet = doResponse.data.droplet;
          console.log(`- ${TERMINAL_COLORS.green}✓ Droplet found in DigitalOcean${TERMINAL_COLORS.reset}`);
          console.log(`  DO Status: ${doDroplet.status}`);
          
          // Add more detailed DigitalOcean status info
          if (doDroplet.networks && doDroplet.networks.v4 && doDroplet.networks.v4.length > 0) {
            const publicIp = doDroplet.networks.v4.find(n => n.type === 'public')?.ip_address;
            console.log(`  DO Public IP: ${publicIp || 'None'}`);
            
            // Check if IP matches what's in our database
            if (publicIp && droplet.ip_address && publicIp !== droplet.ip_address) {
              console.log(`- ${TERMINAL_COLORS.yellow}⚠ IP address mismatch: DB has ${droplet.ip_address}, DO has ${publicIp}${TERMINAL_COLORS.reset}`);
            }
          }
        } else {
          console.log(`- ${TERMINAL_COLORS.red}✗ Unexpected response from DigitalOcean API${TERMINAL_COLORS.reset}`);
        }
      } catch (doError) {
        console.log(`- ${TERMINAL_COLORS.red}✗ Error checking droplet in DigitalOcean: ${doError.message}${TERMINAL_COLORS.reset}`);
        if (doError.response) {
          console.log(`  Status: ${doError.response.status}`);
          console.log(`  Message: ${JSON.stringify(doError.response.data)}`);
        }
      }
    }
    
    return { 
      exists: true,
      isReady,
      data: droplet
    };
    
  } catch (error) {
    console.log(`- ${TERMINAL_COLORS.red}✗ Error checking droplet: ${error.message}${TERMINAL_COLORS.reset}`);
    return { exists: false, isReady: false, error: error.message };
  }
}

async function verifyDTMA(agentId) {
  console.log(`\n${TERMINAL_COLORS.bright}${TERMINAL_COLORS.blue}4. DTMA Agent Verification${TERMINAL_COLORS.reset}`);
  
  if (!supabase) {
    console.log(`- ${TERMINAL_COLORS.red}Cannot verify DTMA: Supabase client not initialized${TERMINAL_COLORS.reset}`);
    return { isRunning: false, error: 'Supabase client not initialized' };
  }
  
  try {
    // First check if we have a droplet
    const { data: droplet, error } = await supabase
      .from('agent_droplets')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error || !droplet) {
      console.log(`- ${TERMINAL_COLORS.red}✗ Cannot verify DTMA: No droplet found${TERMINAL_COLORS.reset}`);
      return { isRunning: false, error: error?.message || 'No droplet found' };
    }
    
    // Check last heartbeat
    if (droplet.last_heartbeat_at) {
      const lastHeartbeat = new Date(droplet.last_heartbeat_at);
      const now = new Date();
      const diffMinutes = Math.floor((now - lastHeartbeat) / (1000 * 60));
      
      console.log(`- Last heartbeat: ${lastHeartbeat.toLocaleString()} (${diffMinutes} minutes ago)`);
      
      if (diffMinutes < 5) {
        console.log(`- ${TERMINAL_COLORS.green}✓ DTMA agent is running (recent heartbeat)${TERMINAL_COLORS.reset}`);
        return { isRunning: true, lastHeartbeat };
      } else {
        console.log(`- ${TERMINAL_COLORS.yellow}⚠ DTMA agent heartbeat is stale (${diffMinutes} minutes ago)${TERMINAL_COLORS.reset}`);
        return { isRunning: false, lastHeartbeat };
      }
    } else {
      console.log(`- ${TERMINAL_COLORS.yellow}⚠ No DTMA heartbeats recorded yet${TERMINAL_COLORS.reset}`);
      
      // For brand new droplets, we might not have a heartbeat yet, but the droplet could be active
      if (droplet.status === 'active' && droplet.ip_address) {
        const createdAt = new Date(droplet.created_at);
        const now = new Date();
        const diffMinutes = Math.floor((now - createdAt) / (1000 * 60));
        
        if (diffMinutes < 10) {
          console.log(`- ${TERMINAL_COLORS.yellow}⚠ Droplet was created ${diffMinutes} minutes ago, DTMA might still be initializing${TERMINAL_COLORS.reset}`);
        } else {
          console.log(`- ${TERMINAL_COLORS.red}✗ Droplet has been active for ${diffMinutes} minutes but no heartbeat received${TERMINAL_COLORS.reset}`);
        }
      }
      
      return { isRunning: false };
    }
    
  } catch (error) {
    console.log(`- ${TERMINAL_COLORS.red}✗ Error checking DTMA: ${error.message}${TERMINAL_COLORS.reset}`);
    return { isRunning: false, error: error.message };
  }
}

async function verifyConnections(agentId) {
  console.log(`\n${TERMINAL_COLORS.bright}${TERMINAL_COLORS.blue}5. Connection Tests${TERMINAL_COLORS.reset}`);
  
  // Check Supabase Edge Functions connectivity
  try {
    console.log(`Testing Supabase Edge Functions connectivity...`);
    const response = await axios.get(`${AGENTOPIA_API_URL}/heartbeat`, { 
      validateStatus: () => true,
      timeout: 5000
    });
    
    if (response.status === 401 || response.status === 403) {
      console.log(`- ${TERMINAL_COLORS.green}✓ Supabase Edge Functions reachable (auth error expected)${TERMINAL_COLORS.reset}`);
      console.log(`  Status: ${response.status} (expected for unauthorized access)`);
    } else if (response.status >= 200 && response.status < 300) {
      console.log(`- ${TERMINAL_COLORS.green}✓ Supabase Edge Functions reachable${TERMINAL_COLORS.reset}`);
      console.log(`  Status: ${response.status}`);
    } else {
      console.log(`- ${TERMINAL_COLORS.yellow}⚠ Unexpected response from Supabase Edge Functions${TERMINAL_COLORS.reset}`);
      console.log(`  Status: ${response.status}`);
    }
  } catch (error) {
    console.log(`- ${TERMINAL_COLORS.red}✗ Error connecting to Supabase Edge Functions: ${error.message}${TERMINAL_COLORS.reset}`);
  }
  
  // Check DigitalOcean API connectivity
  if (process.env.DO_API_TOKEN) {
    try {
      console.log(`Testing DigitalOcean API connectivity...`);
      const doResponse = await axios.get('https://api.digitalocean.com/v2/account', {
        headers: {
          'Authorization': `Bearer ${process.env.DO_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
      if (doResponse.data && doResponse.data.account) {
        console.log(`- ${TERMINAL_COLORS.green}✓ DigitalOcean API accessible${TERMINAL_COLORS.reset}`);
        console.log(`  Account: ${doResponse.data.account.email}`);
        console.log(`  Status: ${doResponse.data.account.status}`);
      } else {
        console.log(`- ${TERMINAL_COLORS.yellow}⚠ Unexpected response from DigitalOcean API${TERMINAL_COLORS.reset}`);
      }
    } catch (error) {
      console.log(`- ${TERMINAL_COLORS.red}✗ Error connecting to DigitalOcean API: ${error.message}${TERMINAL_COLORS.reset}`);
      if (error.response) {
        console.log(`  Status: ${error.response.status}`);
        console.log(`  Message: ${JSON.stringify(error.response.data)}`);
      }
    }
  } else {
    console.log(`- ${TERMINAL_COLORS.yellow}⚠ Skipping DigitalOcean API check (no DO_API_TOKEN)${TERMINAL_COLORS.reset}`);
  }
  
  return { tested: true };
}

function printFinalSummary(results) {
  console.log(`\n${TERMINAL_COLORS.bright}${TERMINAL_COLORS.cyan}=== Verification Summary ===\n${TERMINAL_COLORS.reset}`);
  
  // Environment
  if (results.environment.success) {
    console.log(`${TERMINAL_COLORS.green}✓ Environment: All required variables found${TERMINAL_COLORS.reset}`);
  } else {
    console.log(`${TERMINAL_COLORS.red}✗ Environment: Missing variables: ${results.environment.missingVars.join(', ')}${TERMINAL_COLORS.reset}`);
  }
  
  // Agent
  if (results.agent.exists) {
    console.log(`${TERMINAL_COLORS.green}✓ Agent: Found in database${TERMINAL_COLORS.reset}`);
  } else {
    console.log(`${TERMINAL_COLORS.red}✗ Agent: Not found in database${TERMINAL_COLORS.reset}`);
  }
  
  // Droplet
  if (results.droplet.exists) {
    if (results.droplet.isReady) {
      console.log(`${TERMINAL_COLORS.green}✓ Droplet: Active and ready${TERMINAL_COLORS.reset}`);
    } else {
      console.log(`${TERMINAL_COLORS.yellow}⚠ Droplet: Exists but not ready (status: ${results.droplet.data?.status})${TERMINAL_COLORS.reset}`);
    }
  } else {
    console.log(`${TERMINAL_COLORS.red}✗ Droplet: Not found${TERMINAL_COLORS.reset}`);
  }
  
  // DTMA
  if (results.dtma.isRunning) {
    console.log(`${TERMINAL_COLORS.green}✓ DTMA Agent: Running${TERMINAL_COLORS.reset}`);
  } else if (results.dtma.lastHeartbeat) {
    console.log(`${TERMINAL_COLORS.yellow}⚠ DTMA Agent: Last heartbeat was ${Math.floor((new Date() - results.dtma.lastHeartbeat) / (1000 * 60))} minutes ago${TERMINAL_COLORS.reset}`);
  } else {
    console.log(`${TERMINAL_COLORS.red}✗ DTMA Agent: Not running (no heartbeat detected)${TERMINAL_COLORS.reset}`);
  }
  
  // Overall status
  const overallSuccess = results.environment.success && 
                         results.agent.exists && 
                         results.droplet.exists && 
                         (results.droplet.isReady || !waitForReady) &&
                         (results.dtma.isRunning || !waitForReady);
                   
  console.log(`\n${TERMINAL_COLORS.bright}${overallSuccess ? TERMINAL_COLORS.green + 'VERIFICATION PASSED' : TERMINAL_COLORS.red + 'VERIFICATION FAILED'}${TERMINAL_COLORS.reset}\n`);
}

// Run the verification
runVerification(); 