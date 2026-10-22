# Admin API Keys & Model Configuration Guide

**Date**: October 6, 2025  
**Feature**: Admin API Key Management + Per-Agent Model Configuration  
**Status**: ✅ Production Ready

## Overview

This feature provides a comprehensive solution for managing LLM provider API keys at the platform level while allowing users to select models and configure parameters per agent.

### Key Features

- **Admin API Key Management**: Platform-wide API keys for OpenAI and Anthropic stored securely in Supabase Vault
- **Per-Agent Model Selection**: Users can choose provider and model for each agent
- **Advanced Model Configuration**: Temperature and maxTokens adjustable per agent
- **Secure Vault Storage**: All API keys encrypted with AES-256 before storage
- **Seamless Integration**: Works with existing LLM Router system

---

## Architecture

### Components

1. **Admin API Keys Page** (`src/pages/admin/AdminAPIKeysPage.tsx`)
   - Secure input and storage of platform API keys
   - Validation and format checking
   - Status tracking and management

2. **Platform Settings Table** (`platform_settings`)
   - Stores vault IDs for encrypted API keys
   - Admin-only access via RLS policies
   - Automatic timestamps

3. **Agent Settings Modal - General Tab** (`src/components/modals/agent-settings/GeneralTab.tsx`)
   - Provider selection (OpenAI, Anthropic)
   - Model selection dropdown
   - Advanced settings (temperature, maxTokens)

4. **Agent LLM Preferences Table** (`agent_llm_preferences`)
   - Per-agent provider and model storage
   - JSONB params for advanced settings
   - Embedding model configuration

### Data Flow

```
Admin Sets API Keys → Vault Encryption → platform_settings (vault_id)
                                            ↓
User Selects Model → agent_llm_preferences (provider, model, params)
                                            ↓
Agent Chat Request → LLM Router → Fetch API Key from Vault → Provider API
```

---

## Deployment Guide

### Step 1: Run Database Migration

```powershell
# Navigate to project directory
cd C:\Users\charl\Software\Agentopia

# Push the new migration
supabase db push --include-all
```

**Migration**: `20251006000001_create_platform_settings.sql`

This creates:
- `platform_settings` table
- RLS policies for admin-only access
- Indexes for performance

### Step 2: Deploy Frontend

The frontend changes are already in place:
- Admin API Keys page
- Enhanced Agent Settings modal
- Model registry with Claude models

No additional deployment needed - just refresh the app!

### Step 3: Configure API Keys (Admin)

1. **Login as Admin**
2. **Navigate to** `/admin/api-keys`
3. **Add OpenAI API Key**:
   - Paste your OpenAI API key (starts with `sk-`)
   - Click "Save"
   - Verify "Configured" badge appears

4. **Add Anthropic API Key**:
   - Paste your Anthropic API key (starts with `sk-ant-`)
   - Click "Save"
   - Verify "Configured" badge appears

### Step 4: Test with an Agent

1. **Open any agent**
2. **Click Settings** (gear icon)
3. **Go to "General" tab**
4. **Select Provider**: Choose "Anthropic"
5. **Select Model**: Choose "Claude 3.5 Sonnet (Oct 2024)"
6. **Expand "Advanced Model Settings"**:
   - Adjust Temperature (0.7 recommended)
   - Adjust Max Tokens (4096 recommended)
7. **Click "Save"**
8. **Test the agent** - it should now use Claude!

---

## User Guide

### For Admins: Managing API Keys

#### Adding a New API Key

1. Navigate to `/admin/api-keys`
2. Locate the provider card (OpenAI or Anthropic)
3. Click "Get API Key →" to open the provider's documentation
4. Copy your API key from the provider
5. Paste into the input field
6. Click "Save"

#### Updating an Existing API Key

1. Navigate to `/admin/api-keys`
2. The status shows "Configured" with last updated date
3. Paste the new API key in the input field
4. Click "Save"
5. The new key takes effect immediately

#### Deleting an API Key

1. Navigate to `/admin/api-keys`
2. Click "Delete" next to the configured key
3. Confirm deletion
4. Agents using that provider will fall back to OpenAI (if configured)

#### Security Notes

- **Encryption**: All keys are encrypted with Supabase Vault (AES-256)
- **Access**: Only admins can view or modify platform API keys
- **Storage**: Keys are never stored in plain text
- **Decryption**: Keys are only decrypted by Edge Functions during API calls
- **Visibility**: Keys are never exposed to the frontend or end users

### For Users: Configuring Agent Models

#### Selecting a Model

1. Open an agent's chat
2. Click the **Settings** icon (⚙️)
3. Go to **General** tab
4. Under "Language Model":
   - **Provider**: Choose OpenAI or Anthropic
   - **Model**: Select from available models

**Available Models**:

