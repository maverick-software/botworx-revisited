-- Original document bytes live beside their registry rows, so an ordinary
-- database recovery preserves them without depending on the upload location.
CREATE TABLE public.desktop_media_files (
 media_id uuid PRIMARY KEY REFERENCES public.media_library(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 bytes bytea NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 20971520),
 sha256 text GENERATED ALWAYS AS (encode(sha256(bytes),'hex')) STORED
);
ALTER TABLE public.desktop_media_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.desktop_media_files FROM anon,authenticated;
GRANT ALL ON public.desktop_media_files TO service_role;

CREATE FUNCTION public.desktop_import_agent_document(p_user uuid,p_agent uuid,p_id uuid,p_value jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE original bytea; filename text; extension text; extracted text;
BEGIN
 PERFORM 1 FROM agents WHERE id=p_agent AND user_id=p_user AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Agent not found.'; END IF;
 PERFORM 1 FROM auth.users WHERE id=p_user FOR UPDATE;
 IF (SELECT count(*) FROM media_library WHERE user_id=p_user AND NOT is_archived)>=200 THEN
  RAISE EXCEPTION 'The document library supports up to 200 active documents.';
 END IF;
 filename=p_value->>'name'; extension=p_value->>'extension'; extracted=p_value->>'text';
 IF filename IS NULL OR length(filename) NOT BETWEEN 1 AND 255 OR filename~'[\\/]' OR
    extension NOT IN ('.txt','.md','.markdown','.csv','.json','.html','.pdf','.docx','.xlsx','.pptx') OR
    extracted IS NULL OR length(extracted)>2097152 OR
    p_value->>'base64' IS NULL OR length(p_value->>'base64')>27962028 THEN
  RAISE EXCEPTION 'Invalid document upload.';
 END IF;
 original=decode(p_value->>'base64','base64');
 IF octet_length(original) NOT BETWEEN 1 AND 20971520 OR
    encode(sha256(original),'hex') IS DISTINCT FROM p_value->>'sha256' THEN
  RAISE EXCEPTION 'The document upload is incomplete or changed.';
 END IF;
 IF coalesce((SELECT sum(octet_length(bytes)) FROM desktop_media_files WHERE user_id=p_user),0)+octet_length(original)>268435456 THEN
  RAISE EXCEPTION 'The document library has reached its 256 MB storage limit.';
 END IF;
 INSERT INTO media_library(id,user_id,file_name,display_name,file_type,file_size,file_extension,
  storage_bucket,storage_path,processing_status,text_content,processed_at,metadata)
 VALUES(p_id,p_user,filename,filename,p_value->>'mime',octet_length(original),extension,
  'agentopia-desktop-database',p_user::text||'/'||p_id::text,'completed',extracted,now(),
  jsonb_build_object('desktopDocument',jsonb_build_object('format',1,'sha256',p_value->>'sha256',
   'truncated',coalesce((p_value->>'truncated')::boolean,false),'notice',left(p_value->>'notice',4000))));
 INSERT INTO desktop_media_files(media_id,user_id,bytes) VALUES(p_id,p_user,original);
 RETURN p_id;
END $$;

CREATE FUNCTION public.desktop_agent_document_catalog(p_user uuid,p_agent uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM agents WHERE id=p_agent AND user_id=p_user AND active) THEN RAISE EXCEPTION 'Agent not found.'; END IF;
 IF (SELECT count(*) FROM agent_media_assignments WHERE agent_id=p_agent AND user_id=p_user AND is_active)>200 THEN
  RAISE EXCEPTION 'Choose at most 200 documents for this agent.';
 END IF;
 RETURN coalesce((SELECT jsonb_agg(row ORDER BY row.id) FROM (
  SELECT m.id,coalesce(m.display_name,m.file_name) name,m.file_extension extension,m.file_size bytes,
   m.processing_status status,m.version,m.text_content IS NOT NULL AS readable,
   encode(sha256(convert_to(coalesce(m.text_content,''),'UTF8')),'hex') text_sha256,
   m.metadata->'desktopDocument' extraction,f.sha256 original_sha256
  FROM agent_media_assignments a JOIN media_library m ON m.id=a.media_id AND m.user_id=p_user
  LEFT JOIN desktop_media_files f ON f.media_id=m.id AND f.user_id=p_user
  WHERE a.agent_id=p_agent AND a.user_id=p_user AND a.is_active AND NOT m.is_archived
 ) row),'[]');
END $$;

CREATE FUNCTION public.desktop_read_agent_document(p_user uuid,p_agent uuid,p_id uuid,p_original boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM agents WHERE id=p_agent AND user_id=p_user AND active) THEN RAISE EXCEPTION 'Agent not found.'; END IF;
 SELECT jsonb_build_object('id',m.id,'name',coalesce(m.display_name,m.file_name),'extension',m.file_extension,
  'text',m.text_content,'status',m.processing_status,'extraction',m.metadata->'desktopDocument',
  'base64',CASE WHEN p_original THEN encode(f.bytes,'base64') END,'sha256',f.sha256)
 INTO result FROM agent_media_assignments a
 JOIN media_library m ON m.id=a.media_id AND m.user_id=p_user
 LEFT JOIN desktop_media_files f ON f.media_id=m.id AND f.user_id=p_user
 WHERE a.agent_id=p_agent AND a.user_id=p_user AND a.media_id=p_id AND a.is_active AND NOT m.is_archived;
 IF result IS NULL THEN RAISE EXCEPTION 'This document is no longer assigned to this agent.'; END IF;
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.desktop_import_agent_document(uuid,uuid,uuid,jsonb),
 public.desktop_agent_document_catalog(uuid,uuid),public.desktop_read_agent_document(uuid,uuid,uuid,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_import_agent_document(uuid,uuid,uuid,jsonb),
 public.desktop_agent_document_catalog(uuid,uuid),public.desktop_read_agent_document(uuid,uuid,uuid,boolean)
 TO service_role;
