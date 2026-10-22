# LLM API Key Management

**Date**: October 6, 2025  
**Status**: ✅ Integrated with Existing System

## Overview

LLM API keys (OpenAI, Anthropic) are now managed through the **existing integration credentials system**, not a separate admin page. This provides consistency with other API key integrations and leverages the proven, secure Supabase Vault storage.

---

## Architecture

### Service Providers

OpenAI and Anthropic are added as `service_providers` with:
- **Provider Type**: `api`
- **Auth Type**: `api_key`
- **Category**: `ai_ml`

### Credential Storage

API keys are stored in `user_integration_credentials` table:
- **`credential_type`**: `'api_key'`
- **`vault_access_token_id`**: UUID reference to encrypted key in Supabase Vault
- **`connection_status`**: `'active'`, `'expired'`, `'revoked'`, or `'error'`

This is the **same system** used for:
- Serper API keys
- Brave Search API keys
- Gmail OAuth tokens
- Outlook OAuth tokens

---

## User Guide

### Adding an LLM API Key

1. **Navigate to Integrations**
   - Go to `/integrations` or click "Integrations" in the main menu

2. **Find the LLM Provider**
   - **OpenAI** - for GPT models
   - **Anthropic** - for Claude models

3. **Click "Connect" or "Add API Key"**

