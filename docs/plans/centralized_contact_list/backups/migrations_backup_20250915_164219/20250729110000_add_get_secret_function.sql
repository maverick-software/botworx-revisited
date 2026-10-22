CREATE OR REPLACE FUNCTION public.get_secret(secret_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  decrypted_secret text;
BEGIN
  SELECT decrypted_secret INTO decrypted_secret
  FROM vault.decrypted_secrets
  WHERE id = secret_id;

  RETURN decrypted_secret;
END;
$$; 