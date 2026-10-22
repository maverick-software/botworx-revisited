# Agentopia Architecture Analysis for QuickChart Integration

## Database Schema Analysis

### Service Providers Table Structure
Based on migration `20250913120000_consolidate_to_service_providers.sql`:

```sql
service_providers {
  id: uuid PRIMARY KEY,
  name: text UNIQUE, -- e.g., 'quickchart'
  display_name: text, -- e.g., 'QuickChart.io'
  authorization_endpoint: text, -- Not needed for API key
  token_endpoint: text, -- Not needed for API key  
  revoke_endpoint: text, -- Not needed for API key
  discovery_endpoint: text, -- Not needed
  scopes_supported: jsonb, -- Chart generation permissions
  pkce_required: boolean DEFAULT false,
  client_credentials_location: text DEFAULT 'header',
  is_enabled: boolean DEFAULT true,
  configuration_metadata: jsonb, -- API config details
  created_at: timestamptz,
  updated_at: timestamptz
}
```

### Integration Pattern Examples
From existing migrations (Mistral AI, ClickSend):
- **API Key Pattern**: Store API endpoint, authentication method
- **Configuration Metadata**: Features, limits, pricing info
- **Scope System**: Define available chart types as scopes

### Tool Catalog Integration
Tools are registered in `tool_catalog` table with:
- OpenAI function schema format
- Provider linkage
- Category classification
- Tool-specific metadata

## Integration Architecture Analysis

### Current Integration Types
1. **OAuth 2.0**: Gmail, Microsoft services
2. **API Key**: Mistral AI, ClickSend, web search APIs  
3. **SMTP**: Email server connections
4. **Internal**: Contact management, media library

### QuickChart Fits: API Key Pattern
Similar to existing integrations:
- **Mistral AI**: API key with endpoint configuration
- **Serper API**: Simple API key for web search
- **Brave Search**: API key with rate limits

### Universal Tool Executor Routing
From `tool-architecture/06_backend_services/universal_tool_executor.mdc`:
- Tools routed by prefix pattern (e.g., `quickchart_*`)
- Edge function mapping for tool execution
- Parameter transformation and validation
- Error enhancement for LLM-friendly responses

## Frontend Integration Patterns

### Setup Modal Pattern
Based on existing API key integrations:
1. **API Key Input**: Secure input field
2. **Validation**: Test API key before saving
3. **Feature Display**: Show available chart types
4. **Vault Storage**: Encrypt and store API key

### Integration Registry
From `src/integrations/index.ts` pattern:
```typescript
{
  id: 'quickchart',
  name: 'QuickChart.io',
  description: 'Generate charts and graphs from data',
  category: 'data_visualization',
  provider_type: 'api_key',
  icon: ChartIcon,
  setupComponent: QuickChartSetupModal,
  tools: ['quickchart_bar_chart', 'quickchart_line_chart', ...],
  optional_api_key: true // Free tier available
}
```

## Edge Function Architecture

### Function Structure Pattern
Based on existing edge functions:
```
supabase/functions/quickchart-api/
├── index.ts (main handler)
├── chart-generator.ts (chart logic)
├── validation.ts (input validation)
└── types.ts (TypeScript types)
```

### Error Handling Pattern
LLM-friendly error messages:
- "Question: What type of chart would you like to create?"
- "Question: Please provide data for the chart"
- "The chart service is temporarily unavailable"

## Security Implementation

### Vault Integration
- Optional API key storage for paid plans
- Free tier requires no credentials
- Encryption using Supabase Vault functions

### Input Validation
- Chart.js configuration validation
- Size limits (width/height)
- Data sanitization
- Rate limiting compliance

## Tool Implementation Strategy

### Tool Categories
**Data Visualization Tools**:
1. **Basic Charts**: Bar, line, pie charts with simple data
2. **Advanced Charts**: Scatter, radar, bubble charts
3. **Custom Charts**: Full Chart.js configuration support
4. **Data Import**: CSV/JSON data processing

### Function Schemas
Following OpenAI function calling format:
```typescript
{
  type: "function",
  function: {
    name: "quickchart_create_bar_chart",
    description: "Create a bar chart from data",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Chart title" },
        labels: { type: "array", items: { type: "string" } },
        data: { type: "array", items: { type: "number" } },
        width: { type: "number", default: 500 },
        height: { type: "number", default: 300 }
      },
      required: ["labels", "data"]
    }
  }
}
```

## File Structure Plan

### Backend Files
```
supabase/functions/quickchart-api/
├── index.ts                 # Main edge function handler
├── chart-generator.ts       # Chart creation logic
├── validation.ts           # Input validation
├── types.ts                # TypeScript interfaces
└── config.ts               # API configuration

supabase/migrations/
└── 20250918000001_add_quickchart_integration.sql
```

### Frontend Files  
```
src/integrations/quickchart/
├── components/
│   ├── QuickChartSetupModal.tsx      # Setup modal
│   └── QuickChartIntegrationCard.tsx # Integration card
├── hooks/
│   └── useQuickChartIntegration.ts   # React hooks
├── services/
│   └── quickchart-tools.ts          # Tool definitions
├── types/
│   └── quickchart.ts                # TypeScript types
└── index.ts                         # Export barrel
```

## Dependencies Analysis

### Existing Dependencies
- **Supabase**: Database and edge functions
- **React**: Frontend framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling

### New Dependencies Required
- None (using native fetch for HTTP requests)
- Chart.js types for validation (dev dependency)

## Testing Strategy

### Database Testing
- Service provider creation
- Tool catalog entries
- Integration credentials

### Edge Function Testing  
- Chart generation with various configs
- Error handling scenarios
- Rate limiting behavior

### Frontend Testing
- Setup modal functionality
- Integration card display
- Tool execution flow

## Performance Considerations

### Caching Strategy
- Generated chart URLs can be cached
- Chart configurations for reuse
- Rate limit tracking per user

### Optimization
- Lazy loading of chart components
- Debounced API calls
- Image compression options

## Compliance and Security

### Data Handling
- No sensitive data in chart generation
- Public chart URLs (consider privacy)
- Optional API key encryption

### Rate Limiting
- Respect QuickChart.io rate limits
- Implement client-side throttling
- Graceful degradation for free tier

## Migration Planning

### Database Changes
1. Add service provider entry
2. Add tool catalog entries
3. Create any additional tables if needed

### Code Changes
1. Edge function implementation
2. Frontend components
3. Integration registry updates
4. Universal tool executor routing

### Testing Requirements
1. Unit tests for chart generation
2. Integration tests for API calls
3. E2E tests for user workflow

