-- Migration: Create Contact Communication Channels Table
-- Purpose: Store communication channel information for contacts
-- Dependencies: contacts table
-- File: 20250916000002_create_contact_channels_table.sql

-- Create contact communication channels table
CREATE TABLE IF NOT EXISTS contact_communication_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Channel identification
  channel_type TEXT NOT NULL CHECK (channel_type IN (
    'email', 'phone', 'mobile', 'whatsapp', 'telegram', 
    'slack', 'discord', 'teams', 'sms', 'fax', 'linkedin',
    'twitter', 'instagram', 'website', 'other'
  )),
  channel_identifier TEXT NOT NULL, -- email address, phone number, username, etc.
  display_label TEXT, -- "Work Email", "Personal Phone", etc.
  
  -- Channel status and preferences
  is_primary BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  can_receive_marketing BOOLEAN DEFAULT FALSE,
  can_receive_notifications BOOLEAN DEFAULT TRUE,
  
  -- Verification and validation
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN (
    'unverified', 'pending', 'verified', 'failed', 'expired'
  )),
  verified_at TIMESTAMPTZ,
  verification_method TEXT CHECK (verification_method IN (
    'email_click', 'sms_code', 'voice_call', 'manual', 'api_verification'
  )),
  verification_token TEXT, -- For pending verifications
  verification_expires_at TIMESTAMPTZ,
  
  -- Channel-specific metadata
  channel_metadata JSONB DEFAULT '{}', -- Provider-specific data
  formatting_metadata JSONB DEFAULT '{}', -- Display preferences, formatting rules
  integration_data JSONB DEFAULT '{}', -- External integration specific data
  
  -- Privacy and consent settings
  opt_in_date TIMESTAMPTZ,
  opt_out_date TIMESTAMPTZ,
  last_consent_update TIMESTAMPTZ,
  marketing_consent BOOLEAN DEFAULT FALSE,
  marketing_consent_date TIMESTAMPTZ,
  
  -- Communication preferences
  preferred_time_start TIME,
  preferred_time_end TIME,
  preferred_timezone TEXT DEFAULT 'UTC',
  do_not_contact_until TIMESTAMPTZ,
  communication_frequency TEXT DEFAULT 'normal' CHECK (communication_frequency IN (
    'high', 'normal', 'low', 'minimal'
  )),
  
  -- Quality and deliverability
  bounce_count INTEGER DEFAULT 0,
  last_bounce_at TIMESTAMPTZ,
  delivery_status TEXT DEFAULT 'active' CHECK (delivery_status IN (
    'active', 'bouncing', 'blocked', 'invalid'
  )),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_channel_identifier CHECK (
    LENGTH(TRIM(channel_identifier)) > 0 AND LENGTH(channel_identifier) <= 255
  ),
  CONSTRAINT valid_display_label CHECK (
    display_label IS NULL OR LENGTH(display_label) <= 100
  ),
  CONSTRAINT marketing_consent_consistency CHECK (
    (marketing_consent = TRUE AND marketing_consent_date IS NOT NULL) OR
    (marketing_consent = FALSE)
  ),
  CONSTRAINT verification_token_consistency CHECK (
    (verification_status = 'pending' AND verification_token IS NOT NULL) OR
    (verification_status != 'pending')
  ),
  CONSTRAINT bounce_count_valid CHECK (bounce_count >= 0),
  CONSTRAINT preferred_time_valid CHECK (
    (preferred_time_start IS NULL AND preferred_time_end IS NULL) OR
    (preferred_time_start IS NOT NULL AND preferred_time_end IS NOT NULL)
  )
);

-- Unique constraint to prevent duplicate primary channels per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_primary_channel 
  ON contact_communication_channels(contact_id, channel_type) 
  WHERE is_primary = TRUE;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_channels_contact_id ON contact_communication_channels(contact_id);
CREATE INDEX IF NOT EXISTS idx_channels_user_id ON contact_communication_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_channels_type ON contact_communication_channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_channels_identifier ON contact_communication_channels(channel_identifier);
CREATE INDEX IF NOT EXISTS idx_channels_verification ON contact_communication_channels(verification_status);
CREATE INDEX IF NOT EXISTS idx_channels_delivery ON contact_communication_channels(delivery_status);
CREATE INDEX IF NOT EXISTS idx_channels_updated_at ON contact_communication_channels(updated_at);

-- Partial indexes for active and verified channels
CREATE INDEX IF NOT EXISTS idx_channels_active ON contact_communication_channels(contact_id, channel_type) 
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_channels_verified ON contact_communication_channels(contact_id, channel_type) 
  WHERE is_verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_channels_primary ON contact_communication_channels(contact_id) 
  WHERE is_primary = TRUE;

-- Index for marketing consent queries
CREATE INDEX IF NOT EXISTS idx_channels_marketing ON contact_communication_channels(user_id, channel_type) 
  WHERE marketing_consent = TRUE AND is_active = TRUE;

