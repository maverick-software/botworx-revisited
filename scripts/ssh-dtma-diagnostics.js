#!/usr/bin/env node

/**
 * DTMA SSH Diagnostics Script
 * 
 * This script connects to your DigitalOcean droplet via SSH and runs
 * comprehensive DTMA service diagnostics to identify why DTMA is not running.
 * 
 * Usage: node ssh-dtma-diagnostics.js <droplet_ip> [ssh_key_path]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const DROPLET_IP = process.argv[2] || '134.122.127.203';
const SSH_KEY_PATH = process.argv[3] || path.join(process.env.HOME, '.ssh', 'id_rsa');
const SSH_USER = 'root';
const SSH_TIMEOUT = 30000; // 30 seconds

console.log('🔍 DTMA SSH Diagnostics Tool');
console.log('=====================================');
console.log(`Droplet IP: ${DROPLET_IP}`);
console.log(`SSH Key: ${SSH_KEY_PATH}`);
console.log(`SSH User: ${SSH_USER}`);
console.log('=====================================\n');

// Check if SSH key exists
if (!fs.existsSync(SSH_KEY_PATH)) {
    console.error(`❌ SSH key not found at: ${SSH_KEY_PATH}`);
    console.error('Please specify the correct SSH key path as the second argument.');
    console.error('Example: node ssh-dtma-diagnostics.js 134.122.127.203 ~/.ssh/my_key');
    process.exit(1);
}

/**
 * Execute SSH command on the droplet
 */
function sshExec(command, description = '') {
    console.log(`\n🔧 ${description || command}`);
    console.log('─'.repeat(50));
    
    try {
        const sshCommand = `ssh -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${SSH_USER}@${DROPLET_IP} "${command}"`;
        const result = execSync(sshCommand, { 
            encoding: 'utf8', 
            timeout: SSH_TIMEOUT,
            stdio: 'pipe'
        });
        
        console.log(result);
        return { success: true, output: result };
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        if (error.stdout) console.log('STDOUT:', error.stdout);
        if (error.stderr) console.log('STDERR:', error.stderr);
        return { success: false, error: error.message };
    }
}

/**
 * Test SSH connectivity
 */
function testSSHConnection() {
    console.log('🔗 Testing SSH Connection...');
    const result = sshExec('echo "SSH connection successful"', 'SSH Connectivity Test');
    
    if (!result.success) {
        console.error('\n❌ SSH connection failed!');
        console.error('Possible issues:');
        console.error('1. SSH key is not authorized on the droplet');
        console.error('2. Droplet is not accessible');
        console.error('3. SSH service is not running on the droplet');
        console.error('4. Firewall is blocking SSH (port 22)');
        process.exit(1);
    }
    
    console.log('✅ SSH connection successful!');
}

/**
 * Run comprehensive DTMA diagnostics
 */
function runDTMADiagnostics() {
    console.log('\n🩺 Running DTMA Diagnostics...');
    
    // 1. System Information
    sshExec('uname -a && uptime && free -h && df -h', 'System Information');
    
    // 2. DTMA Service Status
    sshExec('systemctl status dtma --no-pager || echo "DTMA service not found"', 'DTMA Service Status');
    
    // 3. DTMA Process Check
    sshExec('ps aux | grep dtma | grep -v grep || echo "No DTMA processes found"', 'DTMA Process Check');
    
    // 4. Port 30000 Check
    sshExec('netstat -tulpn | grep :30000 || ss -tulpn | grep :30000 || echo "Port 30000 not in use"', 'Port 30000 Status');
    
    // 5. DTMA Directory Check
    sshExec('ls -la /opt/dtma* 2>/dev/null || echo "No DTMA directories found"', 'DTMA Installation Check');
    
    // 6. Node.js Processes
    sshExec('ps aux | grep node | grep -v grep || echo "No Node.js processes found"', 'Node.js Processes');
    
    // 7. Docker Status
    sshExec('systemctl status docker --no-pager && docker ps -a', 'Docker Status');
    
    // 8. Firewall Status
    sshExec('ufw status || iptables -L | head -20', 'Firewall Status');
    
    // 9. DTMA Logs (if service exists)
    sshExec('journalctl -u dtma --no-pager -n 20 2>/dev/null || echo "No DTMA service logs found"', 'DTMA Service Logs');
    
    // 10. Environment Check
    sshExec('ls -la /opt/dtma/.env 2>/dev/null && echo "Environment file found" || echo "No environment file found"', 'Environment Configuration');
    
    // 11. Git Status (if DTMA repo exists)
    sshExec('cd /opt/dtma 2>/dev/null && git status && git log --oneline -3 || echo "Not a git repository or directory does not exist"', 'Git Repository Status');
    
    // 12. Network Test
    sshExec('curl -v http://localhost:30000/status 2>&1 | head -10 || echo "Local DTMA connection failed"', 'Local DTMA Connection Test');
    
    // 13. Cloud-init logs
    sshExec('tail -20 /var/log/cloud-init-output.log 2>/dev/null || echo "No cloud-init logs found"', 'Cloud-init Setup Logs');
}

/**
 * Provide diagnostic summary and recommendations
 */
function provideDiagnosticSummary() {
    console.log('\n📋 Diagnostic Summary');
    console.log('=====================================');
    console.log('Based on the diagnostics above, check for these common issues:');
    console.log('');
    console.log('1. ❓ DTMA Service Not Installed');
    console.log('   - Look for "DTMA service not found" or "No DTMA directories found"');
    console.log('   - Solution: Install DTMA service');
    console.log('');
    console.log('2. ❓ DTMA Service Not Running');
    console.log('   - Look for "inactive" or "failed" in service status');
    console.log('   - Solution: Start DTMA service or check logs for errors');
    console.log('');
    console.log('3. ❓ Port 30000 Not Accessible');
    console.log('   - Look for "Port 30000 not in use"');
    console.log('   - Solution: Check if DTMA is binding to correct port');
    console.log('');
    console.log('4. ❓ Environment Configuration Missing');
    console.log('   - Look for "No environment file found"');
    console.log('   - Solution: Create .env file with required variables');
    console.log('');
    console.log('5. ❓ Firewall Blocking Port');
    console.log('   - Check firewall status for port 30000 rules');
    console.log('   - Solution: Open port 30000 in firewall');
    console.log('');
    console.log('🔧 Quick Fix Commands:');
    console.log('To run these commands, SSH into your droplet:');
    console.log(`ssh -i "${SSH_KEY_PATH}" ${SSH_USER}@${DROPLET_IP}`);
    console.log('');
    console.log('Then try these commands:');
    console.log('sudo systemctl start dtma');
    console.log('sudo systemctl enable dtma');
    console.log('sudo ufw allow 30000');
    console.log('cd /opt/dtma && npm start');
}

/**
 * Main execution
 */
async function main() {
    try {
        // Test SSH connection first
        testSSHConnection();
        
        // Run comprehensive diagnostics
        runDTMADiagnostics();
        
        // Provide summary
        provideDiagnosticSummary();
        
        console.log('\n✅ Diagnostics completed successfully!');
        console.log('Review the output above to identify the root cause.');
        
    } catch (error) {
        console.error('💥 Diagnostic script failed:', error.message);
        process.exit(1);
    }
}

// Run the diagnostics
main(); 