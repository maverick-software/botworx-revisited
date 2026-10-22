-- Fix Agent Classifications for Communication Integrations
-- Gmail and Email Relay should be classified as 'channel' not 'tool'
-- Tools are things like web search, data processing, etc.
-- Channels are communication methods like email, chat, etc.

-- Update Gmail to be classified as a channel
UPDATE integrations 
SET 
  agent_classification = 'channel',
  updated_at = NOW()
WHERE name = 'Gmail' 
  AND (agent_classification != 'channel' OR agent_classification IS NULL);

-- Update Email Relay to be classified as a channel  
UPDATE integrations 
SET 
  agent_classification = 'channel',
  updated_at = NOW()
WHERE name = 'Email Relay'
  AND (agent_classification != 'channel' OR agent_classification IS NULL);

-- Update SMTP (if it exists separately) to be classified as a channel
UPDATE integrations 
SET 
  agent_classification = 'channel',
  updated_at = NOW()
WHERE name IN ('SMTP', 'Email', 'SendGrid', 'Mailgun')
  AND (agent_classification != 'channel' OR agent_classification IS NULL);

-- Update Discord to be classified as a channel (communication)
UPDATE integrations 
SET 
  agent_classification = 'channel',
  updated_at = NOW()
WHERE name = 'Discord'
  AND (agent_classification != 'channel' OR agent_classification IS NULL);

-- Update Slack to be classified as a channel (communication)
UPDATE integrations 
SET 
  agent_classification = 'channel',
  updated_at = NOW()
WHERE name = 'Slack'
  AND (agent_classification != 'channel' OR agent_classification IS NULL);

-- Ensure tool integrations are properly classified as 'tool'
UPDATE integrations 
SET 
  agent_classification = 'tool',
  updated_at = NOW()
WHERE name IN (
  'Web Search',
  'Serper API',
  'SerpAPI', 
  'Brave Search API',
  'Pinecone',
  'GetZep',
  'DigitalOcean',
  'Zapier',
  'Webhooks'
)
AND (agent_classification != 'tool' OR agent_classification IS NULL);

-- Log the changes
DO $$
DECLARE
  channel_count INTEGER;
  tool_count INTEGER;
BEGIN
  -- Count channels
  SELECT COUNT(*) INTO channel_count 
  FROM integrations 
  WHERE agent_classification = 'channel';
  
  -- Count tools
  SELECT COUNT(*) INTO tool_count 
  FROM integrations 
  WHERE agent_classification = 'tool';
  
  RAISE NOTICE 'Agent classifications updated:';
  RAISE NOTICE '  Channels: % integrations', channel_count;
  RAISE NOTICE '  Tools: % integrations', tool_count;
  RAISE NOTICE 'Gmail and Email Relay should now appear in the Channels modal';
  RAISE NOTICE 'Web Search and other utilities should appear in the Tools modal';
END $$;
