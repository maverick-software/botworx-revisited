# Stripe OAuth Setup Guide

## Overview
This guide helps you set up Stripe OAuth connection for secure integration with your Stripe account.

## Prerequisites
1. A Stripe account (Test or Live)
2. Admin access to your Agentopia platform
3. Access to your project's environment variables

## Step 1: Configure Stripe Connect Application

### 1.1 Create Connect Application
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Settings** → **Connect**
3. Click **"Get started with Connect"** or **"Create Connect application"**
4. Fill out the application details:
   - **Application name**: Your application name (e.g., "Agentopia")
   - **Website URL**: Your website URL
   - **Business type**: Select appropriate type

### 1.2 Configure OAuth Settings
1. In your Connect application settings, add redirect URIs:
   - **Development**: `http://localhost:5173/admin/billing/stripe-callback`
   - **Production**: `https://yourdomain.com/admin/billing/stripe-callback`
2. Note down your **Client ID** (starts with `ca_`)

## Step 2: Environment Variables Setup

### 2.1 Frontend Environment Variables
Create or update your `.env` file in the project root:

```env
# Stripe OAuth Configuration
VITE_STRIPE_CLIENT_ID=ca_your_actual_client_id_here

# Alternative naming (for compatibility)
REACT_APP_STRIPE_CLIENT_ID=ca_your_actual_client_id_here
```

### 2.2 Backend Environment Variables (Supabase)
Add these secrets to your Supabase project:

1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Add the following secrets:

```
STRIPE_CLIENT_ID=ca_your_actual_client_id_here
STRIPE_CLIENT_SECRET=sk_your_actual_client_secret_here
```

## Step 3: Test the Connection

### 3.1 Restart Development Server
After adding environment variables, restart your development server:

```bash
npm run dev
# or
yarn dev
```

### 3.2 Test OAuth Flow
1. Go to `/admin/billing/stripe-config`
2. Select **"OAuth Connection (Recommended)"**
3. Check the configuration status - should show "✅ Configured"
4. Click **"Connect with Stripe"**
5. You should be redirected to Stripe's authorization page

## Step 4: Troubleshooting

### Common Issues

#### 4.1 "Client ID not configured" Error
**Problem**: Environment variable not loaded
**Solution**: 
- Verify `.env` file has `VITE_STRIPE_CLIENT_ID=ca_...`
- Restart development server
- Check browser console for environment debug info

#### 4.2 "Invalid redirect URI" Error
**Problem**: Redirect URI mismatch
**Solution**:
- Ensure redirect URI in Stripe matches exactly: `http://localhost:5173/admin/billing/stripe-callback`
- Check for trailing slashes or protocol mismatches

#### 4.3 Button Not Responding
**Problem**: JavaScript error or missing client ID
**Solution**:
- Open browser console (F12)
- Click the button and check for errors
- Look for environment debug information

### Debug Information
The OAuth connection will log debug information to the browser console, including:
- Environment variables status
- Client ID presence
- OAuth URL construction

## Step 5: Production Deployment

### 5.1 Update Redirect URIs
In your Stripe Connect application, add production redirect URI:
```
https://yourdomain.com/admin/billing/stripe-callback
```

### 5.2 Update Environment Variables
Ensure production environment has:
- `VITE_STRIPE_CLIENT_ID` (frontend)
- `STRIPE_CLIENT_ID` and `STRIPE_CLIENT_SECRET` (Supabase secrets)

## Security Notes
- Never commit actual client IDs/secrets to version control
- Use different Stripe applications for development and production
- Regularly rotate your client secrets
- Monitor OAuth connections in Stripe Dashboard

## Manual Fallback
If OAuth setup is not working, you can use the **"Manual API Keys"** method:
1. Select "Manual API Keys" radio button
2. Enter your Stripe publishable and secret keys directly
3. This method works without OAuth configuration but is less secure

## Support
If you continue to have issues:
1. Check the browser console for detailed error messages
2. Verify all environment variables are correctly set
3. Ensure Stripe Connect application is properly configured
4. Test with a fresh browser session (clear cookies/cache)
