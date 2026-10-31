SELECT decrypted_secret = 'sylvana-encryption-migration-proof' AS migrated_ciphertext_decrypts
FROM vault.decrypted_secrets WHERE name='sylvana-desktop-migration-proof';
DELETE FROM vault.secrets WHERE name='sylvana-desktop-migration-proof';
