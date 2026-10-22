# Environment Setup and Droplet Deployment Guide

This guide will help you set up your environment and deploy a test droplet for the Agent Tool Infrastructure.

## Step 1: Environment Variables Setup

1. Create a `.env` file in the project root from the sample:
   ```bash
   cp env-sample.txt .env
   ```

2. Edit the `.env` file with your actual values:
   ```
   # DigitalOcean API Configuration
   DO_API_TOKEN=your_actual_do_api_token
   
   # Droplet Configuration
   DO_DEFAULT_REGION=nyc3
   DO_DEFAULT_SIZE=s-1vcpu-1gb
   DO_DEFAULT_IMAGE=ubuntu-22-04-x64
   
   # API Configuration
   BACKEND_URL=http://localhost:3000
   INTERNAL_API_SECRET=$(openssl rand -hex 16)  # Generate a random secret
   AGENTOPIA_API_URL=http://your-public-ip:3000/functions/v1
   
   # Supabase Configuration
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   
   # Test Configuration
   TEST_AGENT_ID=test-agent-1
   ```

3. For the `AGENTOPIA_API_URL`, use a publicly accessible URL or IP address that the droplet can reach.

## Step 2: Set Up the DTMA Repository

1. Follow the steps in `scripts/setup-dtma-repo.md` to create a GitHub repository for the DTMA code.

2. Update your `.env` file with the repository URL:
   ```
   DTMA_GIT_REPO_URL=https://github.com/your-username/agentopia-dtma.git
   DTMA_GIT_BRANCH=main
   ```

## Step 3: Set Up a Test Agent

1. Create a test agent in the Supabase database:
   ```sql
   INSERT INTO public.agents (id, name, description, active) 
   VALUES ('test-agent-1', 'Test Agent', 'Agent for testing tool infrastructure', true);
   ```

2. Make sure the agent ID matches the `TEST_AGENT_ID` in your `.env` file.

## Step 4: Install Dependencies

1. Install the required NPM packages:
   ```bash
   npm install dotenv axios
   ```

## Step 5: Start the Backend Server

1. Start your Node.js backend server:
   ```bash
   npm run start
   ```

2. Verify the server is running by checking the logs or making a simple API request.

## Step 6: Deploy Test Droplet

1. Run the deployment script:
   ```bash
   node scripts/deploy-test-droplet.js
   ```

2. The script will output:
   - Deployment status
   - Droplet ID
   - IP address (once available)

3. This process may take a few minutes as the droplet is created and initialized.

## Step 7: Verify DTMA Status

1. Once the droplet is active and has an IP address, check the DTMA status:
   ```bash
   node scripts/check-dtma-status.js YOUR_DROPLET_IP
   ```
   
   You'll need to add the DTMA auth token to your .env file first:
   ```
   DTMA_AUTH_TOKEN=token_from_agent_droplets_table
   ```

2. To get the auth token, query the database:
   ```sql
   SELECT dtma_auth_token FROM public.agent_droplets 
   WHERE agent_id = 'test-agent-1' ORDER BY created_at DESC LIMIT 1;
   ```

## Step 8: SSH Into the Droplet (Optional)

If you provided SSH keys to DigitalOcean, you can SSH into the droplet:

```bash
ssh ubuntu@YOUR_DROPLET_IP
```

Check the DTMA service:
```bash
sudo systemctl status dtma
sudo journalctl -u dtma
tail -f /var/log/dtma-bootstrap.log
```

## Step 9: Clean Up After Testing

When you're done testing:

```bash
node scripts/deprovision-test-droplet.js
```

This will delete the droplet and update its status in the database.

## Troubleshooting

1. **Deployment Fails**
   - Check that all environment variables are set correctly
   - Verify your DigitalOcean API token has write access
   - Check the Node.js server logs for errors

2. **DTMA Not Starting**
   - SSH into the droplet and check `/var/log/dtma-bootstrap.log`
   - Verify the DTMA repository is accessible
   - Check that the bootstrap script pulled the code correctly

3. **API Connection Issues**
   - Make sure `AGENTOPIA_API_URL` is publicly accessible
   - Check that the droplet has internet access
   - Verify port 30000 is open on the droplet 