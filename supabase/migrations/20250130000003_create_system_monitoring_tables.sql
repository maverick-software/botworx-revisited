-- Create missing system monitoring tables
-- This fixes the repeated "system_metrics" export failures

-- System metrics for performance monitoring
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  value double precision NOT NULL,
  type text NOT NULL,
  labels jsonb DEFAULT '{}',
  timestamp timestamptz NOT NULL DEFAULT now()
);

-- Usage events for feature tracking
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  agent_id uuid,
  metadata jsonb DEFAULT '{}'
);

-- System health checks
CREATE TABLE IF NOT EXISTS public.system_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'healthy',
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- System alerts
CREATE TABLE IF NOT EXISTS public.system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  severity text NOT NULL,
  message text NOT NULL,
  context jsonb DEFAULT '{}',
  triggered_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON public.system_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON public.system_metrics(name);
CREATE INDEX IF NOT EXISTS idx_usage_events_timestamp ON public.usage_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_feature ON public.usage_events(feature);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON public.system_alerts(severity);

-- RLS policies for security
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_metrics_service_access ON public.system_metrics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_events_service_access ON public.usage_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_health_service_access ON public.system_health
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_alerts_service_access ON public.system_alerts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE public.system_metrics IS 'Stores system performance metrics and monitoring data';
COMMENT ON TABLE public.usage_events IS 'Tracks feature usage and user interactions';
COMMENT ON TABLE public.system_health IS 'System health check results';
COMMENT ON TABLE public.system_alerts IS 'System alerts and notifications';
