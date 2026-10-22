### Monitoring & Metrics

### What it is
Structured logging and metrics exporters with optional DB export.

### Purpose
- Operational visibility and performance tracking
- Request correlation via `request_id`

### How it’s integrated
- `createLogger()` injects context (request_id)
- `metrics.startTimer()` used across processor stages
- `SupabaseExporter` writes to `system_metrics` (optional)

### How to interact
- Inspect logs in Supabase function logs
- Query `system_metrics` if table exists
- Frontend reads `processing_details` to display pipeline

### How to extend
- Add custom counters/histograms to `monitoring_system.ts`
- Add exporters (e.g., third-party APM) via `MetricExporter` interface

### Troubleshooting
- `Supabase export failed` → create `system_metrics` table or keep console exporter only
- Missing metrics in response → set `options.response.include_metrics=true`

### Files & Edge Functions
- `supabase/functions/chat/core/monitoring/monitoring_system.ts`
- `supabase/functions/chat/utils/logger.ts`
- `supabase/functions/chat/utils/metrics.ts`
- Edge entry: `supabase/functions/chat/index.ts`
