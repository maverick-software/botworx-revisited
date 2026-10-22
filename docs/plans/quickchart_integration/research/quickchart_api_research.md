# QuickChart.io API Research

## Overview
QuickChart.io is a web service that generates chart images on-the-fly using Chart.js configurations. It provides a simple REST API for creating various types of charts without requiring client-side rendering.

## API Capabilities

### Base URL
- Production: `https://quickchart.io/chart`
- Free tier available with rate limits
- Paid plans for higher usage and additional features

### Supported Chart Types
- Bar Charts (horizontal/vertical)
- Line Charts
- Pie Charts
- Doughnut Charts
- Scatter Plots
- Area Charts
- Radar Charts
- Polar Area Charts
- Bubble Charts
- Mixed Chart Types

### API Methods

#### 1. GET Request (URL Parameters)
```
GET https://quickchart.io/chart?c={chart_config}
```

#### 2. POST Request (JSON Body)
```
POST https://quickchart.io/chart
Content-Type: application/json

{
  "chart": {chart_config},
  "width": 500,
  "height": 300,
  "format": "png"
}
```

### Configuration Options
- **width**: Chart width (default: 500px, max: 2000px)
- **height**: Chart height (default: 300px, max: 2000px)
- **format**: Output format (png, jpg, pdf, svg, webp)
- **backgroundColor**: Background color
- **devicePixelRatio**: For high-DPI displays

### Chart.js Configuration
QuickChart.io uses Chart.js v3.x configuration format:
```javascript
{
  type: 'bar',
  data: {
    labels: ['January', 'February', 'March'],
    datasets: [{
      label: 'Sales',
      data: [12, 19, 3],
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1
    }]
  },
  options: {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'Monthly Sales Data'
      }
    }
  }
}
```

### Rate Limits
- Free tier: 100 charts per month
- Rate limiting based on IP address
- Paid plans available for higher limits

### Authentication
- No authentication required for basic usage
- API keys available for paid plans
- Supports custom domains for enterprise

### Error Handling
- HTTP status codes for errors
- JSON error responses with details
- Common errors: invalid config, rate limit exceeded, size limits

## Integration Approach for Agentopia

### 1. Service Provider Type
**API Key Integration** (for paid plans) or **Public API** (for free tier)
- No OAuth required
- Optional API key for paid features
- Simple HTTP requests

### 2. Tool Categories
**Data Visualization Tools**:
- `quickchart_create_bar_chart`
- `quickchart_create_line_chart`
- `quickchart_create_pie_chart`
- `quickchart_create_scatter_plot`
- `quickchart_generate_custom_chart`

### 3. Use Cases
- Data visualization for reports
- Creating charts from CSV data
- Generating charts for presentations
- Quick data analysis visualization
- Dashboard chart generation

### 4. Security Considerations
- No sensitive data transmitted (charts are public URLs)
- Optional API key storage in Vault for paid plans
- Rate limiting compliance
- Input validation for chart configurations

## Technical Implementation Notes

### Dependencies
- No additional npm packages required (native fetch)
- Chart.js configuration validation
- Image URL handling and storage

### Error Handling Patterns
- Invalid chart configuration
- Rate limit exceeded
- Service unavailable
- Image generation failures

### Performance Considerations
- Chart generation is synchronous
- Images can be cached
- URL-based charts for simple cases
- POST requests for complex configurations

## Next Steps
1. Create service provider entry in database
2. Implement edge function for chart generation
3. Create tool catalog entries
4. Build frontend setup modal
5. Add to integration registry
6. Implement error handling and validation

