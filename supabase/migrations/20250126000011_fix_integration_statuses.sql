-- Fix integration statuses in database to match actual availability
-- This removes the need for hardcoded frontend overrides

-- Set integrations that are actually available to 'available'
UPDATE integrations 
SET status = 'available', updated_at = NOW()
WHERE name IN (
    'Gmail',
    'SendGrid', 
    'Mailgun',
    'SMTP',
    'Web Search',
    'Pinecone',
    'GetZep',
    'Discord',
    'DigitalOcean',
    'Slack',
    'Zapier',
    'Webhooks',
    'Email'
) 
AND status != 'available';

-- Set deprecated integrations (legacy web search providers)
UPDATE integrations 
SET status = 'deprecated', updated_at = NOW()
WHERE name IN (
    'Serper API',
    'SerpAPI', 
    'Brave Search API'
)
AND status != 'deprecated';

-- Log what was updated
DO $$
BEGIN
    RAISE NOTICE 'Integration statuses updated to match actual availability';
    RAISE NOTICE 'Frontend should now use database status directly without hardcoded overrides';
END $$;
