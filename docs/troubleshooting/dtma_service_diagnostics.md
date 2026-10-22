# DTMA Service Diagnostics Guide

## Overview
This guide helps diagnose why DTMA service is not responding on port 30000. The service should be running on your DigitalOcean droplet but is currently showing "Connection Refused" errors.

## Quick SSH Connection
To connect to your droplet and troubleshoot DTMA:

```bash
# Replace with your droplet IP
ssh root@134.122.127.203
```

## Step-by-Step Diagnostics

### 1. Check DTMA Service Status
```bash
# Check if DTMA service is running
sudo systemctl status dtma

# Check if service is enabled
sudo systemctl is-enabled dtma

# Check if service exists
sudo systemctl list-units --type=service | grep dtma
```

### 2. Check DTMA Process
```bash
# Look for DTMA process
ps aux | grep dtma

# Check what's running on port 30000
sudo netstat -tulpn | grep :30000
sudo ss -tulpn | grep :30000

# Check all Node.js processes
ps aux | grep node
```

### 3. Check DTMA Installation
```bash
# Check if DTMA directory exists
ls -la /opt/dtma
ls -la /opt/dtma-agent

# Check DTMA source code
cd /opt/dtma
pwd
ls -la
git status
git log --oneline -5
```

### 4. Check DTMA Configuration
```bash
# Check environment variables
cat /opt/dtma/.env
cat /opt/dtma-agent/.env

# Check systemd service file
cat /etc/systemd/system/dtma.service
sudo systemctl cat dtma
```

### 5. Check DTMA Logs
```bash
# Check systemd logs
sudo journalctl -u dtma -f --no-pager
sudo journalctl -u dtma --since "1 hour ago" --no-pager

# Check application logs
cd /opt/dtma
ls -la logs/
tail -f logs/*.log

# Check PM2 logs if using PM2
pm2 logs dtma
pm2 status
```

### 6. Manual DTMA Start Test
```bash
# Try starting DTMA manually
cd /opt/dtma
npm install
npm run build
npm start

# Or if using TypeScript directly
npx ts-node src/index.ts
```

### 7. Check Docker Status
```bash
# Check if Docker is running
sudo systemctl status docker

# Check Docker containers
sudo docker ps -a
sudo docker images

# Check Docker logs
sudo docker logs <container_id>
```

### 8. Check Network Configuration
```bash
# Check firewall status
sudo ufw status
sudo iptables -L

# Check if port 30000 is open
sudo netstat -tulpn | grep :30000
sudo ss -tulpn | grep :30000

# Test port accessibility
curl -v http://localhost:30000/status
wget -qO- http://localhost:30000/status
```

### 9. Check System Resources
```bash
# Check system resources
free -h
df -h
uptime
top -n 1

# Check disk space in DTMA directory
du -sh /opt/dtma*
```

### 10. Check Bootstrap/Setup Logs
```bash
# Check cloud-init logs
sudo cat /var/log/cloud-init.log
sudo cat /var/log/cloud-init-output.log

# Check setup script logs
ls -la /var/log/dtma*
cat /var/log/dtma-setup.log
```

## Common Issues and Solutions

### Issue 1: DTMA Service Not Installed
**Symptoms:** `systemctl status dtma` shows "Unit dtma.service could not be found"

**Solution:**
```bash
# Check if DTMA was cloned
ls -la /opt/dtma*

# If not, clone and setup
sudo git clone https://github.com/maverick-software/dtma-agent.git /opt/dtma
cd /opt/dtma
sudo npm install
sudo npm run build

# Create systemd service
sudo nano /etc/systemd/system/dtma.service
```

### Issue 2: DTMA Service Failing to Start
**Symptoms:** Service exists but status shows "failed" or "inactive"

**Solution:**
```bash
# Check detailed error logs
sudo journalctl -u dtma --no-pager -l

# Try manual start to see errors
cd /opt/dtma
npm start

# Check dependencies
npm install
```

### Issue 3: Port 30000 Not Accessible
**Symptoms:** Service running but port not accessible

**Solution:**
```bash
# Check if service is binding to correct port
sudo netstat -tulpn | grep node

# Check firewall
sudo ufw allow 30000
sudo ufw status

# Check if binding to localhost only
grep -r "localhost\|127.0.0.1" /opt/dtma/src/
```

### Issue 4: Environment Variables Missing
**Symptoms:** Service starts but fails with configuration errors

**Solution:**
```bash
# Check environment file
cat /opt/dtma/.env

# Create missing environment file
sudo nano /opt/dtma/.env
```

Required environment variables:
```bash
DTMA_BEARER_TOKEN=your_bearer_token
AGENTOPIA_API_BASE_URL=https://your-supabase-url.supabase.co
BACKEND_TO_DTMA_API_KEY=your_api_key
PORT=30000
```

### Issue 5: Node.js/NPM Issues
**Symptoms:** npm commands fail or Node.js not found

**Solution:**
```bash
# Check Node.js version
node --version
npm --version

# Install/update Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clear npm cache
npm cache clean --force
```

## Automated Diagnostics Script

Create and run this script to gather all diagnostic information:

```bash
#!/bin/bash
echo "=== DTMA Service Diagnostics ==="
echo "Timestamp: $(date)"
echo

echo "=== System Info ==="
uname -a
uptime
free -h
df -h
echo

echo "=== DTMA Service Status ==="
sudo systemctl status dtma --no-pager
echo

echo "=== DTMA Process Check ==="
ps aux | grep dtma
echo

echo "=== Port 30000 Check ==="
sudo netstat -tulpn | grep :30000
echo

echo "=== DTMA Directory ==="
ls -la /opt/dtma*
echo

echo "=== DTMA Logs (last 20 lines) ==="
sudo journalctl -u dtma --no-pager -n 20
echo

echo "=== Docker Status ==="
sudo systemctl status docker --no-pager
sudo docker ps -a
echo

echo "=== Firewall Status ==="
sudo ufw status
echo

echo "=== Network Test ==="
curl -v http://localhost:30000/status 2>&1 | head -10
echo

echo "=== Environment Check ==="
if [ -f /opt/dtma/.env ]; then
    echo "Environment file exists"
    wc -l /opt/dtma/.env
else
    echo "No environment file found"
fi
echo

echo "=== Git Status ==="
cd /opt/dtma 2>/dev/null && git status || echo "Not a git repository or directory doesn't exist"
echo

echo "=== End Diagnostics ==="
```

Save this as `dtma_diagnostics.sh`, make it executable with `chmod +x dtma_diagnostics.sh`, and run it with `./dtma_diagnostics.sh`.

## Next Steps After Diagnosis

1. **If DTMA is not installed:** Follow the installation steps
2. **If DTMA is installed but not running:** Check logs and start the service
3. **If DTMA is running but not accessible:** Check firewall and port configuration
4. **If configuration is wrong:** Update environment variables and restart

## Emergency DTMA Restart Commands

```bash
# Quick restart sequence
sudo systemctl stop dtma
sudo systemctl start dtma
sudo systemctl status dtma

# Or if using PM2
pm2 restart dtma
pm2 status

# Or manual restart
cd /opt/dtma
pkill -f "node.*dtma"
npm start &
```

## Contact Information

If you continue to have issues after following this guide, gather the output from the diagnostic script and provide:
1. Droplet IP address
2. Diagnostic script output
3. Any error messages from the logs
4. Screenshots of the health monitor showing the failures 