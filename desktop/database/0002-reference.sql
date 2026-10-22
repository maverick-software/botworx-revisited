-- Seed script for integrations data
-- This populates the integration_categories and integrations tables

-- Insert default integration categories
INSERT INTO integration_categories (name, description, icon_name, display_order) VALUES
    ('API Integrations', 'Connect to external APIs and services', 'Globe', 1),
    ('Database Connectors', 'Connect to various database systems', 'Database', 2),
    ('Authentication', 'Secure authentication and authorization', 'Shield', 3),
    ('Messaging & Communication', 'Communication and messaging platforms', 'MessageSquare', 4),
    ('Cloud Services', 'Cloud platforms and services', 'Cloud', 5),
    ('Automation & Workflows', 'Workflow automation and triggers', 'Zap', 6)
ON CONFLICT (name) DO NOTHING;


