// Offline Deployment Test Script
// This script simulates the deployment process without requiring a public API URL

import dotenv from 'dotenv';
import { createDigitalOceanDroplet, getDigitalOceanDroplet, Droplet } from '../src/services/digitalocean_service';
import crypto from 'crypto';
import fs from 'fs/promises';

// Load environment variables
dotenv.config();

// Configuration
const TEST_AGENT_ID = process.env.TEST_AGENT_ID || 'test-agent-1';
const DO_API_TOKEN = process.env.DO_API_TOKEN;
const DTMA_GIT_REPO_URL = process.env.DTMA_GIT_REPO_URL || 'https://github.com/maverick-software/dtma-agent.git';

// Constants
const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 10000;

// Validate required environment variables
if (!DO_API_TOKEN) {
  console.error('ERROR: DO_API_TOKEN environment variable is required');
  process.exit(1);
}

if (!DTMA_GIT_REPO_URL) {
  console.error('ERROR: DTMA_GIT_REPO_URL environment variable is required');
  process.exit(1);
}

// Create user data script with offline mode
function createOfflineUserDataScript(): string {
  const dtmaAuthToken = crypto.randomBytes(32).toString('hex');
  const repoUrl = DTMA_GIT_REPO_URL;
  const branch = process.env.DTMA_GIT_BRANCH || 'main';
  
  console.log(`Using DTMA repository: ${repoUrl} (branch: ${branch})`);
  console.log(`Generated DTMA auth token: ${dtmaAuthToken}`);
  console.log('NOTE: Save this token for connecting to the DTMA later\n');
  
  // This script sets up the DTMA but configures it for offline mode
  return `#!/bin/bash
set -e
set -x

# --- Log File Setup ---
LOG_FILE="/var/log/dtma-bootstrap.log"
touch "\${LOG_FILE}"
chown "ubuntu":"ubuntu" "\${LOG_FILE}"
exec &> >(tee -a "\${LOG_FILE}")

# --- Variables ---
AGENTOPIA_DIR="/opt/agentopia"
DTMA_DIR="\${AGENTOPIA_DIR}/dtma"
DTMA_CONFIG_FILE="/etc/dtma.conf"
DTMA_SERVICE_FILE="/etc/systemd/system/dtma.service"
NODE_VERSION="20"
DTMA_AUTH_TOKEN_VALUE="${dtmaAuthToken}"
DTMA_REPO_URL="${repoUrl}"
DTMA_BRANCH="${branch}"
RUN_USER="ubuntu"
OFFLINE_MODE="true"

export DEBIAN_FRONTEND=noninteractive

echo "--- Starting DTMA Setup Script (OFFLINE MODE) ---"

# --- Install Prerequisites ---
echo "Installing prerequisites..."
apt-get update -y
apt-get install -y apt-transport-https ca-certificates curl software-properties-common git gpg

# Install Docker
echo "Installing Docker..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \\
  "deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \\
  \$(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add user to docker group
echo "Adding user \${RUN_USER} to Docker group..."
usermod -aG docker "\${RUN_USER}" || echo "Warning: Failed to add user \${RUN_USER} to docker group."

# Install Node.js
echo "Installing Node.js v\${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_\${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# --- Configure DTMA ---
echo "Creating DTMA config file at \${DTMA_CONFIG_FILE}..."
mkdir -p "\$(dirname "\${DTMA_CONFIG_FILE}")"
chown "\${RUN_USER}":"\${RUN_USER}" "\$(dirname "\${DTMA_CONFIG_FILE}")"

echo "DTMA_AUTH_TOKEN=\${DTMA_AUTH_TOKEN_VALUE}" > "\${DTMA_CONFIG_FILE}"
echo "OFFLINE_MODE=\${OFFLINE_MODE}" >> "\${DTMA_CONFIG_FILE}"
echo "# No AGENTOPIA_API_BASE_URL in offline mode" >> "\${DTMA_CONFIG_FILE}"
chmod 600 "\${DTMA_CONFIG_FILE}"
chown "\${RUN_USER}":"\${RUN_USER}" "\${DTMA_CONFIG_FILE}"

# --- Fetch and Build DTMA Code ---
echo "Cloning DTMA repository from \${DTMA_REPO_URL} branch \${DTMA_BRANCH}..."
mkdir -p "\${AGENTOPIA_DIR}"
chown "\${RUN_USER}":"\${RUN_USER}" "\${AGENTOPIA_DIR}"

# Clone the repository
echo "Attempting to clone as user \${RUN_USER}..."
sudo -u "\${RUN_USER}" git clone --branch "\${DTMA_BRANCH}" "\${DTMA_REPO_URL}" "\${DTMA_DIR}"

if [ -d "\${DTMA_DIR}" ]; then
  cd "\${DTMA_DIR}"
  echo "Current directory: \$(pwd)"
  echo "Listing directory contents:"
  ls -la
  
  # Insert offline mode modifications
  echo "Modifying DTMA for offline mode..."
  cat <<EOF > "\${DTMA_DIR}/offline-mode.js"
// Offline mode support patch
// This file is added during bootstrap to support offline mode testing
import fs from 'fs';

export function isOfflineMode() {
  try {
    const config = fs.readFileSync('/etc/dtma.conf', 'utf8');
    return config.includes('OFFLINE_MODE=true');
  } catch (err) {
    console.error('Error reading config:', err);
    return false;
  }
}

export function logApiCall(endpoint, data) {
  console.log(\`[OFFLINE] Would call API endpoint: \${endpoint}\`);
  console.log(\`[OFFLINE] With data: \${JSON.stringify(data, null, 2)}\`);
  return { success: true, message: 'Offline mode - API call simulated' };
}
EOF

  # Patch agentopia_api_client.ts to use offline mode
  echo "Patching API client for offline mode..."
  sed -i '1s/^/import { isOfflineMode, logApiCall } from ".\/offline-mode.js";\n/' "\${DTMA_DIR}/src/agentopia_api_client.ts"
  sed -i 's/export async function sendHeartbeat/export async function sendHeartbeat/' "\${DTMA_DIR}/src/agentopia_api_client.ts"
  sed -i '/export async function sendHeartbeat/,/^}/{ s/const response = await axios.post/if (isOfflineMode()) {\n    return logApiCall("\/heartbeat", payload);\n  }\n  const response = await axios.post/; }' "\${DTMA_DIR}/src/agentopia_api_client.ts"
  
  echo "Installing DTMA dependencies as user \${RUN_USER}..."
  sudo -u "\${RUN_USER}" bash -c "cd \${DTMA_DIR} && npm install --production --unsafe-perm"
  
  echo "Building DTMA as user \${RUN_USER}..."
  sudo -u "\${RUN_USER}" bash -c "cd \${DTMA_DIR} && npm run build"
  
  echo "Ensuring \${DTMA_DIR} is owned by \${RUN_USER} post-build..."
  chown -R "\${RUN_USER}":"\${RUN_USER}" "\${DTMA_DIR}"
else
  echo "Error: Failed to clone DTMA repository into \${DTMA_DIR}." >&2
  exit 1
fi

# --- Set up systemd Service ---
echo "Creating systemd service file \${DTMA_SERVICE_FILE}..."
cat <<EOF > "\${DTMA_SERVICE_FILE}"
[Unit]
Description=Agentopia Droplet Tool Management Agent (Offline Mode)
After=network.target docker.service
Requires=docker.service

[Service]
EnvironmentFile=\${DTMA_CONFIG_FILE}
WorkingDirectory=\${DTMA_DIR}
ExecStart=/usr/bin/node dist/index.js
Restart=always
User=\${RUN_USER}
StandardOutput=journal
StandardError=journal
SyslogIdentifier=dtma

[Install]
WantedBy=multi-user.target
EOF

# --- Enable and Start Service ---
echo "Enabling and starting DTMA service..."
systemctl daemon-reload
systemctl enable dtma.service
systemctl start dtma.service

echo "--- DTMA setup complete (OFFLINE MODE) ---"
echo "Authentication token: ${dtmaAuthToken}"
echo "Note: This is an offline deployment for testing purposes only!"
`;
}