-- Index for verification token lookups
CREATE INDEX IF NOT EXISTS idx_channels_verification_token ON contact_communication_channels(verification_token) 
  WHERE verification_token IS NOT NULL;

-- JSONB indexes for metadata searches
CREATE INDEX IF NOT EXISTS idx_channels_metadata ON contact_communication_channels USING GIN(channel_metadata);
CREATE INDEX IF NOT EXISTS idx_channels_integration ON contact_communication_channels USING GIN(integration_data);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_channels_updated_at
  BEFORE UPDATE ON contact_communication_channels
  FOR EACH ROW
  EXECUTE FUNCTION update_channels_updated_at();

-- Function to validate email addresses
CREATE OR REPLACE FUNCTION validate_email_address(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate phone numbers (basic validation)
CREATE OR REPLACE FUNCTION validate_phone_number(phone TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Remove common formatting characters
  phone := regexp_replace(phone, '[^\d+]', '', 'g');
  -- Check if it's a reasonable phone number (7-15 digits, optionally starting with +)
  RETURN phone ~ '^\+?[1-9]\d{6,14}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to format phone numbers consistently
CREATE OR REPLACE FUNCTION format_phone_number(phone TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Remove all non-digit characters except +
  phone := regexp_replace(phone, '[^\d+]', '', 'g');
  
  -- Basic formatting - can be enhanced based on requirements
  IF phone ~ '^\+1[0-9]{10}$' THEN
    -- US/Canada format: +1 (XXX) XXX-XXXX
    RETURN '+1 (' || substring(phone, 3, 3) || ') ' || 
           substring(phone, 6, 3) || '-' || substring(phone, 9, 4);
  ELSIF phone ~ '^1[0-9]{10}$' THEN
    -- US/Canada without + prefix
    RETURN '+1 (' || substring(phone, 2, 3) || ') ' || 
           substring(phone, 5, 3) || '-' || substring(phone, 8, 4);
  ELSE
    -- International format - keep as is with + prefix
    RETURN CASE WHEN phone ~ '^\+' THEN phone ELSE '+' || phone END;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to validate and format channel identifiers
CREATE OR REPLACE FUNCTION validate_channel_identifier()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate based on channel type
  CASE NEW.channel_type
    WHEN 'email' THEN
      IF NOT validate_email_address(NEW.channel_identifier) THEN
        RAISE EXCEPTION 'Invalid email address format: %', NEW.channel_identifier;
      END IF;
    WHEN 'phone', 'mobile', 'sms' THEN
      IF NOT validate_phone_number(NEW.channel_identifier) THEN
        RAISE EXCEPTION 'Invalid phone number format: %', NEW.channel_identifier;
      END IF;
      -- Format phone number consistently
      NEW.channel_identifier := format_phone_number(NEW.channel_identifier);
    WHEN 'whatsapp' THEN
      -- WhatsApp uses phone numbers
      IF NOT validate_phone_number(NEW.channel_identifier) THEN
        RAISE EXCEPTION 'Invalid WhatsApp phone number format: %', NEW.channel_identifier;
      END IF;
      NEW.channel_identifier := format_phone_number(NEW.channel_identifier);
  END CASE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_channel_identifier
  BEFORE INSERT OR UPDATE ON contact_communication_channels
  FOR EACH ROW
  EXECUTE FUNCTION validate_channel_identifier();

-- Add table comments
COMMENT ON TABLE contact_communication_channels IS 'Communication channels for contacts with verification and consent management';
COMMENT ON COLUMN contact_communication_channels.channel_type IS 'Type of communication channel (email, phone, social media, etc.)';
COMMENT ON COLUMN contact_communication_channels.channel_identifier IS 'The actual contact value (email address, phone number, username)';
COMMENT ON COLUMN contact_communication_channels.verification_status IS 'Status of channel verification for deliverability';
COMMENT ON COLUMN contact_communication_channels.marketing_consent IS 'Explicit consent for marketing communications';
COMMENT ON COLUMN contact_communication_channels.channel_metadata IS 'Channel-specific metadata and configuration';
COMMENT ON COLUMN contact_communication_channels.bounce_count IS 'Number of delivery failures for this channel';

-- Create channel statistics view for analytics
CREATE OR REPLACE VIEW contact_channel_stats AS
SELECT 
  user_id,
  channel_type,
  COUNT(*) as total_channels,
  COUNT(*) FILTER (WHERE is_active = TRUE) as active_channels,
  COUNT(*) FILTER (WHERE is_verified = TRUE) as verified_channels,
  COUNT(*) FILTER (WHERE marketing_consent = TRUE) as marketing_consented,
  COUNT(*) FILTER (WHERE bounce_count > 0) as bounced_channels,
  AVG(bounce_count) as avg_bounce_count
FROM contact_communication_channels
GROUP BY user_id, channel_type;

COMMENT ON VIEW contact_channel_stats IS 'Statistics view for contact communication channels by user and type';
