-- Migration: 20250720140000_fix_function_comments.sql
-- Purpose: Fix non-unique function name error by specifying full function signatures in comments.

COMMENT ON FUNCTION public.store_oauth_token(
    UUID, TEXT, TEXT, TEXT, INTEGER, JSONB
) IS 'Securely store OAuth tokens, calculating expiry inside the DB';

COMMENT ON FUNCTION public.update_oauth_token(
    UUID, TEXT, TEXT, TEXT, INTEGER
) IS 'Update OAuth tokens, calculating expiry inside the DB'; 