# Agent Tool Infrastructure Deployment Plan

This document outlines the steps to deploy a test agent droplet with the correct configuration pointing to the Supabase Edge Functions.

## Prerequisites

1. DigitalOcean API token
2. Supabase project with Edge Functions
3. DTMA agent repository at https://github.com/maverick-software/dtma-agent.git
4. Test agent ID in the Supabase database

## Step 1: Set up Environment Variables

Create or update your `.env` file:

```bash
# DigitalOcean API Configuration
DO_API_TOKEN=your_do_api_token

# Droplet Configuration
DO_DEFAULT_REGION=nyc3
DO_DEFAULT_SIZE=s-1vcpu-1gb
DO_DEFAULT_IMAGE=ubuntu-22-04-x64
DO_DEFAULT_SSH_KEY_IDS=your_ssh_key_ids_comma_separated
DO_BACKUP_ENABLED=false
DO_MONITORING=true

# DTMA Configuration
DTMA_GIT_REPO_URL=https://github.com/maverick-software/dtma-agent.git
DTMA_GIT_BRANCH=main

# IMPORTANT: Use the direct Supabase Edge Functions URL
AGENTOPIA_API_URL=https://txhscptzjrrudnqwavcb.supabase.co/functions/v1

# Generate this securely
INTERNAL_API_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Test Configuration
TEST_AGENT_ID=test-agent-1
```

## Step 2: Update the DTMA Agent Client

Ensure the DTMA agent client in the GitHub repository is configured to handle direct API calls to Supabase Edge Functions.

1. Verify the changes to `dtma-agent/src/agentopia_api_client.ts` include:
   - Proper handling of API base URL from config
   - Error handling for connection issues
   - Correct authentication header setup

## Step 3: Test Deployment Options

### Option A: Test with Offline Mode

For initial testing without requiring the Supabase functions to be fully ready:

```bash
node scripts/offline-deployment-test.js
```

This will:
- Create a real droplet
- Set up DTMA in offline mode
- Log API calls instead of making them
- Let you verify the deployment process works

### Option B: Full Deployment with Supabase Connection

For a full test with actual Supabase Edge Functions:

```bash
node scripts/deploy-test-droplet.js
```

## Step 4: Verify Deployment

1. Wait 3-5 minutes for the bootstrap script to complete

2. Check the DTMA status:
```bash
node scripts/check-netlify-dtma-status.js test-agent-1
```

The script will:
- Verify droplet information
- Connect to the DTMA API
- Check API configuration (should show the Supabase URL)
- Test a heartbeat

3. SSH into the droplet to verify (if SSH keys configured):
```bash
ssh ubuntu@<DROPLET_IP>
```

4. Check DTMA logs:
```bash
sudo systemctl status dtma
sudo journalctl -u dtma
cat /var/log/dtma-bootstrap.log
```

## Step 5: Troubleshooting

If issues occur:

1. Verify the DTMA config file on the droplet:
```bash
sudo cat /etc/dtma.conf
```

2. Check for network connectivity to Supabase:
```bash
curl -I https://txhscptzjrrudnqwavcb.supabase.co/functions/v1
```

3. Restart the DTMA service if needed:
```bash
sudo systemctl restart dtma
```

## Step 6: Clean Up

When testing is complete:

```bash
node scripts/deprovision-test-droplet.js <DROPLET_ID>
# or
node scripts/deprovision-offline-droplet.js
```

## Next Steps

Once a successful deployment is confirmed:

1. Update the infrastructure code to always use Supabase Edge Functions directly
2. Document the approach for the team
3. Develop and test tool installation via the DTMA API 