interface DropletInfo {
  agent_id: string;
  droplet_id: number;
  droplet_name: string;
  created_at: string;
  ip_address?: string;
  status?: string;
}

async function provisionOfflineTestDroplet(): Promise<void> {
  console.log(`Starting offline test deployment for agent: ${TEST_AGENT_ID}`);
  console.log('This will create a real DigitalOcean droplet but configure DTMA in offline mode');
  console.log('No public API URL is required for this test');
  
  // Generate unique droplet name
  const uniqueDropletName = `agent-${TEST_AGENT_ID}-env-${Date.now().toString().slice(-6)}`;
  console.log(`\nDroplet name: ${uniqueDropletName}`);
  
  // Create user data script for offline mode
  const userDataScript = createOfflineUserDataScript();
  
  // Get configuration from environment variables
  const dropletConfig = {
    name: uniqueDropletName,
    region: process.env.DO_DEFAULT_REGION || 'nyc3',
    size: process.env.DO_DEFAULT_SIZE || 's-1vcpu-1gb',
    image: process.env.DO_DEFAULT_IMAGE || 'ubuntu-22-04-x64',
    ssh_keys: process.env.DO_DEFAULT_SSH_KEY_IDS?.split(',').map(id => id.trim()).filter(id => id) || [],
    tags: ['agent-tool-environment', `agent:${TEST_AGENT_ID}`, 'offline-mode'],
    user_data: userDataScript,
    ipv6: false,
    monitoring: true,
    with_droplet_agent: true,
  };
  
  if (dropletConfig.ssh_keys.length === 0) {
    console.warn('\nWARNING: No SSH keys specified. You will not be able to SSH into the droplet.');
    console.warn('Add SSH keys to your DigitalOcean account and specify them in DO_DEFAULT_SSH_KEY_IDS.\n');
  }
  
  console.log('\nStarting droplet creation with configuration:');
  console.log(`Region: ${dropletConfig.region}`);
  console.log(`Size: ${dropletConfig.size}`);
  console.log(`Image: ${dropletConfig.image}`);
  console.log(`Tags: ${dropletConfig.tags.join(', ')}`);
  console.log('\nProvisioning droplet...');
  
  try {
    // Create the droplet
    const dropletResponse = await createDigitalOceanDroplet(dropletConfig);
    console.log(`\nDigitalOcean droplet creation initiated:`);
    console.log(`ID: ${dropletResponse.id}`);
    console.log(`Name: ${dropletResponse.name}`);
    console.log(`Initial status: ${dropletResponse.status}`);
    
    // Save droplet ID to file for reference
    await fs.writeFile(
      './offline-droplet-info.json', 
      JSON.stringify({
        agent_id: TEST_AGENT_ID,
        droplet_id: dropletResponse.id,
        droplet_name: dropletResponse.name,
        created_at: new Date().toISOString(),
      } as DropletInfo, null, 2)
    );
    console.log(`\nDroplet info saved to offline-droplet-info.json`);
    
    // Poll for active status
    console.log('\nPolling for droplet to become active...');
    
    let attempts = 0;
    let currentDropletState = dropletResponse;
    
    while (attempts < MAX_POLL_ATTEMPTS && currentDropletState.status !== 'active') {
      attempts++;
      console.log(`Polling attempt ${attempts}/${MAX_POLL_ATTEMPTS}. Current status: ${currentDropletState.status}`);
      
      // Wait for poll interval
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      
      try {
        // Check droplet status
        currentDropletState = await getDigitalOceanDroplet(currentDropletState.id);
      } catch (pollError) {
        console.error(`Error polling droplet status:`, pollError);
        break;
      }
    }
    
    if (currentDropletState.status === 'active') {
      console.log(`\nDroplet is now active!`);
      
      // Get IPv4 address
      const publicIpV4 = currentDropletState.networks.v4
        .find(net => net.type === 'public')?.ip_address;
      
      console.log(`\n============ DEPLOYMENT SUCCESSFUL ============`);
      console.log(`Droplet ID: ${currentDropletState.id}`);
      console.log(`IP Address: ${publicIpV4 || 'Not available'}`);
      console.log(`Status: ${currentDropletState.status}`);
      console.log(`\nTo check DTMA status:`);
      console.log(`1. Wait 3-5 minutes for bootstrap script to complete`);
      console.log(`2. Run: node scripts/check-dtma-status.js ${publicIpV4 || '<IP_ADDRESS>'}`);
      console.log(`\nTo SSH into the droplet (if SSH keys are configured):`);
      console.log(`ssh ubuntu@${publicIpV4 || '<IP_ADDRESS>'}`);
      console.log(`\nTo clean up when finished:`);
      console.log(`node scripts/deprovision-test-droplet.js ${currentDropletState.id}`);
      console.log(`==============================================`);
      
      // Update droplet info file with IP
      const dropletInfo = JSON.parse(await fs.readFile('./offline-droplet-info.json', 'utf8')) as DropletInfo;
      dropletInfo.ip_address = publicIpV4;
      dropletInfo.status = currentDropletState.status;
      await fs.writeFile('./offline-droplet-info.json', JSON.stringify(dropletInfo, null, 2));
    } else {
      console.error(`\nDroplet did not become active after ${attempts} polling attempts.`);
      console.error(`Last status: ${currentDropletState.status}`);
      console.error(`Check the DigitalOcean console for more information.`);
    }
  } catch (error) {
    console.error(`\nError deploying test droplet:`, error);
  }
}

// Execute the offline test deployment
provisionOfflineTestDroplet(); 