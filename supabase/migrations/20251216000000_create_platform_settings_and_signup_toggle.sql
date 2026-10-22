-- Migration: Create platform_settings table and add signup toggle functionality
-- Date: 2025-01-16
-- Purpose: Enable admins to control whether new users can sign up

-- Create platform_settings table for storing platform-wide configuration
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  description text,
  category text DEFAULT 'general',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage platform settings
CREATE POLICY "Admins can manage platform settings"
  ON public.platform_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name = 'admin'
    )
  );

-- Allow service role full access
CREATE POLICY "Service role can access platform settings" 
  ON public.platform_settings
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Allow anonymous users to READ signup_enabled setting only
CREATE POLICY "Anonymous can read signup status"
  ON public.platform_settings
  FOR SELECT
  TO anon
  USING (key = 'signup_enabled');

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_platform_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_settings_updated_at();

-- Add comment
COMMENT ON TABLE public.platform_settings IS 'Platform-wide settings and configuration managed by administrators';

-- Insert default signup_enabled setting (enabled by default)
INSERT INTO public.platform_settings (key, value, description, category)
VALUES 
  ('signup_enabled', 'true', 'Controls whether new users can sign up for accounts', 'authentication')
ON CONFLICT (key) DO NOTHING;

