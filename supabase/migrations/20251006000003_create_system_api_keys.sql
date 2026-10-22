-- Create system_api_keys table for platform-wide API keys
-- These are different from user_integration_credentials (which are user-specific)
-- System API keys are shared across all users and managed by admins

CREATE TABLE IF NOT EXISTS public.system_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name text UNIQUE NOT NULL, -- 'openai', 'anthropic', etc.
  display_name text NOT NULL,
  vault_secret_id text, -- UUID of encrypted key in vault
  is_active boolean DEFAULT true,
  last_updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_api_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage system API keys
CREATE POLICY "Admins can manage system API keys"
  ON public.system_api_keys
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

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_system_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_api_keys_updated_at
  BEFORE UPDATE ON public.system_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_system_api_keys_updated_at();

-- Add comment
COMMENT ON TABLE public.system_api_keys IS 'Platform-wide API keys for system integrations like OpenAI and Anthropic. These are shared across all users and managed by admins only.';

-- Insert placeholder rows for OpenAI and Anthropic
INSERT INTO public.system_api_keys (provider_name, display_name, is_active)
VALUES 
  ('openai', 'OpenAI', false),
  ('anthropic', 'Anthropic', false)
ON CONFLICT (provider_name) DO NOTHING;

