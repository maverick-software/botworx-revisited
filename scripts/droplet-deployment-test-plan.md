# Agent Tool Infrastructure Droplet Deployment Test Plan

## Prerequisites

1. **DigitalOcean Account & API Access**
   - Active DigitalOcean account
   - API token with write access
   - SSH keys registered in your DigitalOcean account

2. **Environment Setup**
   - Node.js installed (v16+)
   - Update `env-sample.txt` with your actual values and save as `.env`
   - Required npm packages installed (`npm install dotenv axios`)

## Step 1: Configure Environment Variables

1. Copy `env-sample.txt` to `.env` in the project root:
   ```
   cp env-sample.txt .env
   ```

2. Edit the `.env` file with your actual values:
   - `DO_API_TOKEN`: Your DigitalOcean API token
   - `DO_DEFAULT_SSH_KEY_IDS`: Comma-separated list of SSH key IDs from your DO account
   - `DTMA_GIT_REPO_URL`: The actual Git repo URL for the DTMA agent (if different from default)
   - `AGENTOPIA_API_URL`: Your backend API URL
   - `INTERNAL_API_SECRET`: A secure random string for internal API authentication
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase credentials (if using)
   - `TEST_AGENT_ID`: Add this for the test script to use a specific agent ID

## Step 2: Set Up a Test Agent

1. Create a test agent in the Supabase database:
   ```sql
   INSERT INTO public.agents (id, name, description, active) 
   VALUES ('test-agent-1', 'Test Agent', 'Agent for testing tool infrastructure', true);
   ```

2. Verify the agent was created:
   ```sql
   SELECT * FROM public.agents WHERE id = 'test-agent-1';
   ```

## Step 3: Run the Backend Server

1. Start your Node.js backend server:
   ```
   npm run start
   ```

2. Verify the server is running by checking the logs or making a simple API request.

## Step 4: Deploy Test Droplet

1. Install dependencies for the test script:
   ```
   npm install dotenv axios
   ```

2. Run the deployment script:
   ```
   node scripts/deploy-test-droplet.js
   ```

3. Monitor the console output for deployment progress.

## Step 5: Verify Deployment

1. Check the deployment result in the console output:
   - Successful deployment will show the droplet ID, status, and IP address
   - Record this information for the next steps

2. Verify in the DigitalOcean console:
   - Log in to your DigitalOcean account
   - Go to Droplets and confirm the new droplet exists
   - Check that it has the correct tags (`agent-id:test-agent-1`)

3. Verify in the database:
   ```sql
   SELECT * FROM public.agent_droplets WHERE agent_id = 'test-agent-1';
   ```
   - Confirm the record exists with correct `do_droplet_id`, `status`, and `ip_address`

## Step 6: Test DTMA Agent Connectivity

1. Wait for the droplet to fully initialize (about 2-3 minutes after creation)

2. SSH into the droplet using your private key:
   ```
   ssh -i /path/to/your/private/key ubuntu@<droplet-ip-address>
   ```

3. Check the DTMA service status:
   ```
   sudo systemctl status dtma
   ```
   - Should show "active (running)"

4. Check the DTMA logs:
   ```
   sudo journalctl -u dtma
   ```
   - Look for successful startup and heartbeat messages

5. Verify the DTMA API is responding:
   ```
   curl http://localhost:30000/health
   ```
   - Should return "OK"

## Step 7: Clean Up (After Testing)

1. Run the deprovisioning script (create this separately) or manually delete the droplet:
   ```
   curl -X DELETE -H "X-Internal-Api-Secret: your_secret_here" http://localhost:3000/internal/agents/test-agent-1/tool-environment
   ```

2. Verify deletion in DigitalOcean console:
   - Droplet should no longer appear (or show as "deleted")

3. Verify deletion in the database:
   ```sql
   SELECT * FROM public.agent_droplets WHERE agent_id = 'test-agent-1';
   ```
   - The status field should be updated to "deleted"

## Troubleshooting

1. **Deployment Fails to Start**
   - Check the server logs for errors
   - Verify all environment variables are set correctly
   - Ensure the DigitalOcean API token has write access

2. **Droplet Created But DTMA Not Running**
   - SSH into the droplet and check `/var/log/dtma-bootstrap.log`
   - Verify the DTMA service status with `systemctl status dtma`
   - Check if the Git repository is accessible and has the correct code

3. **API Connection Issues**
   - Check firewall settings
   - Verify the `AGENTOPIA_API_URL` is publicly accessible from the droplet
   - Ensure the `DTMA_AUTH_TOKEN` is correctly set in both places 