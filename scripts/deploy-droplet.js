// Simple script to deploy a DigitalOcean droplet for agent tools
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Get the agent ID from command line
const agentId = process.argv[2] || 'test-agent-' + Date.now().toString().slice(-6);

// Prompt for the DigitalOcean API token
console.log('=== DigitalOcean Droplet Deployment for Agentopia ===');
console.log(`Creating droplet for agent: ${agentId}`);

rl.question('\nPlease enter your DigitalOcean API token: ', (token) => {
  // Set environment variables
  process.env.DO_API_TOKEN = token;
  process.env.DO_DEFAULT_REGION = 'nyc3';
  process.env.DO_DEFAULT_SIZE = 's-1vcpu-1gb';
  process.env.DO_DEFAULT_IMAGE = 'ubuntu-22-04-x64';
  process.env.DTMA_GIT_REPO_URL = 'https://github.com/maverick-software/dtma-agent.git';
  process.env.AGENTOPIA_API_URL = 'https://txhscptzjrrudnqwavcb.supabase.co/functions/v1';

  console.log('\nConfiguration:');
  console.log(`- Region: ${process.env.DO_DEFAULT_REGION}`);
  console.log(`- Size: ${process.env.DO_DEFAULT_SIZE}`);
  console.log(`- Image: ${process.env.DO_DEFAULT_IMAGE}`);
  console.log(`- DTMA Repo: ${process.env.DTMA_GIT_REPO_URL}`);
  console.log(`- API URL: ${process.env.AGENTOPIA_API_URL}`);

  // Create droplet configuration
  const dropletName = `agent-${agentId}`;
  const dropletConfig = {
    name: dropletName,
    region: process.env.DO_DEFAULT_REGION,
    size: process.env.DO_DEFAULT_SIZE,
    image: process.env.DO_DEFAULT_IMAGE,
    backups: false,
    monitoring: true,
    tags: [`agent:${agentId}`, 'managed-by:agentopia'],
    user_data: generateUserData(agentId)
  };

  console.log('\nDeploying droplet...');
  createDroplet(dropletConfig, agentId)
    .then(() => {
      rl.close();
    })
    .catch(error => {
      console.error('Deployment failed:', error);
      rl.close();
    });
});

// Function to generate user data script for cloud-init
function generateUserData(agentId) {
  return `#!/bin/bash
# This script installs the DTMA agent on a freshly created droplet

# Update system
apt-get update
apt-get upgrade -y

# Install dependencies
apt-get install -y git nodejs npm

# Clone the DTMA repository
git clone ${process.env.DTMA_GIT_REPO_URL} /opt/dtma-agent
cd /opt/dtma-agent

# Install dependencies
npm install

# Configure the agent
cat > .env << EOF
AGENT_ID=${agentId}
AGENTOPIA_API_URL=${process.env.AGENTOPIA_API_URL}
EOF

# Install PM2 globally
npm install -g pm2

# Start the agent with PM2
pm2 start npm --name "dtma-agent" -- start
pm2 save
pm2 startup

# Log success
echo "DTMA agent deployed successfully for agent ID: ${agentId}" > /var/log/dtma-setup.log
`;
}

// Function to create droplet
async function createDroplet(dropletConfig, agentId) {
  try {
    const response = await axios.post('https://api.digitalocean.com/v2/droplets', dropletConfig, {
      headers: {
        'Authorization': `Bearer ${process.env.DO_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\n✅ Droplet creation initiated successfully!');
    console.log(`Droplet ID: ${response.data.droplet.id}`);
    console.log(`Droplet Name: ${response.data.droplet.name}`);
    console.log('The droplet is being provisioned. This may take a few minutes.');
    console.log('You can check the status in your DigitalOcean dashboard.');
    
    // Store droplet information for later reference
    const dropletInfo = {
      id: response.data.droplet.id,
      name: dropletConfig.name,
      agentId: agentId,
      region: dropletConfig.region,
      createdAt: new Date().toISOString()
    };
    
    const infoDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(infoDir)) {
      fs.mkdirSync(infoDir, { recursive: true });
    }
    
    const infoPath = path.join(infoDir, `droplet-${agentId}.json`);
    fs.writeFileSync(infoPath, JSON.stringify(dropletInfo, null, 2));
    
    console.log(`\nDroplet information saved to: ${infoPath}`);
    
    return response.data.droplet;
  } catch (error) {
    console.error('\n❌ Error creating droplet:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Error message:', error.response.data.message || 'Unknown error');
    } else {
      console.error(error.message);
    }
    throw error;
  }
} 