4. **Enter Your API Key**
   - **OpenAI**: Get from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - **Anthropic**: Get from [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

5. **Save**
   - Key is encrypted and stored in Supabase Vault
   - Status shows "Connected" when successful

### Using LLM Models

Once API keys are added:

1. **Open an Agent**
2. **Go to Settings → General**
3. **Select Provider**: OpenAI or Anthropic
4. **Select Model**: Choose from available models
5. **Configure Advanced Settings** (optional):
   - Temperature (0.0 - 2.0)
   - Max Tokens (256 - 16,384)
6. **Save**

The agent will now use your API key to call the selected model!

---

## Available Models

### OpenAI Models

- **GPT-4o Mini** ⚡ - Fast and economical
- **GPT-4o** - Balanced performance
- **GPT-4 Turbo** - Powerful and fast
- **GPT-4** - Classic GPT-4
- **GPT-3.5 Turbo** ⚡ - Fastest

### Anthropic Models (Claude)

#### Claude 4.5 Series (Latest - Sept 2025):
- **Claude Sonnet 4.5** 🧠 (`claude-sonnet-4-5-20250929`)

#### Claude 4.1 Series (Aug 2025):
- **Claude Opus 4.1** 🧠 (`claude-opus-4-1-20250805`)

#### Claude 4 Series (May 2025):
- **Claude Opus 4** 🧠 (`claude-opus-4-20250514`)
- **Claude Sonnet 4** 🧠 (`claude-sonnet-4-20250514`)

#### Claude 3.7 Series (Feb 2025):
- **Claude Sonnet 3.7** 🧠 (`claude-3-7-sonnet-20250219`)

#### Claude 3.5 Series (Oct 2024):
- **Claude Haiku 3.5** ⚡ (`claude-3-5-haiku-20241022`)

#### Claude 3 Series (Mar 2024):
- **Claude Haiku 3** ⚡ (`claude-3-haiku-20240307`)

---

## How It Works

### 1. LLM Router Resolution

When an agent sends a message:

```typescript
// supabase/functions/shared/llm/router.ts

async resolveAgent(agentId: string) {
  // 1. Load agent preferences
  const { data } = await supabase
    .from('agent_llm_preferences')
    .select('provider, model, params')
    .eq('agent_id', agentId)
    .maybeSingle();
  
  // 2. Get user's API key from integrations
  const apiKey = await this.getProviderAPIKey(userId, data.provider);
  
  // 3. Initialize provider with user's key
  if (data.provider === 'openai') {
    return new OpenAIProvider(apiKey, { model: data.model });
  }
  
  if (data.provider === 'anthropic') {
    return new AnthropicProvider(apiKey, { model: data.model });
  }
}
```

### 2. API Key Retrieval

```typescript
async getProviderAPIKey(userId: string, provider: string): Promise<string> {
  // Get user's integration credential
  const { data: credential } = await supabase
    .from('user_integration_credentials')
    .select('vault_access_token_id')
    .eq('user_id', userId)
    .eq('service_provider_id', (
      SELECT id FROM service_providers WHERE name = provider
    ))
    .eq('connection_status', 'active')
    .single();
  
  // Decrypt API key from vault (server-side only)
  const apiKey = await vaultService.getSecret(credential.vault_access_token_id);
  
  return apiKey;
}
```

### 3. Provider API Call

```typescript
// supabase/functions/shared/llm/openai_provider.ts or anthropic_provider.ts

async chat(messages: LLMMessage[], options: LLMChatOptions) {
  // Use the decrypted API key to call the provider
  const response = await this.client.chat.completions.create({
    model: options.model,
    messages: messages,
    temperature: options.temperature,
    max_tokens: options.maxTokens,
    tools: options.tools
  });
  
  return response;
}
```

---

## Database Schema

### service_providers Table

```sql
-- OpenAI provider
{
  id: uuid,
  name: 'openai',
  display_name: 'OpenAI',
  provider_type: 'api',
  auth_type: 'api_key',
  is_enabled: true,
  category: 'ai_ml',
  description: 'OpenAI LLM API for GPT models',
  configuration_metadata: {
    api_base_url: 'https://api.openai.com/v1',
    docs_url: 'https://platform.openai.com/docs',
    api_key_url: 'https://platform.openai.com/api-keys',
    requires_api_key: true,
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', ...],
    capabilities: ['chat', 'completion', 'embeddings', 'tools']
  }
}

-- Anthropic provider
{
  id: uuid,
  name: 'anthropic',
  display_name: 'Anthropic',
  provider_type: 'api',
  auth_type: 'api_key',
  is_enabled: true,
  category: 'ai_ml',
  description: 'Anthropic Claude API for Claude models',
  configuration_metadata: {
    api_base_url: 'https://api.anthropic.com/v1',
    docs_url: 'https://docs.anthropic.com',
    api_key_url: 'https://console.anthropic.com/settings/keys',
    requires_api_key: true,
    models: ['claude-sonnet-4-5-20250929', ...],
    capabilities: ['chat', 'completion', 'tools', 'streaming']
  }
}
```

### user_integration_credentials Table

```sql
-- User's OpenAI API key
{
  id: uuid,
  user_id: 'user-uuid',
  service_provider_id: 'openai-provider-uuid',
  credential_type: 'api_key',
  vault_access_token_id: 'vault-uuid-encrypted-key',
  connection_name: 'My OpenAI API Key',
  connection_status: 'active',
  connection_metadata: {
    added_at: '2025-10-06T14:00:00Z',
    api_key_prefix: 'sk-...',
    usage_tracking: true
  },
  created_at: timestamptz,
  updated_at: timestamptz
}
```

### agent_llm_preferences Table

```sql
-- Agent's model selection
{
  agent_id: 'agent-uuid',
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  params: {
    temperature: 0.7,
    maxTokens: 4096
  },
  embedding_model: 'text-embedding-3-small'
}
```

---

## Deployment

### Step 1: Run Migration

```powershell
cd C:\Users\charl\Software\Agentopia
supabase db push --include-all
```

This adds:
- OpenAI service provider
- Anthropic service provider

### Step 2: Add API Keys

1. Go to `/integrations`
2. Find "OpenAI" and click "Connect"
3. Enter your OpenAI API key
4. Find "Anthropic" and click "Connect"
5. Enter your Anthropic API key

### Step 3: Configure Agents

1. Open an agent
2. Settings → General
3. Select provider and model
4. Save

Done! 🎉

---

## Security

### Encryption

- **Algorithm**: AES-256-GCM (Supabase Vault)
- **Storage**: Only vault UUIDs stored in database
- **Decryption**: Only possible in Edge Functions with service role

### Access Control

- **User-Scoped**: Each user has their own API keys
- **RLS Policies**: Users can only access their own credentials
- **No Sharing**: API keys are never shared between users

### Audit Trail

- **`created_at`**: When key was added
- **`updated_at`**: When key was last modified
- **`connection_status`**: Current status (active/expired/revoked/error)

---

## Troubleshooting

### Issue: "No API key found"

**Cause**: User hasn't added their API key yet

**Solution**:
1. Go to `/integrations`
2. Find the provider (OpenAI or Anthropic)
3. Click "Connect" and add your API key

### Issue: "Invalid API key format"

**Cause**: Incorrect key format

**Solution**:
- **OpenAI**: Key must start with `sk-`
- **Anthropic**: Key must start with `sk-ant-`
- Ensure you copied the complete key

### Issue: Agent still not working

**Cause**: Agent preferences not configured

**Solution**:
1. Open agent settings
2. Go to General tab
3. Select provider and model
4. Click Save
5. Try sending a message

---

## Benefits of Integration System

✅ **Consistency**: Same UX as other API key integrations  
✅ **User-Scoped**: Each user has their own keys  
✅ **Proven Security**: Uses existing vault system  
✅ **Scalability**: Easy to add more LLM providers  
✅ **No Duplication**: Reuses existing infrastructure  

---

**Status**: ✅ Production Ready  
**Last Updated**: October 6, 2025  
**System**: Existing Integration Credentials System

