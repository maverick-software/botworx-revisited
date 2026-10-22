SELECT decrypted_secret = 'agentopia-encryption-migration-proof' AS migrated_ciphertext_decrypts
FROM vault.decrypted_secrets WHERE name='agentopia-desktop-migration-proof';
DELETE FROM vault.secrets WHERE name='agentopia-desktop-migration-proof';
