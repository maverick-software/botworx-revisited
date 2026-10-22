-- Create the get_integration_categories_with_counts RPC function
-- This function returns integration categories with counts of enabled service providers

CREATE OR REPLACE FUNCTION get_integration_categories_with_counts()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  icon_name text,
  display_order integer,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  provider_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ic.id,
    ic.name,
    ic.description,
    ic.icon_name,
    ic.display_order,
    ic.is_active,
    ic.created_at,
    ic.updated_at,
    COALESCE(sp_counts.provider_count, 0) as provider_count
  FROM integration_categories ic
  LEFT JOIN (
    SELECT 
      CASE 
        WHEN sp.name IN ('gmail', 'smtp', 'sendgrid', 'mailgun', 'discord') THEN 'Messaging & Communication'
        WHEN sp.name IN ('serper_api', 'serpapi', 'brave_search', 'ocr_space') THEN 'API Integrations'
        WHEN sp.name IN ('pinecone', 'getzep') THEN 'Database Connectors'
        WHEN sp.name IN ('digitalocean') THEN 'Cloud Services'
        WHEN sp.name IN ('zapier') THEN 'Automation & Workflows'
        WHEN sp.name IN ('microsoft-teams') THEN 'Communication'
        WHEN sp.name IN ('microsoft-outlook') THEN 'Productivity'
        WHEN sp.name IN ('microsoft-onedrive') THEN 'Storage'
        ELSE 'API Integrations'
      END as category_name,
      COUNT(*) as provider_count
    FROM service_providers sp
    WHERE sp.is_enabled = true
    GROUP BY category_name
  ) sp_counts ON ic.name = sp_counts.category_name
  WHERE ic.is_active = true
  ORDER BY ic.display_order, ic.name;
END;
$$;
