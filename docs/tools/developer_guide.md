# Developer Guide

## Overview

This guide provides comprehensive instructions for developers working with the MCP tool and credential management system, including setup, development workflow, testing, and contribution guidelines.

## Prerequisites

### Required Software

- **Node.js**: v18.0.0 or higher
- **npm/pnpm**: Latest version
- **Docker**: For local Supabase
- **Git**: Version control
- **VS Code**: Recommended IDE

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "denoland.vscode-deno",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

## Project Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/agentopia.git
cd agentopia
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install edge function dependencies (if separate)
cd supabase/functions
npm install
cd ../..
```

### 3. Environment Configuration

Create `.env.local` file:

```bash
# Supabase
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key

# Google OAuth (for Gmail)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback/google

# Web Search APIs (optional)
SERPER_API_KEY=your-serper-key
SERPAPI_KEY=your-serpapi-key
BRAVE_SEARCH_KEY=your-brave-key
```

### 4. Database Setup

```bash
# Start local Supabase
supabase start

# Run migrations
supabase db reset

# Seed database (optional)
psql -h localhost -p 54322 -U postgres -d postgres < scripts/seed.sql
```

### 5. Configure OAuth Providers

```sql
-- Insert OAuth providers
INSERT INTO oauth_providers (name, display_name, provider_type) VALUES
  ('gmail', 'Gmail', 'oauth'),
  ('serper_api', 'Serper API', 'api_key'),
  ('serpapi', 'SerpAPI', 'api_key'),
  ('brave_search', 'Brave Search', 'api_key');
```

## Development Workflow

### Running the Application

```bash
# Terminal 1: Start Supabase
supabase start

# Terminal 2: Start edge functions
supabase functions serve --env-file .env.local

# Terminal 3: Start frontend
npm run dev
```

### Project Structure

```
agentopia/
├── src/                    # Frontend source
│   ├── components/        # React components
│   │   ├── agent-edit/   # Agent management
│   │   ├── integrations/ # Integration components
│   │   └── modals/       # Modal components
│   ├── hooks/            # Custom React hooks
│   ├── pages/            # Page components
│   ├── services/         # API services
│   └── types/            # TypeScript types
├── supabase/
│   ├── functions/        # Edge functions
│   │   ├── oauth-refresh/
│   │   ├── gmail-api/
│   │   └── web-search-api/
│   └── migrations/       # Database migrations
├── docs/                 # Documentation
│   └── tools/           # Tool-specific docs
└── scripts/             # Utility scripts
```

### Code Style Guide

#### TypeScript

```typescript
// Use explicit types
interface UserConnection {
  id: string;
  userId: string;
  providerId: string;
  status: ConnectionStatus;
}

// Use enums for constants
enum ConnectionStatus {
  CONNECTED = 'connected',
  EXPIRED = 'expired',
  REVOKED = 'revoked'
}

// Prefer const assertions
const PROVIDERS = ['gmail', 'serper_api'] as const;
type Provider = typeof PROVIDERS[number];

// Use proper error handling
try {
  const result = await riskyOperation();
  return { data: result, error: null };
} catch (error) {
  console.error('Operation failed:', error);
  return { data: null, error: error.message };
}
```

#### React Components

```typescript
// Use functional components with TypeScript
interface CredentialCardProps {
  connection: UserConnection;
  onRefresh?: (id: string) => void;
  onRevoke?: (id: string) => void;
}

export function CredentialCard({
  connection,
  onRefresh,
  onRevoke
}: CredentialCardProps) {
  // Use hooks at the top
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  
  // Memoize expensive computations
  const isExpired = useMemo(
    () => connection.status === ConnectionStatus.EXPIRED,
    [connection.status]
  );
  
  // Use callbacks for event handlers
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      await onRefresh?.(connection.id);
    } finally {
      setLoading(false);
    }
  }, [connection.id, onRefresh]);
  
  return (
    <Card>
      {/* Component JSX */}
    </Card>
  );
}
```

#### Database Queries

```typescript
// Use type-safe queries
const getConnection = async (id: string): Promise<UserConnection> => {
  const { data, error } = await supabase
    .from('user_oauth_connections')
    .select(`
      *,
      provider:oauth_providers(*)
    `)
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data;
};

// Use transactions when needed
const createConnectionWithPermissions = async (
  connection: Partial<UserConnection>,
  permissions: any
) => {
  const { data, error } = await supabase.rpc(
    'create_connection_with_permissions',
    { connection, permissions }
  );
  
  if (error) throw error;
  return data;
};
```

## Testing

### Unit Tests

```typescript
// src/hooks/__tests__/useConnections.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useConnections } from '../useConnections';

