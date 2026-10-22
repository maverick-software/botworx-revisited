-- Enable pg_trgm extension for similarity function
-- Required for media library document search functionality

-- Enable the pg_trgm extension which provides the similarity() function
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verify the extension is enabled
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        RAISE NOTICE '✅ pg_trgm extension enabled successfully';
        RAISE NOTICE 'The similarity() function is now available for document search';
    ELSE
        RAISE WARNING '⚠️ Failed to enable pg_trgm extension';
    END IF;
END $$;

-- Test the similarity function to ensure it works
DO $$
DECLARE
    test_similarity FLOAT;
BEGIN
    -- Test the similarity function with sample text
    SELECT similarity('test document', 'test content') INTO test_similarity;
    RAISE NOTICE 'similarity() function test result: %', test_similarity;
    RAISE NOTICE 'Media library document search should now work properly';
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error testing similarity function: %', SQLERRM;
END $$;
