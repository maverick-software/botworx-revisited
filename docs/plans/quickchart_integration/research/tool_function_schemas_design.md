# Tool Function Schemas Design Research

## OpenAI Function Schema Format

Based on the analysis of existing tools, Agentopia uses the standard OpenAI function calling schema format. Here are the key patterns:

### Base Schema Structure
```typescript
{
  type: "function",
  function: {
    name: "tool_name",
    description: "Human-readable description of what the tool does",
    parameters: {
      type: "object",
      properties: {
        // Parameter definitions
      },
      required: ["required_param1", "required_param2"]
    }
  }
}
```

### Parameter Types and Patterns
From existing tools, these patterns are used:

#### String Parameters
```typescript
{
  type: "string",
  description: "Clear description of the parameter",
  enum: ["option1", "option2"], // Optional for restricted values
  default: "default_value" // Optional default
}
```

#### Number/Integer Parameters
```typescript
{
  type: "integer", // or "number"
  description: "Parameter description",
  default: 500,
  minimum: 1,
  maximum: 2000
}
```

#### Array Parameters
```typescript
{
  type: "array",
  items: { type: "string" }, // or other types
  description: "Array description"
}
```

#### Object Parameters (for complex data)
```typescript
{
  type: "object",
  properties: {
    label: { type: "string" },
    data: { type: "array", items: { type: "number" } }
  },
  required: ["label", "data"]
}
```

## QuickChart Tool Schemas

### 1. Bar Chart Tool Schema
```typescript
{
  type: "function",
  function: {
    name: "quickchart_create_bar_chart",
    description: "Create a vertical or horizontal bar chart from data. Perfect for comparing categories or showing data over time.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title to display at the top of the chart"
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Category labels for the x-axis (or y-axis for horizontal charts)"
        },
        data: {
          type: "array",
          items: { type: "number" },
          description: "Numeric data values corresponding to each label"
        },
        orientation: {
          type: "string",
          enum: ["vertical", "horizontal"],
          default: "vertical",
          description: "Chart orientation - vertical bars (default) or horizontal bars"
        },
        width: {
          type: "integer",
          default: 500,
          minimum: 100,
          maximum: 2000,
          description: "Chart width in pixels"
        },
        height: {
          type: "integer", 
          default: 300,
          minimum: 100,
          maximum: 2000,
          description: "Chart height in pixels"
        },
        backgroundColor: {
          type: "string",
          default: "rgba(75, 192, 192, 0.2)",
          description: "Background color for bars (CSS color format)"
        },
        borderColor: {
          type: "string",
          default: "rgba(75, 192, 192, 1)",
          description: "Border color for bars (CSS color format)"
        }
      },
      required: ["labels", "data"]
    }
  }
}
```

### 2. Line Chart Tool Schema
```typescript
{
  type: "function",
  function: {
    name: "quickchart_create_line_chart",
    description: "Create a line chart with one or multiple data series. Ideal for showing trends over time or continuous data.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title to display at the top of the chart"
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Labels for the x-axis (typically time periods or categories)"
        },
        datasets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Name of this data series" },
              data: { type: "array", items: { type: "number" }, description: "Data points for this series" },
              borderColor: { type: "string", description: "Line color (CSS color format)" },
              backgroundColor: { type: "string", description: "Fill color under line (CSS color format)" },
              fill: { type: "boolean", default: false, description: "Whether to fill area under the line" }
            },
            required: ["label", "data"]
          },
          description: "Array of data series to plot on the chart"
        },
        width: {
          type: "integer",
          default: 500,
          minimum: 100,
          maximum: 2000,
          description: "Chart width in pixels"
        },
        height: {
          type: "integer",
          default: 300,
          minimum: 100,
          maximum: 2000,
          description: "Chart height in pixels"
        }
      },
      required: ["labels", "datasets"]
    }
  }
}
```

### 3. Pie Chart Tool Schema
```typescript
{
  type: "function",
  function: {
    name: "quickchart_create_pie_chart",
    description: "Create a pie or doughnut chart to show proportions and percentages of a whole.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title to display at the top of the chart"
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Labels for each slice of the pie"
        },
        data: {
          type: "array",
          items: { type: "number" },
          description: "Numeric values for each slice (will be converted to percentages)"
        },
        chart_type: {
          type: "string",
          enum: ["pie", "doughnut"],
          default: "pie",
          description: "Type of chart - solid pie or doughnut with center hole"
        },
        colors: {
          type: "array",
          items: { type: "string" },
          description: "Custom colors for each slice (CSS color format). If not provided, default colors will be used."
        },
        width: {
          type: "integer",
          default: 500,
          minimum: 100,
          maximum: 2000,
          description: "Chart width in pixels"
        },
        height: {
          type: "integer",
          default: 300,
          minimum: 100,
          maximum: 2000,
          description: "Chart height in pixels"
        }
      },
      required: ["labels", "data"]
    }
  }
}
```

