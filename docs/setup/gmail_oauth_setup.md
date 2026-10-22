# Gmail OAuth Setup Guide

This guide explains how to set up Google OAuth credentials for Gmail integration in Agentopia.

## Understanding the OAuth Flow

The Gmail integration uses OAuth 2.0 to allow users to connect their Gmail accounts to Agentopia. Here's how it works:

1. **Application Credentials**: You (the developer) register Agentopia with Google and get OAuth credentials
2. **User Authorization**: Users click "Connect Gmail" and are redirected to Google to log in
3. **User Consent**: Users grant Agentopia permission to access their Gmail
4. **Token Storage**: User-specific tokens are stored encrypted in the database

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name your project (e.g., "Agentopia Gmail Integration")
4. Click "Create"

## Step 2: Enable Gmail API

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Gmail API"
3. Click on "Gmail API"
4. Click "Enable"

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen first:
   - Choose "External" user type (or "Internal" for Google Workspace)
   - Fill in the required fields:
     - App name: "Agentopia"
     - User support email: Your email
     - Developer contact: Your email
   - Add scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
   - Add test users if in testing mode
4. Back in "Create OAuth client ID":
   - Application type: "Web application"
   - Name: "Agentopia Web Client"
   - Authorized redirect URIs - Add these:
     - `http://localhost:5173/integrations/gmail/callback` (for development)
     - `https://your-domain.com/integrations/gmail/callback` (for production)
5. Click "Create"
6. Save the Client ID and Client Secret

## Step 4: Configure Supabase Edge Functions

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to "Edge Functions" → "Secrets"
3. Add the following secrets:
   - `GOOGLE_CLIENT_ID`: Your OAuth Client ID
   - `GOOGLE_CLIENT_SECRET`: Your OAuth Client Secret

### Option B: Using Supabase CLI

```bash
# Set the secrets
supabase secrets set GOOGLE_CLIENT_ID="your-client-id-here"
supabase secrets set GOOGLE_CLIENT_SECRET="your-client-secret-here"

# Verify they're set
supabase secrets list
```

## Step 5: Deploy Edge Functions

Deploy the Gmail OAuth edge functions:

```bash
# Deploy all functions
supabase functions deploy

# Or deploy specific functions
supabase functions deploy gmail-oauth-initiate
supabase functions deploy gmail-oauth
supabase functions deploy gmail-api
```

## Step 6: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/integrations`
3. Find the Gmail integration card
4. Click "Add Credentials"
5. You should be redirected to Google to log in
6. Grant the requested permissions
7. You'll be redirected back to Agentopia with your Gmail connected

## Troubleshooting

### "Google OAuth not configured" Error

This means the edge functions can't find the OAuth credentials. Check:
- Secrets are properly set in Supabase
- Edge functions are deployed after setting secrets
- Wait 2-3 minutes for secrets to propagate

### "redirect_uri_mismatch" Error

This means the redirect URI doesn't match what's configured in Google Cloud Console:
- Check the exact URI in the error message
- Add it to "Authorized redirect URIs" in Google Cloud Console
- Common issue: missing or extra trailing slash

### "Access blocked: Authorization Error"

If your app is in testing mode:
- Add the user's email to test users in OAuth consent screen
- Or publish the app (requires verification for sensitive scopes)

## Security Best Practices

1. **Never commit credentials**: Keep Client ID and Secret out of your code
2. **Use environment-specific credentials**: Different credentials for dev/staging/prod
3. **Rotate credentials periodically**: Update them every 90 days
4. **Monitor usage**: Check Google Cloud Console for unusual activity
5. **Implement rate limiting**: Prevent abuse of the OAuth flow

## Production Considerations

Before going to production:

1. **Verify your app** with Google if using sensitive scopes
2. **Set up proper redirect URIs** for your production domain
3. **Configure OAuth consent screen** with privacy policy and terms
4. **Enable domain verification** in Google Search Console
5. **Set up monitoring** for OAuth errors and usage

## Next Steps

Once Gmail OAuth is configured:
- Users can connect their Gmail accounts via the Integrations page
- Agents can be granted access to specific Gmail accounts
- The system handles token refresh automatically
- All credentials are stored encrypted in Supabase Vault

For more information, see:
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Supabase Edge Functions Secrets](https://supabase.com/docs/guides/functions/secrets) 