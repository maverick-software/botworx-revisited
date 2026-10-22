#!/usr/bin/env node

const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Configuration
const DROPLET_IP = '147.182.160.136';
const SSH_USER = 'ubuntu';
const SSH_KEY_PATH = path.join(process.env.USERPROFILE || process.env.HOME, '.ssh', 'id_rsa');

// ANSI color codes
const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

async function checkDockerContainerStatus() {
    const ssh = new NodeSSH();
    
    try {
        console.log(`${COLORS.cyan}🔌 Connecting to droplet ${DROPLET_IP}...${COLORS.reset}`);
        
        if (!fs.existsSync(SSH_KEY_PATH)) {
            throw new Error(`SSH key not found at ${SSH_KEY_PATH}`);
        }
        
        await ssh.connect({
            host: DROPLET_IP,
            username: SSH_USER,
            privateKeyPath: SSH_KEY_PATH,
            readyTimeout: 10000
        });
        
        console.log(`${COLORS.green}✅ SSH connection established${COLORS.reset}\n`);
        
        // Check if Docker is installed and running
        console.log(`${COLORS.bright}📦 Checking Docker installation...${COLORS.reset}`);
        const dockerVersion = await ssh.execCommand('docker --version');
        if (dockerVersion.code === 0) {
            console.log(`${COLORS.green}✅ Docker installed: ${dockerVersion.stdout.trim()}${COLORS.reset}`);
        } else {
            console.log(`${COLORS.red}❌ Docker not found or not working${COLORS.reset}`);
            console.log(`${COLORS.yellow}Error: ${dockerVersion.stderr}${COLORS.reset}`);
        }
        
        // Check Docker daemon status
        console.log(`${COLORS.bright}🔧 Checking Docker daemon status...${COLORS.reset}`);
        const dockerStatus = await ssh.execCommand('sudo systemctl is-active docker');
        if (dockerStatus.code === 0 && dockerStatus.stdout.trim() === 'active') {
            console.log(`${COLORS.green}✅ Docker daemon is active${COLORS.reset}`);
        } else {
            console.log(`${COLORS.red}❌ Docker daemon is not active: ${dockerStatus.stdout.trim()}${COLORS.reset}`);
        }
        
        // List all containers
        console.log(`${COLORS.bright}📋 Listing all Docker containers...${COLORS.reset}`);
        const allContainers = await ssh.execCommand('docker ps -a --format "table {{.Names}}\\t{{.Status}}\\t{{.Image}}\\t{{.Ports}}"');
        if (allContainers.code === 0) {
            console.log(`${COLORS.cyan}All containers:${COLORS.reset}`);
            console.log(allContainers.stdout);
        } else {
            console.log(`${COLORS.red}❌ Failed to list containers: ${allContainers.stderr}${COLORS.reset}`);
        }
        
        // Check specifically for DTMA container
        console.log(`${COLORS.bright}🎯 Checking for DTMA container...${COLORS.reset}`);
        const dtmaContainer = await ssh.execCommand('docker ps -a --filter "name=dtma" --format "table {{.Names}}\\t{{.Status}}\\t{{.Image}}\\t{{.Ports}}"');
        if (dtmaContainer.code === 0) {
            if (dtmaContainer.stdout.trim()) {
                console.log(`${COLORS.green}✅ DTMA container found:${COLORS.reset}`);
                console.log(dtmaContainer.stdout);
                
                // Check if it's running
                const runningDtma = await ssh.execCommand('docker ps --filter "name=dtma" --format "{{.Names}}"');
                if (runningDtma.stdout.trim()) {
                    console.log(`${COLORS.green}✅ DTMA container is RUNNING${COLORS.reset}`);
                } else {
                    console.log(`${COLORS.red}❌ DTMA container exists but is NOT RUNNING${COLORS.reset}`);
                    
                    // Get logs from stopped container
                    console.log(`${COLORS.bright}📝 Getting DTMA container logs...${COLORS.reset}`);
                    const logs = await ssh.execCommand('docker logs dtma --tail 50');
                    if (logs.stdout || logs.stderr) {
                        console.log(`${COLORS.yellow}Container logs:${COLORS.reset}`);
                        console.log(logs.stdout);
                        if (logs.stderr) {
                            console.log(`${COLORS.red}Error logs:${COLORS.reset}`);
                            console.log(logs.stderr);
                        }
                    }
                }
            } else {
                console.log(`${COLORS.red}❌ No DTMA container found${COLORS.reset}`);
            }
        }
        
        // Check for any containers listening on port 30000
        console.log(`${COLORS.bright}🔍 Checking what's listening on port 30000...${COLORS.reset}`);
        const portCheck = await ssh.execCommand('sudo netstat -tlnp | grep :30000 || echo "Nothing listening on port 30000"');
        console.log(`${COLORS.cyan}Port 30000 status:${COLORS.reset}`);
        console.log(portCheck.stdout);
        
        // Check systemd services for DTMA
        console.log(`${COLORS.bright}🔧 Checking systemd services for DTMA...${COLORS.reset}`);
        const systemdCheck = await ssh.execCommand('sudo systemctl list-units --type=service | grep -i dtma || echo "No DTMA systemd services found"');
        console.log(`${COLORS.cyan}DTMA systemd services:${COLORS.reset}`);
        console.log(systemdCheck.stdout);
        
        // Check user-data script execution
        console.log(`${COLORS.bright}📜 Checking cloud-init logs for deployment script...${COLORS.reset}`);
        const cloudInitLogs = await ssh.execCommand('sudo tail -n 50 /var/log/cloud-init-output.log | grep -i -A5 -B5 "dtma\\|docker" || echo "No DTMA/Docker logs found in cloud-init"');
        console.log(`${COLORS.cyan}Cloud-init deployment logs:${COLORS.reset}`);
        console.log(cloudInitLogs.stdout);
        
    } catch (error) {
        console.error(`${COLORS.red}❌ Error: ${error.message}${COLORS.reset}`);
    } finally {
        ssh.dispose();
    }
}

// Run the check
checkDockerContainerStatus().catch(console.error); 