describe('useConnections', () => {
  it('should fetch connections on mount', async () => {
    const { result } = renderHook(() => useConnections());
    
    expect(result.current.loading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.connections).toHaveLength(2);
  });
  
  it('should handle revoke optimistically', async () => {
    const { result } = renderHook(() => useConnections());
    
    await waitFor(() => !result.current.loading);
    
    const initialCount = result.current.connections.length;
    
    act(() => {
      result.current.revoke('connection-1');
    });
    
    expect(result.current.connections).toHaveLength(initialCount - 1);
  });
});
```

### Integration Tests

```typescript
// tests/integration/oauth-flow.test.ts
describe('OAuth Flow', () => {
  it('should complete Gmail OAuth flow', async () => {
    // 1. Initiate OAuth
    const authUrl = await initiateOAuth('gmail');
    expect(authUrl).toContain('accounts.google.com');
    
    // 2. Simulate callback
    const code = 'mock-auth-code';
    const tokens = await handleOAuthCallback(code);
    expect(tokens.access_token).toBeDefined();
    
    // 3. Verify connection created
    const connection = await getConnection(tokens.connection_id);
    expect(connection.status).toBe('connected');
    
    // 4. Test token refresh
    const refreshed = await refreshToken(connection.id);
    expect(refreshed.access_token).toBeDefined();
  });
});
```

### E2E Tests

```typescript
// tests/e2e/credentials.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Credentials Management', () => {
  test('should add and remove API key', async ({ page }) => {
    // Navigate to integrations
    await page.goto('/integrations');
    
    // Click on Serper API
    await page.click('text=Serper API');
    
    // Enter API key
    await page.fill('input[type="password"]', 'test-api-key');
    await page.click('button:has-text("Connect")');
    
    // Verify connection created
    await page.goto('/credentials');
    await expect(page.locator('text=Serper API')).toBeVisible();
    
    // Revoke connection
    await page.click('button:has-text("Revoke")');
    
    // Verify removed
    await expect(page.locator('text=Serper API')).not.toBeVisible();
  });
});
```

### Testing Edge Functions

```typescript
// supabase/functions/tests/oauth-refresh.test.ts
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

Deno.test('oauth-refresh handles expired tokens', async () => {
  // Mock Google OAuth response
  globalThis.fetch = async (url: string) => {
    if (url.includes('oauth2.googleapis.com')) {
      return new Response(
        JSON.stringify({ error: 'invalid_grant' }),
        { status: 400 }
      );
    }
    return new Response('{}');
  };
  
  // Call function
  const response = await handler(
    new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ connectionId: 'test-id' })
    })
  );
  
  // Verify response
  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(
    body.error,
    'Your connection has expired and needs to be renewed. Please disconnect and reconnect your account.'
  );
});
```

## Database Management

### Creating Migrations

```bash
# Create new migration
supabase migration new add_user_preferences

# Edit the migration file
vim supabase/migrations/20240101000000_add_user_preferences.sql
```

Example migration:

```sql
-- Create user preferences table
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'dark',
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add RLS policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
ON user_preferences
FOR ALL
USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON user_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

### Database Utilities

```sql
-- Useful queries for development

-- Check active connections
SELECT 
  c.*,
  p.display_name as provider_name,
  u.email as user_email
FROM user_oauth_connections c
JOIN oauth_providers p ON c.provider_id = p.id
JOIN auth.users u ON c.user_id = u.id
WHERE c.connection_status = 'connected';

-- Find expired tokens
SELECT * FROM user_oauth_connections
WHERE credential_type = 'oauth'
AND token_expires_at < NOW();

-- Agent permissions summary
SELECT 
  a.name as agent_name,
  p.display_name as provider,
  ap.permissions
FROM agent_integration_permissions ap
JOIN agents a ON ap.agent_id = a.id
JOIN user_oauth_connections c ON ap.connection_id = c.id
JOIN oauth_providers p ON c.provider_id = p.id;
```

## API Development

### Adding a New Provider

1. **Add to database**:

```sql
INSERT INTO oauth_providers (
  name, 
  display_name, 
  provider_type,
  auth_url,
  token_url,
  scope
) VALUES (
  'slack',
  'Slack',
  'oauth',
  'https://slack.com/oauth/v2/authorize',
  'https://slack.com/api/oauth.v2.access',
  'channels:read,chat:write'
);
```

2. **Create edge function**:

```typescript
// supabase/functions/slack-api/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req: Request) => {
  const { action, connectionId, params } = await req.json();
  
  const accessToken = await getAccessToken(connectionId);
  
  switch (action) {
    case 'listChannels':
      return await listChannels(accessToken);
    case 'postMessage':
      return await postMessage(accessToken, params);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
});
```

3. **Add frontend integration**:

```typescript
// src/hooks/useSlackIntegration.ts
export function useSlackIntegration() {
  const { connections } = useConnections();
  
  const slackConnection = connections.find(
    c => c.provider.name === 'slack'
  );
  
  const postMessage = async (channel: string, text: string) => {
    const { data } = await supabase.functions.invoke('slack-api', {
      body: {
        action: 'postMessage',
        connectionId: slackConnection?.id,
        params: { channel, text }
      }
    });
    
    return data;
  };
  
  return {
    isConnected: !!slackConnection,
    postMessage
  };
}
```