### 4. Scatter Plot Tool Schema
```typescript
{
  type: "function", 
  function: {
    name: "quickchart_create_scatter_plot",
    description: "Create a scatter plot to show correlation between two variables or plot individual data points.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title to display at the top of the chart"
        },
        datasets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Name of this data series" },
              data: { 
                type: "array", 
                items: {
                  type: "object",
                  properties: {
                    x: { type: "number", description: "X coordinate" },
                    y: { type: "number", description: "Y coordinate" }
                  },
                  required: ["x", "y"]
                },
                description: "Array of {x, y} coordinate pairs"
              },
              backgroundColor: { type: "string", description: "Point color (CSS color format)" },
              borderColor: { type: "string", description: "Point border color (CSS color format)" }
            },
            required: ["label", "data"]
          },
          description: "Array of data series to plot"
        },
        x_axis_label: {
          type: "string",
          description: "Label for the x-axis"
        },
        y_axis_label: {
          type: "string", 
          description: "Label for the y-axis"
        },
        width: {
          type: "integer",
          default: 500,
          minimum: 100,
          maximum: 2000,
          description: "Chart width in pixels"
        },
        height: {
          type: "integer",
          default: 300,
          minimum: 100,
          maximum: 2000,
          description: "Chart height in pixels"
        }
      },
      required: ["datasets"]
    }
  }
}
```

### 5. Custom Chart Tool Schema
```typescript
{
  type: "function",
  function: {
    name: "quickchart_generate_custom_chart",
    description: "Generate a chart using a complete Chart.js configuration object. Allows full customization of chart appearance and behavior.",
    parameters: {
      type: "object",
      properties: {
        chart_config: {
          type: "object",
          description: "Complete Chart.js configuration object including type, data, and options"
        },
        width: {
          type: "integer",
          default: 500,
          minimum: 100,
          maximum: 2000,
          description: "Chart width in pixels"
        },
        height: {
          type: "integer",
          default: 300,
          minimum: 100,
          maximum: 2000,
          description: "Chart height in pixels"
        },
        format: {
          type: "string",
          enum: ["png", "jpg", "pdf", "svg", "webp"],
          default: "png",
          description: "Output format for the chart image"
        }
      },
      required: ["chart_config"]
    }
  }
}
```

## Tool Registration in Frontend

Based on existing integration patterns, tools are registered in the frontend like this:

### Integration Registry Entry
```typescript
// In src/integrations/quickchart/services/quickchart-tools.ts
export const QUICKCHART_TOOLS = [
  {
    name: 'quickchart_create_bar_chart',
    displayName: 'Create Bar Chart',
    description: 'Generate vertical or horizontal bar charts from data',
    category: 'data_visualization',
    schema: {
      // OpenAI function schema here
    }
  },
  {
    name: 'quickchart_create_line_chart',
    displayName: 'Create Line Chart', 
    description: 'Create line charts with multiple data series',
    category: 'data_visualization',
    schema: {
      // OpenAI function schema here
    }
  }
  // ... additional tools
];
```

### Integration Definition
```typescript
// In src/integrations/index.ts
{
  id: 'quickchart',
  name: 'QuickChart.io',
  description: 'Generate charts and graphs from data',
  category: 'data_visualization',
  provider_type: 'api_key',
  icon: BarChart3,
  setupComponent: QuickChartSetupModal,
  tools: [
    'quickchart_create_bar_chart',
    'quickchart_create_line_chart',
    'quickchart_create_pie_chart',
    'quickchart_create_scatter_plot',
    'quickchart_generate_custom_chart'
  ],
  optional_api_key: true // Free tier available
}
```

## Tool Execution Flow

### Universal Tool Executor Routing
```typescript
// In supabase/functions/chat/function_calling/universal-tool-executor.ts
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
  parameterMapping: (params: Record<string, any>, context: any) => ({
    action: context.toolName.replace('quickchart_', ''),
    agent_id: context.agentId,
    user_id: context.userId,
    params: params
  })
}
```

## Validation and Error Handling

### Parameter Validation
- Required fields must be validated before API call
- Size limits enforced (width/height max 2000px)
- Data array length validation
- Color format validation (CSS colors)
- Chart type enum validation

### Error Messages (LLM-Friendly)
```typescript
// Examples of LLM-friendly error messages
"Question: What data would you like to chart? Please provide labels and corresponding data values."
"Question: The chart size is too large. Please use dimensions under 2000x2000 pixels."
"Question: The data array is empty. Please provide at least one data point to chart."
```

## Testing Schema Validation

### Unit Test Examples
```typescript
// Test parameter validation
describe('QuickChart Tool Schemas', () => {
  test('bar chart requires labels and data', () => {
    const schema = getBarChartSchema();
    expect(schema.function.parameters.required).toContain('labels');
    expect(schema.function.parameters.required).toContain('data');
  });

  test('chart dimensions have proper limits', () => {
    const schema = getBarChartSchema();
    expect(schema.function.parameters.properties.width.maximum).toBe(2000);
    expect(schema.function.parameters.properties.height.minimum).toBe(100);
  });
});
```

## Schema Generation Strategy

### Dynamic Schema Generation
Based on the tool-generator.ts pattern, schemas can be generated dynamically:

```typescript
export function generateQuickChartSchema(toolName: string) {
  const baseSchema = {
    type: 'object' as const,
    properties: {},
    required: [] as string[]
  };

  if (toolName === 'quickchart_create_bar_chart') {
    return {
      ...baseSchema,
      properties: {
        // Bar chart specific properties
      },
      required: ['labels', 'data']
    };
  }
  
  // Handle other chart types...
}
```

This approach allows for:
- Consistent schema generation
- Easy maintenance and updates
- Runtime schema customization
- Validation reuse across tools

