-- Improve integration descriptions for better uniformity and clarity
-- Purpose: Ensure all integrations have comprehensive 2-3 line descriptions

-- Update short/poor descriptions with more detailed explanations
UPDATE integrations 
SET description = CASE 
    -- Zapier: Improve from "Connect with Zapier workflows"
    WHEN name = 'Zapier' THEN 
        'Automate workflows and connect your favorite apps with Zapier''s powerful integration platform. Create triggers, actions, and seamless data flows between thousands of supported services.'
    
    -- Slack: Improve from "Send messages to Slack channels"
    WHEN name = 'Slack' THEN 
        'Send messages, manage channels, and interact with your Slack workspace. Enable your agents to post updates, respond to messages, and integrate with team communication workflows.'
    
    -- Discord: Improve from "Interact with Discord servers"
    WHEN name = 'Discord' THEN 
        'Connect to Discord servers and channels for community engagement. Send messages, manage server interactions, and enable your agents to participate in Discord communities.'
    
    -- Webhooks: Improve from "Receive real-time notifications"
    WHEN name = 'Webhooks' THEN 
        'Set up real-time HTTP endpoints to receive instant notifications and data from external services. Enable event-driven integrations and automated responses to external triggers.'
    
    -- Keep existing description if not in list
    ELSE description
END,
updated_at = NOW()
WHERE name IN ('Zapier', 'Slack', 'Discord', 'Webhooks')
AND status = 'available';

-- Log what was updated
DO $$
BEGIN
    RAISE NOTICE 'Improved integration descriptions for better UI consistency';
    RAISE NOTICE 'Updated: Zapier, Slack, Discord, Webhooks';
END $$;
