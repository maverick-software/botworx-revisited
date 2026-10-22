// Script to deploy a DigitalOcean droplet for agent tools
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Setting environment variables directly from predefined values');

// Set environment variables directly
process.env.DO_API_TOKEN = 'YOUR_DO_TOKEN'; // Replace with actual token in production
process.env.DO_DEFAULT_REGION = 'nyc3';
process.env.DO_DEFAULT_SIZE = 's-1vcpu-1gb';
process.env.DO_DEFAULT_IMAGE = 'ubuntu-22-04-x64';
process.env.DTMA_GIT_REPO_URL = 'https://github.com/maverick-software/dtma-agent.git';
process.env.AGENTOPIA_API_URL = 'https://txhscptzjrrudnqwavcb.supabase.co/functions/v1';

// Required environment variables
const requiredVars = [
  'DO_API_TOKEN',
  'DO_DEFAULT_REGION',
  'DO_DEFAULT_SIZE',
  'DO_DEFAULT_IMAGE',
  'DTMA_GIT_REPO_URL'
];

// Check for missing variables
console.log('Checking required environment variables:');
requiredVars.forEach(varName => {
  console.log(`- ${varName}: ${process.env[varName] ? '✅ Set' : '❌ Missing'}`);
});

const missingVars = requiredVars.filter(varName => !process.env[varName] || process.env[varName] === 'YOUR_DO_TOKEN');
if (missingVars.length > 0) {
  console.error('\nError: Missing or placeholder values for required environment variables:');
  missingVars.forEach(varName => console.error(`- ${varName}`));
  console.error('\nPlease update the script with valid values for these variables.');
  process.exit(1);
}

// Get agent ID from command line or use a test value
const agentId = process.argv[2] || 'test-agent-' + Date.now().toString().slice(-6);

console.log(`\n=== Deploying Droplet for Agent ${agentId} ===`);

// Create droplet configuration
const dropletName = `agent-${agentId}`;
const dropletConfig = {
  name: dropletName,
  region: process.env.DO_DEFAULT_REGION,
  size: process.env.DO_DEFAULT_SIZE,
  image: process.env.DO_DEFAULT_IMAGE,
  backups: process.env.DO_BACKUP_ENABLED === 'true',
  monitoring: process.env.DO_MONITORING === 'true',
  tags: [`agent:${agentId}`, 'managed-by:agentopia'],
  user_data: generateUserData(agentId)
};

if (process.env.DO_DEFAULT_SSH_KEY_IDS) {
  dropletConfig.ssh_keys = process.env.DO_DEFAULT_SSH_KEY_IDS.split(',').map(id => id.trim());
}

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

# If a specific branch is specified, check it out
${process.env.DTMA_GIT_BRANCH ? `git checkout ${process.env.DTMA_GIT_BRANCH}` : ''}

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
async function createDroplet() {
  try {
    console.log('Creating DigitalOcean droplet with the following configuration:');
    console.log(`- Name: ${dropletConfig.name}`);
    console.log(`- Region: ${dropletConfig.region}`);
    console.log(`- Size: ${dropletConfig.size}`);
    console.log(`- Image: ${dropletConfig.image}`);
    console.log(`- Tags: ${dropletConfig.tags.join(', ')}`);
    
    const response = await axios.post('https://api.digitalocean.com/v2/droplets', dropletConfig, {
      headers: {
        'Authorization': `Bearer ${process.env.DO_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\n✅ Droplet creation initiated successfully!');
    console.log(`Droplet ID: ${response.data.droplet.id}`);
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
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

// Create the droplet
createDroplet(); 