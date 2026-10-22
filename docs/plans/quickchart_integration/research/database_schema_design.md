# Database Schema Design Research

## Service Providers Table Structure

Based on migration analysis, the `service_providers` table has the following structure:

```sql
CREATE TABLE service_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL, -- e.g., 'quickchart'
  display_name TEXT NOT NULL, -- e.g., 'QuickChart.io'
  authorization_endpoint TEXT, -- NULL for API key services
  token_endpoint TEXT, -- NULL for API key services
  revoke_endpoint TEXT, -- NULL for API key services
  discovery_endpoint TEXT, -- NULL for API key services
  scopes_supported JSONB, -- Chart types as scopes
  pkce_required BOOLEAN DEFAULT false,
  client_credentials_location TEXT DEFAULT 'header',
  is_enabled BOOLEAN DEFAULT true,
  configuration_metadata JSONB, -- API config and features
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## QuickChart Service Provider Configuration

### Basic Fields
- **name**: 'quickchart'
- **display_name**: 'QuickChart.io'
- **authorization_endpoint**: NULL (API key service)
- **token_endpoint**: NULL (API key service)
- **revoke_endpoint**: NULL (API key service)
- **discovery_endpoint**: NULL
- **pkce_required**: false
- **client_credentials_location**: 'header'
- **is_enabled**: true

### Scopes Supported (Chart Types)
```json
[
  "bar_chart",
  "line_chart", 
  "pie_chart",
  "scatter_plot",
  "area_chart",
  "radar_chart",
  "bubble_chart",
  "mixed_chart",
  "custom_chart"
]
```

### Configuration Metadata
```json
{
  "authentication_type": "api_key",
  "api_base_url": "https://quickchart.io",
  "chart_endpoint": "/chart",
  "supported_formats": ["png", "jpg", "pdf", "svg", "webp"],
  "max_width": 2000,
  "max_height": 2000,
  "default_width": 500,
  "default_height": 300,
  "rate_limits": {
    "free_tier_monthly": 100,
    "requests_per_minute": 10
  },
  "pricing_tiers": {
    "free": {
      "monthly_charts": 100,
      "max_size": "500x300"
    },
    "paid": {
      "monthly_charts": 10000,
      "max_size": "2000x2000",
      "custom_domains": true
    }
  },
  "features": {
    "chart_types": ["bar", "line", "pie", "scatter", "area", "radar", "bubble", "mixed"],
    "output_formats": ["png", "jpg", "pdf", "svg", "webp"],
    "custom_styling": true,
    "chart_js_v3": true,
    "responsive_charts": true
  },
  "icon_name": "BarChart3",
  "integration_description": "Generate charts and graphs from data using Chart.js configurations",
  "documentation_url": "https://quickchart.io/documentation/",
  "is_popular": true,
  "display_order": 5,
  "agent_classification": "tool",
  "category_id": "data_visualization"
}
```

## Tool Catalog Schema

Based on the reasoning tools migration, tools use this structure:

```sql
CREATE TABLE tool_catalog (
  id UUID PRIMARY KEY,
  tool_name TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  provider TEXT,
  version TEXT DEFAULT '1.0.0',
  status TEXT DEFAULT 'available',
  package_identifier TEXT,
  docker_image_url TEXT,
  required_config_schema JSONB,
  required_capabilities_schema JSONB,
  default_config_template JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## QuickChart Tools Configuration

### 1. Bar Chart Tool
```sql
{
  "id": "gen_random_uuid()",
  "tool_name": "quickchart_create_bar_chart",
  "name": "Create Bar Chart",
  "description": "Generate vertical or horizontal bar charts from data",
  "category": "data_visualization",
  "provider": "quickchart",
  "version": "1.0.0",
  "status": "available",
  "required_config_schema": {
    "type": "object",
    "properties": {
      "title": {"type": "string", "description": "Chart title"},
      "labels": {"type": "array", "items": {"type": "string"}, "description": "Category labels"},
      "data": {"type": "array", "items": {"type": "number"}, "description": "Data values"},
      "orientation": {"type": "string", "enum": ["vertical", "horizontal"], "default": "vertical"},
      "width": {"type": "integer", "default": 500, "maximum": 2000},
      "height": {"type": "integer", "default": 300, "maximum": 2000},
      "backgroundColor": {"type": "string", "default": "rgba(75, 192, 192, 0.2)"},
      "borderColor": {"type": "string", "default": "rgba(75, 192, 192, 1)"}
    },
    "required": ["labels", "data"]
  },
  "default_config_template": {
    "edge_function": "quickchart-api",
    "action": "create_bar_chart",
    "requires_auth": false,
    "supports_streaming": false
  }
}
```

### 2. Line Chart Tool
```sql
{
  "tool_name": "quickchart_create_line_chart",
  "name": "Create Line Chart",
  "description": "Generate line charts with multiple data series",
  "required_config_schema": {
    "type": "object",
    "properties": {
      "title": {"type": "string"},
      "labels": {"type": "array", "items": {"type": "string"}},
      "datasets": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "label": {"type": "string"},
            "data": {"type": "array", "items": {"type": "number"}},
            "borderColor": {"type": "string"},
            "backgroundColor": {"type": "string"}
          },
          "required": ["label", "data"]
        }
      },
      "width": {"type": "integer", "default": 500},
      "height": {"type": "integer", "default": 300}
    },
    "required": ["labels", "datasets"]
  }
}
```

### 3. Pie Chart Tool
```sql
{
  "tool_name": "quickchart_create_pie_chart",
  "name": "Create Pie Chart",
  "description": "Generate pie or doughnut charts from data",
  "required_config_schema": {
    "type": "object",
    "properties": {
      "title": {"type": "string"},
      "labels": {"type": "array", "items": {"type": "string"}},
      "data": {"type": "array", "items": {"type": "number"}},
      "chart_type": {"type": "string", "enum": ["pie", "doughnut"], "default": "pie"},
      "colors": {"type": "array", "items": {"type": "string"}},
      "width": {"type": "integer", "default": 500},
      "height": {"type": "integer", "default": 300}
    },
    "required": ["labels", "data"]
  }
}
```

## Migration SQL Structure

```sql
-- Migration: 20250918000001_add_quickchart_integration.sql
BEGIN;

-- Add QuickChart as service provider
INSERT INTO service_providers (
  name,
  display_name,
  scopes_supported,
  pkce_required,
  client_credentials_location,
  is_enabled,
  configuration_metadata
) VALUES (
  'quickchart',
  'QuickChart.io',
  '["bar_chart", "line_chart", "pie_chart", "scatter_plot", "area_chart", "radar_chart", "bubble_chart", "mixed_chart", "custom_chart"]'::jsonb,
  false,
  'header',
  true,
  '{...configuration_metadata...}'::jsonb
);

-- Add chart generation tools to tool_catalog
INSERT INTO tool_catalog (
  tool_name,
  name,
  description,
  category,
  provider,
  required_config_schema,
  default_config_template
) VALUES
('quickchart_create_bar_chart', '...'),
('quickchart_create_line_chart', '...'),
('quickchart_create_pie_chart', '...'),
-- ... additional tools

COMMIT;
```

## Backup Strategy
- Backup existing service_providers table before adding new entry
- Backup tool_catalog table before adding new tools
- Create rollback script to remove QuickChart entries

## RLS Policies
- Service providers table already has RLS enabled
- Public read access for enabled providers
- Service role full access for management

## Testing Queries
```sql
-- Verify service provider creation
SELECT * FROM service_providers WHERE name = 'quickchart';

-- Verify tool catalog entries
SELECT * FROM tool_catalog WHERE provider = 'quickchart';

-- Test integrations view
SELECT * FROM integrations WHERE display_name = 'QuickChart.io';
```

## Dependencies
- service_providers table must exist
- tool_catalog table must exist
- integration_categories table for category lookup
- Proper RLS policies in place

## Constraints and Validations
- Unique constraint on service_providers.name
- Unique constraint on tool_catalog.tool_name
- JSON schema validation for configuration_metadata
- Required fields must be NOT NULL

