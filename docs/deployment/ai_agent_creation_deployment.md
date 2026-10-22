# Deploying AI Agent Creation Feature

## Prerequisites
- OpenAI API key
- Supabase CLI installed and linked to project

## Step 1: Set OpenAI API Key

In Supabase Dashboard:
1. Go to Project Settings → Edge Functions
2. Click "Secrets"
3. Add secret:
   ```
   Name: OPENAI_API_KEY
   Value: sk-your-openai-key-here
   ```

## Step 2: Deploy Edge Function

```bash
# Deploy the function
npx supabase functions deploy generate-agent-config

# Verify deployment
npx supabase functions list
```

## Step 3: Test the Feature

1. Navigate to Agents page
2. Click "Create Agent"
3. In the wizard, look for "AI Quick Setup" button
4. Click it and enter a description like:
   ```
   Create a friendly customer support agent that helps with technical issues
   ```
5. Click "Generate Agent Configuration"
6. Verify the configuration is generated and wizard is populated

## Step 4: Monitor

Check Edge Function logs:
```bash
npx supabase functions logs generate-agent-config --follow
```

## Troubleshooting

### Function not found
- Run `npx supabase functions deploy generate-agent-config`

### "OpenAI API key not configured" error
- Verify secret is set in Supabase Dashboard
- Redeploy function after adding secret

### Generation fails
- Check OpenAI API key is valid
- Check OpenAI API quota
- Review function logs for details

## Cost Estimate
- GPT-4o-mini: ~$0.001 per agent generation
- 1000 generations/month ≈ $1.00

