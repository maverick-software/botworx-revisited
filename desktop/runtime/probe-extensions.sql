SELECT version();
SELECT name, default_version, installed_version
FROM pg_available_extensions
WHERE name IN ('pgcrypto', 'pgsodium', 'supabase_vault', 'vector', 'pg_cron')
ORDER BY name;

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgsodium;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT extname, extversion FROM pg_extension
WHERE extname IN ('pgcrypto', 'pgsodium', 'supabase_vault', 'vector', 'pg_cron')
ORDER BY extname;
SELECT length(extensions.digest('sylvana-runtime-probe', 'sha256')) AS digest_bytes;
SELECT extensions.vector_dims('[1,2,3]'::extensions.vector) AS vector_dimensions;
SELECT pgsodium.crypto_aead_det_keygen() IS NOT NULL AS sodium_key_generation;
SELECT (pgsodium.create_key()).id IS NOT NULL AS sodium_managed_key;
SELECT vault.create_secret('disposable-runtime-proof', 'sylvana-runtime-proof') IS NOT NULL AS vault_secret_created;
SELECT decrypted_secret = 'disposable-runtime-proof' AS vault_decryption
FROM vault.decrypted_secrets WHERE name = 'sylvana-runtime-proof';
ROLLBACK;
