# Getting Started with Agentopia

This guide will help you set up and run Agentopia locally for development or production deployment.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- Supabase Account & Project
- (Optional) DigitalOcean Account & Droplet (for backend services)
- (Optional) Discord Application & Bot Token (for Discord features)
- (Optional) OpenAI API Key
- (Optional) Pinecone API Key & Environment

## Installation

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd Agentopia
npm install
```

### 2. Install Service Dependencies (Optional)

If running backend services:

```bash
cd services/discord-worker && npm install && cd ../..
cd services/worker-manager && npm install && cd ../..
```

## Environment Configuration

### Frontend Environment Variables

Create a `.env` file in the root directory:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Supabase Edge Functions Environment Variables

Configure in Supabase Dashboard (Settings → Edge Functions):

```bash
# Required
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_api_key

# Discord Integration (Optional)
DISCORD_PUBLIC_KEY=your_discord_public_key
DISCORD_APP_ID=your_discord_app_id

# Vector Database (Optional)
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=your_index_name
PINECONE_ENVIRONMENT=your_environment

# Backend Services (Optional)
MANAGER_URL=your_worker_manager_url
MANAGER_SECRET_KEY=shared_secret_key
```

### Backend Services Environment Variables (Optional)

Create `.env` files in `services/worker-manager` and `services/discord-worker` with necessary secrets.

## Running the Application

### 1. Start Frontend Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or next available port).

### 2. Deploy Supabase Functions (Optional)

```bash
# Ensure Supabase CLI is installed and linked to your project
supabase functions deploy --project-ref <your-project-ref>
```

### 3. Run Backend Services (Optional)

Refer to the [Deployment Guide](deployment.md) for running services on a server with PM2.

## First Steps

### 1. Create Your First Agent

1. Navigate to the Agents page
2. Click "Create New Agent"
3. Configure agent name, instructions, and settings
4. Save and start chatting with your agent

### 2. Set Up Integrations (Optional)

1. Go to Integrations page
2. Configure email providers (Gmail, SMTP, etc.)
3. Add web search capabilities
4. Set up external tools and services

### 3. Create Workspaces and Teams

1. Create a workspace for collaboration
2. Add team members (users and agents)
3. Set up channels for organized conversations
4. Configure workspace settings

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**
   - Ensure `.env` file is in the correct location
   - Restart development server after changes
   - Check variable names match exactly

2. **Supabase Connection Issues**
   - Verify project URL and keys are correct
   - Check Supabase project is active
   - Ensure RLS policies are properly configured

3. **Build Errors**
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Check Node.js version compatibility
   - Review error logs for specific missing dependencies

### Getting Help

- Check the [Known Issues](known-issues.md) documentation
- Review specific integration guides in the README folder
- Consult the [Troubleshooting](troubleshooting.md) guide for detailed solutions

## Next Steps

Once you have Agentopia running:

- Explore the [Design System](design-system.md) for UI customization
- Review [Security Updates](security-updates.md) for production deployment
- Check out [Integrations](integrations.md) for connecting external services
- Read about [Advanced Features](advanced-features.md) for power user capabilities

---

**Need help?** Check the other documentation files in the README folder or refer to the troubleshooting guides.