### Creating Custom Hooks

```typescript
// src/hooks/useCredentialStatus.ts
export function useCredentialStatus(connectionId: string) {
  const [status, setStatus] = useState<ConnectionStatus>();
  const [checking, setChecking] = useState(false);
  
  const checkStatus = useCallback(async () => {
    setChecking(true);
    
    try {
      const { data } = await supabase
        .from('user_oauth_connections')
        .select('connection_status, token_expires_at')
        .eq('id', connectionId)
        .single();
      
      // Check if token needs refresh
      if (data.credential_type === 'oauth') {
        const expiresAt = new Date(data.token_expires_at);
        const needsRefresh = expiresAt < new Date(Date.now() + 300000);
        
        if (needsRefresh) {
          await refreshToken(connectionId);
        }
      }
      
      setStatus(data.connection_status);
    } finally {
      setChecking(false);
    }
  }, [connectionId]);
  
  useEffect(() => {
    checkStatus();
    
    // Check periodically
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, [checkStatus]);
  
  return { status, checking, refresh: checkStatus };
}
```

## Deployment

### Production Build

```bash
# Build frontend
npm run build

# Test production build
npm run preview

# Deploy edge functions
supabase functions deploy --project-ref your-project-ref

# Push database changes
supabase db push --project-ref your-project-ref
```

### Environment Variables

Production secrets:

```bash
# Set via Supabase Dashboard or CLI
supabase secrets set GOOGLE_CLIENT_ID=prod-client-id
supabase secrets set GOOGLE_CLIENT_SECRET=prod-secret
supabase secrets set SENTRY_DSN=your-sentry-dsn
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run lint
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: supabase/setup-cli@v1
      
      - name: Deploy Functions
        run: |
          supabase functions deploy \
            --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      
      - name: Deploy Frontend
        run: |
          npm ci
          npm run build
          # Deploy to your hosting provider
```

## Monitoring & Debugging

### Logging

```typescript
// Structured logging
class Logger {
  private context: string;
  
  constructor(context: string) {
    this.context = context;
  }
  
  info(message: string, data?: any) {
    console.log(JSON.stringify({
      level: 'info',
      context: this.context,
      message,
      data,
      timestamp: new Date().toISOString()
    }));
  }
  
  error(message: string, error?: any) {
    console.error(JSON.stringify({
      level: 'error',
      context: this.context,
      message,
      error: error?.message || error,
      stack: error?.stack,
      timestamp: new Date().toISOString()
    }));
  }
}

// Usage
const logger = new Logger('CredentialManager');
logger.info('Connection created', { connectionId });
```

### Performance Monitoring

```typescript
// Track performance metrics
function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  
  return fn().finally(() => {
    const duration = performance.now() - start;
    
    // Send to analytics
    if (window.analytics) {
      window.analytics.track('Performance', {
        metric: name,
        duration,
        timestamp: new Date().toISOString()
      });
    }
    
    // Log if slow
    if (duration > 1000) {
      console.warn(`Slow operation: ${name} took ${duration}ms`);
    }
  });
}

// Usage
const connections = await measurePerformance(
  'fetch_connections',
  () => getUserConnections(userId)
);
```

## Contributing

### Pull Request Process

1. **Fork and clone** the repository
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Make changes** and write tests
4. **Run tests**: `npm test`
5. **Lint code**: `npm run lint`
6. **Commit with conventional commits**: `git commit -m "feat: add new feature"`
7. **Push branch**: `git push origin feature/your-feature`
8. **Create Pull Request** with description

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Code style
- `refactor:` Refactoring
- `test:` Tests
- `chore:` Maintenance

### Code Review Checklist

- [ ] Tests pass
- [ ] Code follows style guide
- [ ] Documentation updated
- [ ] No console.logs
- [ ] Error handling implemented
- [ ] TypeScript types correct
- [ ] Database migrations included
- [ ] Security considerations addressed

## Resources

### Documentation

- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Tools

- [Supabase CLI](https://github.com/supabase/cli)
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [TypeScript Playground](https://www.typescriptlang.org/play)
- [Regex101](https://regex101.com/)

### Community

- GitHub Discussions
- Discord Server
- Stack Overflow (`#supabase`, `#react`)

## Troubleshooting Development Issues

### Common Problems

1. **Supabase won't start**: Check Docker is running
2. **Type errors**: Run `npm run type-check`
3. **Lint errors**: Run `npm run lint:fix`
4. **Test failures**: Check test database is clean
5. **Function errors**: Check logs with `supabase functions logs`

### Debug Commands

```bash
# Check Supabase status
supabase status

# View function logs
supabase functions logs oauth-refresh --tail

# Database console
psql postgresql://postgres:postgres@localhost:54322/postgres

# Reset everything
supabase db reset
npm run clean
npm install
```