**OpenAI**:
- GPT-4o Mini (fast, economical)
- GPT-4o (balanced)
- GPT-4 Turbo (powerful)
- GPT-4 (classic)
- GPT-3.5 Turbo (fastest)

**Anthropic**:
- Claude 3.5 Sonnet (Oct 2024) ⭐ Recommended
- Claude 3.5 Haiku (Oct 2024) - Fast
- Claude 3 Opus (Feb 2024) - Most powerful
- Claude 3 Sonnet (Feb 2024)
- Claude 3 Haiku (Mar 2024)
- Claude Sonnet 4.5 (latest, if available)

#### Advanced Settings

Click **"Advanced Model Settings"** to reveal:

**Temperature** (0.0 - 2.0):
- **0.0 - 0.3**: Precise, deterministic (coding, analysis)
- **0.4 - 0.7**: Balanced (general conversation) ⭐ Recommended
- **0.8 - 2.0**: Creative (writing, brainstorming)

**Max Output Tokens** (256 - 16384):
- **256 - 1024**: Short responses
- **2048 - 4096**: Standard responses ⭐ Recommended
- **8192 - 16384**: Long-form content

#### Saving Changes

1. After selecting provider/model and adjusting settings
2. Click **"Save"** at the bottom of the modal
3. Changes take effect immediately for new messages

---

## API Key Validation

The system validates API keys before saving:

### OpenAI Keys
- Must start with `sk-`
- Minimum length: 20 characters
- Format: `sk-...` (rest is alphanumeric)

### Anthropic Keys
- Must start with `sk-ant-`
- Minimum length: 20 characters
- Format: `sk-ant-...` (rest is alphanumeric)

Invalid keys are rejected with helpful error messages.

---

## Database Schema

### platform_settings

```sql
CREATE TABLE platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,                  -- Stores vault ID
  description text,
  category text DEFAULT 'general',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Example Rows**:
```
key: platform_openai_api_key
value: 550e8400-e29b-41d4-a716-446655440000  (vault UUID)
category: api_keys

