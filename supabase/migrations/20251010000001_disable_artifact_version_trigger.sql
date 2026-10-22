-- Disable the automatic artifact versioning trigger
-- We now handle versioning manually in the artifacts-mcp Edge Function
-- to avoid issues with service role context where auth.uid() is NULL

DROP TRIGGER IF EXISTS artifact_version_trigger ON artifacts;
DROP FUNCTION IF EXISTS create_artifact_version_on_update();

