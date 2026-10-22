-- Migration: Create email change audit log
-- Description: Track email changes for security and compliance
-- Date: 2025-10-09

-- Create audit log table for email changes
CREATE TABLE IF NOT EXISTS public.email_change_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  change_method TEXT DEFAULT 'user_initiated' CHECK (change_method IN ('user_initiated', 'admin', 'support')),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  notes TEXT
);

-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_email_change_audit_user_id 
  ON public.email_change_audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_email_change_audit_changed_at 
  ON public.email_change_audit_log(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_change_audit_new_email 
  ON public.email_change_audit_log(new_email);

-- Enable RLS
ALTER TABLE public.email_change_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own audit log
CREATE POLICY "Users can view own email change history"
  ON public.email_change_audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Service role can manage all audit logs
CREATE POLICY "Service role manages email change audit"
  ON public.email_change_audit_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add comments
COMMENT ON TABLE public.email_change_audit_log IS 'Audit trail for user email address changes';
COMMENT ON COLUMN public.email_change_audit_log.user_id IS 'User who changed their email';
COMMENT ON COLUMN public.email_change_audit_log.old_email IS 'Previous email address';
COMMENT ON COLUMN public.email_change_audit_log.new_email IS 'New email address';
COMMENT ON COLUMN public.email_change_audit_log.change_method IS 'How the change was initiated';
COMMENT ON COLUMN public.email_change_audit_log.verified_at IS 'When the new email was verified';

-- Grant permissions
GRANT SELECT ON public.email_change_audit_log TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

