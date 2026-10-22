-- Enable the pgsodium extension for encryption
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Enable the supabase_vault extension
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- Grant necessary permissions
GRANT ALL ON SCHEMA vault TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA vault TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA vault TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA vault TO postgres, service_role; 