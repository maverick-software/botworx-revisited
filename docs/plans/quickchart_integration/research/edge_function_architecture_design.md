# Edge Function Architecture Design Research

## Edge Function Structure Pattern

Based on analysis of existing edge functions, here's the standard structure:

### File Organization
```
supabase/functions/quickchart-api/
├── index.ts                 # Main handler with serve() function
├── chart-generator.ts       # Chart creation logic
├── validation.ts           # Input validation and sanitization
├── types.ts                # TypeScript interfaces
└── config.ts               # API configuration constants
```

### Main Handler Pattern (index.ts)
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers for browser compatibility
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Request/Response interfaces
interface QuickChartRequest {
  action: string;
  agent_id: string;
  user_id: string;
  params: Record<string, any>;
}

interface QuickChartResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    execution_time_ms: number;
    chart_url?: string;
    chart_config?: any;
  };
}

// Main request handler
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse and validate request
    const body: QuickChartRequest = await req.json();
    const { action, agent_id, user_id, params } = body;

    // Get user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    // Route to appropriate handler
    let result: any;
    switch (action) {
      case 'create_bar_chart':
        result = await handleCreateBarChart(params);
        break;
      case 'create_line_chart':
        result = await handleCreateLineChart(params);
        break;
      // ... other actions
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Log successful operation
    await logToolExecution(supabase, {
      agent_id,
      user_id,
      tool_name: `quickchart_${action}`,
      success: true,
      result,
      execution_time_ms: Date.now() - startTime
    });

    return new Response(JSON.stringify({
      success: true,
      data: result,
      metadata: {
        execution_time_ms: Date.now() - startTime
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    // Enhanced error handling
    const enhancedError = enhanceQuickChartError(error.message);
    
    return new Response(JSON.stringify({
      success: false,
      error: enhancedError,
      metadata: {
        execution_time_ms: Date.now() - startTime
      }
    }), {
      status: 200, // Return 200 to prevent retry on client errors
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
```

## Action Handler Patterns

### Chart Generation Handler Structure
```typescript
// chart-generator.ts
export async function handleCreateBarChart(params: any): Promise<any> {
  // 1. Validate parameters with LLM-friendly errors
  validateBarChartParams(params);
  
  // 2. Transform parameters to Chart.js config
  const chartConfig = buildBarChartConfig(params);
  
  // 3. Generate chart via QuickChart API
  const chartUrl = await generateChart(chartConfig, {
    width: params.width || 500,
    height: params.height || 300,
    format: params.format || 'png'
  });
  
  // 4. Return structured response
  return {
    chart_url: chartUrl,
    chart_type: 'bar',
    chart_config: chartConfig,
    message: `Bar chart created successfully with ${params.data.length} data points`
  };
}
```

### Parameter Validation Pattern
```typescript
// validation.ts
export function validateBarChartParams(params: any): void {
  const errors: string[] = [];
  
  // Required parameter checks with LLM-friendly messages
  if (!params.labels || !Array.isArray(params.labels)) {
    errors.push('Question: What categories would you like to show on the chart? Please provide labels as an array of strings.');
  }
  
  if (!params.data || !Array.isArray(params.data)) {
    errors.push('Question: What data values would you like to chart? Please provide data as an array of numbers.');
  }
  
  // Data consistency checks
  if (params.labels && params.data && params.labels.length !== params.data.length) {
    errors.push('Question: The number of labels and data values don\'t match. Please provide the same number of labels and data points.');
  }
  
  // Size validation
  if (params.width && (params.width < 100 || params.width > 2000)) {
    errors.push('Question: The chart width should be between 100 and 2000 pixels. Please adjust the width parameter.');
  }
  
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }
}
```

## Chart Generation Logic

### QuickChart API Integration
```typescript
// chart-generator.ts
interface ChartGenerationOptions {
  width: number;
  height: number;
  format: 'png' | 'jpg' | 'pdf' | 'svg' | 'webp';
  backgroundColor?: string;
}

export async function generateChart(
  chartConfig: any, 
  options: ChartGenerationOptions
): Promise<string> {
  const apiUrl = 'https://quickchart.io/chart';
  
  // For simple charts, use GET request with URL encoding
  if (isSimpleChart(chartConfig)) {
    const params = new URLSearchParams({
      c: JSON.stringify(chartConfig),
      w: options.width.toString(),
      h: options.height.toString(),
      f: options.format
    });
    
    return `${apiUrl}?${params.toString()}`;
  }
  
  // For complex charts, use POST request
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chart: chartConfig,
      width: options.width,
      height: options.height,
      format: options.format,
      backgroundColor: options.backgroundColor
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chart generation failed: ${errorText}`);
  }
  
  // Return the chart URL from response headers or body
  const chartUrl = response.headers.get('Location') || response.url;
  return chartUrl;
}
```

### Chart.js Configuration Builders
```typescript
// chart-generator.ts
export function buildBarChartConfig(params: any): any {
  return {
    type: params.orientation === 'horizontal' ? 'horizontalBar' : 'bar',
    data: {
      labels: params.labels,
      datasets: [{
        label: params.title || 'Data',
        data: params.data,
        backgroundColor: params.backgroundColor || 'rgba(75, 192, 192, 0.2)',
        borderColor: params.borderColor || 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: !!params.title,
          text: params.title
        },
        legend: {
          display: false // Single dataset doesn't need legend
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  };
}

export function buildLineChartConfig(params: any): any {
  return {
    type: 'line',
    data: {
      labels: params.labels,
      datasets: params.datasets.map((dataset: any, index: number) => ({
        label: dataset.label,
        data: dataset.data,
        borderColor: dataset.borderColor || getDefaultColor(index),
        backgroundColor: dataset.backgroundColor || getDefaultColor(index, 0.2),
        fill: dataset.fill || false,
        tension: 0.1
      }))
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: !!params.title,
          text: params.title
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  };
}
```

## Error Handling Strategy

### LLM-Friendly Error Enhancement
```typescript
// validation.ts
export function enhanceQuickChartError(error: string): string {
  const lowerError = error.toLowerCase();
  
  // Chart configuration errors
  if (lowerError.includes('invalid chart config') || lowerError.includes('malformed')) {
    return 'Question: There seems to be an issue with the chart configuration. Could you provide the chart data in a different format or check that all required fields are included?';
  }
  
  // Data validation errors
  if (lowerError.includes('empty data') || lowerError.includes('no data')) {
    return 'Question: The chart needs data to display. Could you provide the data values you\'d like to visualize?';
  }
  
  // Size limit errors
  if (lowerError.includes('too large') || lowerError.includes('size limit')) {
    return 'Question: The chart dimensions are too large. Could you reduce the width and height to under 2000 pixels each?';
  }
  
  // API key errors (for paid features)
  if (lowerError.includes('unauthorized') || lowerError.includes('api key')) {
    return 'Question: This chart feature requires a QuickChart API key. Would you like to set up an API key for advanced features, or shall I create a simpler chart using the free tier?';
  }
  
  // Rate limiting
  if (lowerError.includes('rate limit') || lowerError.includes('quota')) {
    return 'Question: The chart service is temporarily rate limited. Please try again in a few minutes, or consider upgrading to a paid plan for higher limits.';
  }
  
  // Service unavailable
  if (lowerError.includes('service unavailable') || lowerError.includes('timeout')) {
    return 'Question: The chart generation service is temporarily unavailable. Would you like me to try again, or shall we proceed with a different approach?';
  }
  
  // Generic enhancement
  return `Question: I encountered an issue while creating the chart. ${error} Could you provide the chart requirements in a different way?`;
}
```

## Logging and Monitoring

### Tool Execution Logging
```typescript
// index.ts
async function logToolExecution(
  supabase: any,
  data: {
    agent_id: string;
    user_id: string;
    tool_name: string;
    success: boolean;
    result?: any;
    error_message?: string;
    execution_time_ms: number;
  }
) {
  try {
    await supabase.from('tool_execution_logs').insert({
      agent_id: data.agent_id,
      user_id: data.user_id,
      tool_name: data.tool_name,
      tool_provider: 'quickchart',
      parameters: data.result?.chart_config || {},
      success: data.success,
      error_message: data.error_message,
      execution_time_ms: data.execution_time_ms,
      quota_consumed: data.success ? 1 : 0, // 1 chart generated
      response_data: data.result
    });
  } catch (logError) {
    console.error('[QuickChart] Failed to log execution:', logError);
  }
}
```

## Configuration Management

### API Configuration
```typescript
// config.ts
export const QUICKCHART_CONFIG = {
  API_BASE_URL: 'https://quickchart.io',
  CHART_ENDPOINT: '/chart',
  DEFAULT_WIDTH: 500,
  DEFAULT_HEIGHT: 300,
  MAX_WIDTH: 2000,
  MAX_HEIGHT: 2000,
  SUPPORTED_FORMATS: ['png', 'jpg', 'pdf', 'svg', 'webp'],
  DEFAULT_FORMAT: 'png',
  FREE_TIER_LIMIT: 100, // Charts per month
  RATE_LIMIT_WINDOW: 60000, // 1 minute in ms
  DEFAULT_COLORS: [
    'rgba(75, 192, 192, 0.8)',
    'rgba(255, 99, 132, 0.8)',
    'rgba(255, 205, 86, 0.8)',
    'rgba(54, 162, 235, 0.8)',
    'rgba(153, 102, 255, 0.8)'
  ]
};

export function getDefaultColor(index: number, alpha: number = 0.8): string {
  const colors = QUICKCHART_CONFIG.DEFAULT_COLORS;
  const baseColor = colors[index % colors.length];
  
  if (alpha !== 0.8) {
    // Replace alpha value in rgba string
    return baseColor.replace(/0\.8/, alpha.toString());
  }
  
  return baseColor;
}
```

## Universal Tool Executor Integration

### Routing Configuration
```typescript
// Add to universal-tool-executor.ts TOOL_ROUTING_MAP
'quickchart_': {
  edgeFunction: 'quickchart-api',
  actionMapping: (toolName: string) => {
    const actionMap: Record<string, string> = {
      'quickchart_create_bar_chart': 'create_bar_chart',
      'quickchart_create_line_chart': 'create_line_chart',
      'quickchart_create_pie_chart': 'create_pie_chart',
      'quickchart_create_scatter_plot': 'create_scatter_plot',
      'quickchart_generate_custom_chart': 'generate_custom_chart'
    };
    return actionMap[toolName] || 'create_bar_chart';
  },
  parameterMapping: (params: Record<string, any>, context: any) => {
    const action = context.toolName.replace('quickchart_create_', '').replace('quickchart_generate_', '');
    
    return {
      action: action,
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    };
  }
}
```

## Testing and Validation

### Unit Test Structure
```typescript
// tests/quickchart-api.test.ts
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

Deno.test('Bar chart parameter validation', () => {
  // Test valid parameters
  const validParams = {
    labels: ['A', 'B', 'C'],
    data: [1, 2, 3]
  };
  
  // Should not throw
  validateBarChartParams(validParams);
});

Deno.test('Bar chart configuration generation', () => {
  const params = {
    labels: ['Q1', 'Q2', 'Q3'],
    data: [100, 150, 200],
    title: 'Quarterly Sales'
  };
  
  const config = buildBarChartConfig(params);
  
  assertEquals(config.type, 'bar');
  assertEquals(config.data.labels, params.labels);
  assertEquals(config.data.datasets[0].data, params.data);
});
```

## Performance Considerations

### Caching Strategy
- Cache Chart.js configurations for common patterns
- Implement request deduplication for identical charts
- Use URL-based charts for simple configurations (faster)

### Rate Limiting
- Track usage per user/agent
- Implement client-side throttling
- Graceful degradation for rate limits

### Error Recovery
- Retry failed requests with exponential backoff
- Fallback to simpler chart configurations
- Provide alternative visualization suggestions

