#!/usr/bin/env node

/**
 * Automated deployment script for Agentopia Voice WebSocket Server
 * Reads configuration from environment variables or .env file
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  Agentopia Voice WebSocket Server - Automated Deploy      ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Get configuration from environment
const config = {
  doToken: process.env.DO_API_TOKEN,
  domain: process.env.VOICE_WEBSOCKET_DOMAIN || 'voice.agentopia.ai',
  supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  email: process.env.SSL_EMAIL || 'admin@agentopia.ai',
  region: process.env.DO_REGION || 'nyc3',
  size: process.env.DO_DROPLET_SIZE || 's-1vcpu-1gb',
  image: 'ubuntu-22-04-x64'
};

// Validate required configuration
const missing = [];
if (!config.doToken) missing.push('DO_API_TOKEN');
if (!config.supabaseUrl) missing.push('SUPABASE_URL or VITE_SUPABASE_URL');
if (!config.supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_SERVICE_ROLE_KEY');

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(v => console.error(`   - ${v}`));
  console.error('\nPlease add them to your .env file or set them as environment variables.\n');
  process.exit(1);
}

console.log('✅ Configuration loaded from environment:\n');
console.log('═'.repeat(60));
console.log(`Domain:          ${config.domain}`);
console.log(`Supabase URL:    ${config.supabaseUrl}`);
console.log(`Region:          ${config.region}`);
console.log(`Droplet Size:    ${config.size}`);
console.log(`Email:           ${config.email}`);
console.log(`DO Token:        ${config.doToken.substring(0, 20)}...`);
console.log('═'.repeat(60) + '\n');

console.log('🚀 Starting deployment...\n');

deployServer(config)
  .then(() => {
    console.log('\n✅ Deployment initiated successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  });

async function deployServer(config) {
  const { doToken, domain, supabaseUrl, supabaseServiceKey, email, region, size, image } = config;
  
  console.log('📦 Creating DigitalOcean droplet...\n');
  
  // Generate cloud-init user data script
  const userData = generateUserData(domain, supabaseUrl, supabaseServiceKey, email);
  
  const dropletConfig = {
    name: `agentopia-voice-ws-${Date.now()}`,
    region,
    size,
    image,
    backups: false,
    ipv6: false,
    monitoring: true,
    tags: ['agentopia', 'voice-websocket', 'production'],
    user_data: userData
  };
  
  try {
    const response = await axios.post(
      'https://api.digitalocean.com/v2/droplets',
      dropletConfig,
      {
        headers: {
          'Authorization': `Bearer ${doToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const droplet = response.data.droplet;
    
    console.log('✅ Droplet created!');
    console.log(`   ID:     ${droplet.id}`);
    console.log(`   Name:   ${droplet.name}`);
    console.log(`   Region: ${droplet.region.slug}`);
    
    // Wait for IP assignment
    console.log('\n⏳ Waiting for IP address assignment...');
    const ipAddress = await waitForDropletIP(doToken, droplet.id);
    
    console.log(`✅ IP Address: ${ipAddress}\n`);
    
    console.log('═'.repeat(60));
    console.log('⚠️  IMPORTANT NEXT STEPS');
    console.log('═'.repeat(60));
    console.log(`\n1. Update DNS A record:`);
    console.log(`   ${domain} → ${ipAddress}\n`);
    console.log(`2. Wait 5-10 minutes for droplet provisioning to complete\n`);
    console.log(`3. SSH into droplet:`);
    console.log(`   ssh root@${ipAddress}\n`);
    console.log(`4. Deploy server code:`);
    console.log(`   cd ${path.join(process.cwd(), 'services', 'websocket-voice-server')}`);
    console.log(`   npm run build`);
    console.log(`   scp -r dist package.json package-lock.json root@${ipAddress}:/opt/agentopia-voice-ws/\n`);
    console.log(`5. SSH back in and install dependencies:`);
    console.log(`   ssh root@${ipAddress}`);
    console.log(`   cd /opt/agentopia-voice-ws`);
    console.log(`   npm install --production\n`);
    console.log(`6. Start the server:`);
    console.log(`   pm2 start dist/index.js --name voice-ws-server`);
    console.log(`   pm2 save\n`);
    console.log(`7. Obtain SSL certificate (after DNS propagates):`);
    console.log(`   certbot --nginx -d ${domain} --non-interactive --agree-tos --email ${email}\n`);
    console.log(`8. Test health endpoint:`);
    console.log(`   curl http://${ipAddress}:8081/health`);
    console.log(`   curl https://${domain}/health\n`);
    console.log(`9. Test WebSocket connection (from browser console):`);
    console.log(`   const ws = new WebSocket('wss://${domain}?token=YOUR_TOKEN&agent_id=YOUR_AGENT_ID');`);
    console.log(`   ws.onopen = () => console.log('Connected!');`);
    console.log(`   ws.onmessage = (e) => console.log(e.data);\n`);
    console.log('═'.repeat(60));
    
    // Save droplet info
    const dropletInfo = {
      id: droplet.id,
      name: droplet.name,
      ip: ipAddress,
      domain,
      region: droplet.region.slug,
      size: dropletConfig.size,
      createdAt: new Date().toISOString(),
      credentials: {
        supabaseUrl,
        // Don't save the actual keys for security
        hasServiceKey: !!supabaseServiceKey
      }
    };
    
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const infoPath = path.join(logsDir, `voice-ws-droplet-${droplet.id}.json`);
    fs.writeFileSync(infoPath, JSON.stringify(dropletInfo, null, 2));
    
    console.log(`\n📄 Droplet info saved to: ${infoPath}\n`);
    
  } catch (error) {
    if (error.response) {
      throw new Error(`DigitalOcean API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else {
      throw error;
    }
  }
}

function generateUserData(domain, supabaseUrl, supabaseServiceKey, email) {
  // Escape special characters for bash
  const escapedServiceKey = supabaseServiceKey.replace(/'/g, "'\\''");
  
  return `#!/bin/bash

# Agentopia Voice WebSocket Server Provisioning Script
# Generated: ${new Date().toISOString()}

set -e
exec > >(tee /var/log/cloud-init-output.log)
exec 2>&1

echo "═══════════════════════════════════════════════════════════"
echo "Starting Agentopia Voice WebSocket Server setup..."
echo "═══════════════════════════════════════════════════════════"

# Update system
echo "📦 Updating system packages..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

# Install Node.js 20.x
echo "📦 Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify Node.js installation
node --version
npm --version

# Install Nginx
echo "📦 Installing Nginx..."
apt-get install -y nginx

# Install Certbot
echo "📦 Installing Certbot..."
apt-get install -y certbot python3-certbot-nginx

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Create application directory
echo "📂 Creating application directory..."
mkdir -p /opt/agentopia-voice-ws
cd /opt/agentopia-voice-ws

# Create log directory
mkdir -p /var/log/websocket-voice-server
chmod 755 /var/log/websocket-voice-server

# Create environment file
echo "🔐 Creating environment file..."
cat > .env << 'ENV_EOF'
SUPABASE_URL=${supabaseUrl}
SUPABASE_SERVICE_ROLE_KEY='${escapedServiceKey}'
PORT=8080
NODE_ENV=production
LOG_LEVEL=info
MAX_CONNECTIONS=1000
CONNECTION_TIMEOUT=1800000
ENV_EOF

chmod 600 .env

# Configure Nginx
echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/${domain} << 'NGINX_EOF'
upstream voice_ws {
    server localhost:8080;
}

server {
    listen 80;
    server_name ${domain};
    
    location / {
        return 301 https://\$host\$request_uri;
    }
    
    # ACME challenge for Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
}

server {
    listen 443 ssl http2;
    server_name ${domain};
    
    # SSL certificates will be configured by Certbot
    # Temporary self-signed cert for initial setup
    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    
    location / {
        proxy_pass http://voice_ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 60s;
        proxy_buffering off;
    }
    
    location /health {
        proxy_pass http://localhost:8081/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        access_log off;
    }
}
NGINX_EOF

# Enable site
ln -sf /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
nginx -t

# Reload Nginx
systemctl reload nginx

# Configure firewall
echo "🔒 Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Setup PM2 to start on boot
echo "🔧 Configuring PM2 startup..."
pm2 startup systemd -u root --hp /root
pm2 save

# Create deployment instructions file
cat > /root/DEPLOYMENT_INSTRUCTIONS.txt << 'INSTRUCTIONS_EOF'
═══════════════════════════════════════════════════════════
Agentopia Voice WebSocket Server - Deployment Instructions
═══════════════════════════════════════════════════════════

Server is provisioned and ready for code deployment.

NEXT STEPS:

1. Deploy the server code from your local machine:
   
   cd ~/Agentopia/services/websocket-voice-server
   npm run build
   scp -r dist package.json package-lock.json root@THIS_SERVER:/opt/agentopia-voice-ws/

2. SSH into this server:
   
   ssh root@THIS_SERVER

3. Install dependencies:
   
   cd /opt/agentopia-voice-ws
   npm install --production

4. Start the server with PM2:
   
   pm2 start dist/index.js --name voice-ws-server
   pm2 save

5. Check server status:
   
   pm2 status
   pm2 logs voice-ws-server
   curl http://localhost:8081/health

6. Obtain SSL certificate (after DNS is propagated):
   
   certbot --nginx -d ${domain} --non-interactive --agree-tos --email ${email}

7. Test WebSocket connection from browser:
   
   const ws = new WebSocket('wss://${domain}?token=YOUR_TOKEN&agent_id=YOUR_AGENT_ID');
   ws.onopen = () => console.log('Connected!');
   ws.onmessage = (e) => console.log(e.data);

═══════════════════════════════════════════════════════════
INSTRUCTIONS_EOF

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Server provisioning complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📋 Instructions saved to: /root/DEPLOYMENT_INSTRUCTIONS.txt"
echo ""
echo "⚠️  IMPORTANT:"
echo "   1. Update DNS A record for ${domain}"
echo "   2. Deploy server code via SCP"
echo "   3. Run 'npm install --production' in /opt/agentopia-voice-ws"
echo "   4. Start server with: pm2 start dist/index.js --name voice-ws-server"
echo "   5. Obtain SSL cert: certbot --nginx -d ${domain}"
echo ""
echo "═══════════════════════════════════════════════════════════"
`;
}

async function waitForDropletIP(token, dropletId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const droplet = await getDroplet(token, dropletId);
    const publicNet = droplet.networks?.v4?.find(net => net.type === 'public');
    
    if (publicNet && publicNet.ip_address) {
      return publicNet.ip_address;
    }
    
    process.stdout.write('.');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Timeout waiting for droplet IP address');
}

async function getDroplet(token, dropletId) {
  const response = await axios.get(
    `https://api.digitalocean.com/v2/droplets/${dropletId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data.droplet;
}