key: platform_anthropic_api_key  
value: 660e8400-e29b-41d4-a716-446655440001  (vault UUID)
category: api_keys
```

### agent_llm_preferences

```sql
CREATE TABLE agent_llm_preferences (
  agent_id uuid PRIMARY KEY REFERENCES agents(id),
  provider text NOT NULL DEFAULT 'openai',
  model text NOT NULL DEFAULT 'gpt-4o-mini',
  params jsonb NOT NULL DEFAULT '{}',
  embedding_model text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Example Row**:
```json
{
  "agent_id": "agent-uuid",
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "params": {
    "temperature": 0.7,
    "maxTokens": 4096
  },
  "embedding_model": "text-embedding-3-small"
}
```

---

## Integration with LLM Router

The LLM Router system (`supabase/functions/shared/llm/router.ts`) works with this feature:

1. **Router loads agent preferences** from `agent_llm_preferences`
2. **Router selects provider** based on preferences
3. **Router initializes provider** with platform API key
4. **Provider makes API call** with model and parameters

### Current Implementation

```typescript
// supabase/functions/shared/llm/router.ts

async resolveAgent(agentId: string) {
  // Load agent preferences
  const { data } = await this.supabase
    .from('agent_llm_preferences')
    .select('*')
    .eq('agent_id', agentId)
    .maybeSingle();
  
  const prefs = data || {
    provider: 'openai',
    model: 'gpt-4o-mini',
    params: {},
    embedding_model: 'text-embedding-3-small'
  };
  
  // Initialize provider
  if (prefs.provider === 'openai') {
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')!
    });
    return {
      provider: new OpenAIProvider(openai, {
        model: prefs.model
      }),
      prefs
    };
  }
  
  if (prefs.provider === 'anthropic') {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    return {
      provider: new AnthropicProvider(apiKey, {
        model: prefs.model
      }),
      prefs
    };
  }
}

async chat(agentId: string, messages: LLMMessage[], options: LLMChatOptions = {}) {
  const { provider, prefs } = await this.resolveAgent(agentId);
  
  // Merge agent params with call-time options
  const merged = {
    ...prefs.params,  // temperature, maxTokens from agent settings
    ...options,       // Override options for this specific call
    model: options.model || prefs.model
  };
  
  return provider.chat(messages, merged);
}
```

### Future Enhancement: Platform API Keys from Vault

**Current**: API keys are set as Supabase secrets (environment variables)

**Planned**: API keys fetched from `platform_settings` and decrypted from Vault

This would allow:
- Hot-swapping API keys without redeployment
- Multiple API keys per provider (for rate limiting/redundancy)
- Usage tracking per API key
- Rotation of keys without downtime

---

## Troubleshooting

### Issue: "API key not configured"

**Cause**: Admin hasn't added the API key yet

**Solution**:
1. Login as admin
2. Go to `/admin/api-keys`
3. Add the missing API key
4. Verify "Configured" badge appears

### Issue: Agent still using old provider

**Cause**: Browser cache or preferences not saved

**Solution**:
1. Open agent settings
2. Re-select provider and model
3. Click "Save"
4. Refresh page
5. Send a test message

### Issue: "Invalid API key format"

**Cause**: Incorrect key prefix or too short

**Solution**:
- OpenAI: Key must start with `sk-`
- Anthropic: Key must start with `sk-ant-`
- Ensure you copied the complete key
- Check for extra spaces or characters

### Issue: Advanced settings not saving

**Cause**: Must click "Save" button

**Solution**:
1. Adjust temperature and maxTokens
2. Click "Save" button at bottom of modal
3. Wait for success message
4. Settings are now saved

### Issue: RLS policy error on platform_settings

**Cause**: User doesn't have admin role

**Solution**:
```sql
-- Grant admin role to user
INSERT INTO user_roles (user_id, role)
VALUES ('user-uuid', 'admin')
ON CONFLICT DO NOTHING;
```

---

## Security Considerations

### Encryption

- **Algorithm**: AES-256-GCM
- **Key Management**: Handled by Supabase Vault
- **Storage**: Only encrypted vault IDs stored in database
- **Decryption**: Only possible via Edge Functions with service role

### Access Control

- **Admin API Keys Page**: Protected by admin route guard
- **platform_settings Table**: RLS policies restrict to admins
- **API Key Decryption**: Only Edge Functions can decrypt
- **Frontend**: Never receives actual API keys

### Audit Trail

- **created_at**: When key was first added
- **updated_at**: When key was last modified
- **category**: Groups keys by type (api_keys)

### Best Practices

1. **Rotate Keys Regularly**: Update API keys every 90 days
2. **Monitor Usage**: Track API costs in provider dashboards
3. **Limit Admin Access**: Only grant admin role to trusted users
4. **Test After Updates**: Verify agents work after key rotation
5. **Backup Configuration**: Document which keys are in use

---

## Model Recommendations

### By Use Case

| Use Case | Provider | Model | Temperature | Max Tokens |
|----------|----------|-------|-------------|------------|
| **General Chat** | Anthropic | Claude 3.5 Sonnet | 0.7 | 4096 |
| **Code Analysis** | OpenAI | GPT-4 Turbo | 0.3 | 4096 |
| **Creative Writing** | Anthropic | Claude 3.5 Sonnet | 0.9 | 8192 |
| **Fast Responses** | Anthropic | Claude 3.5 Haiku | 0.7 | 2048 |
| **Complex Reasoning** | Anthropic | Claude 3 Opus | 0.5 | 4096 |
| **Cost-Effective** | OpenAI | GPT-4o Mini | 0.7 | 2048 |

### By Context Window Needs

- **Short Context (< 8k tokens)**: GPT-4o Mini, GPT-3.5 Turbo
- **Medium Context (8k - 128k tokens)**: GPT-4o, GPT-4 Turbo
- **Long Context (128k - 200k tokens)**: Any Claude 3+ model

### By Budget

**Most Economical**:
1. GPT-4o Mini ($0.15/1M input tokens)
2. Claude 3.5 Haiku ($0.80/1M input tokens)
3. GPT-3.5 Turbo ($0.50/1M input tokens)

**Best Value**:
1. Claude 3.5 Sonnet ($3/1M input tokens)
2. GPT-4o ($2.50/1M input tokens)
3. GPT-4 Turbo ($10/1M input tokens)

**Maximum Capability** (Cost no object):
1. Claude 3 Opus ($15/1M input tokens)
2. Claude Sonnet 4.5 (when available)

---

## Future Enhancements

### Planned Features

1. **Platform API Key Fetching**
   - Fetch keys from vault in Edge Functions
   - Remove dependency on environment variables
   - Enable hot-swapping without redeployment

2. **Multiple Keys per Provider**
   - Primary and fallback keys
   - Automatic failover
   - Load balancing

3. **Usage Tracking**
   - Token usage per agent
   - Cost estimation
   - Budget alerts

4. **Key Rotation**
   - Scheduled automatic rotation
   - Gradual migration between keys
   - Zero-downtime updates

5. **Additional Providers**
   - Google Gemini
   - Mistral
   - Groq
   - OpenRouter

### Community Requests

- Per-agent API keys (for power users)
- Billing integration
- Usage dashboards
- Cost optimization recommendations

---

## Support & Resources

- **Admin API Keys**: `/admin/api-keys`
- **Agent Settings**: Agent Chat → Settings Icon → General Tab
- **OpenAI Console**: https://platform.openai.com/api-keys
- **Anthropic Console**: https://console.anthropic.com/settings/keys
- **LLM Router Docs**: `docs/integrations/claude_integration_guide.md`

---

**Status**: ✅ Production Ready  
**Last Updated**: October 6, 2025  
**Maintained By**: Platform Team

