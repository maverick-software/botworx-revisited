-- Human library controls retain originals and previous file versions locally.
CREATE TABLE public.desktop_media_revisions (
 media_id uuid NOT NULL REFERENCES public.media_library(id) ON DELETE CASCADE,
 version integer NOT NULL CHECK(version>0),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 document jsonb NOT NULL,
 bytes bytea CHECK(bytes IS NULL OR octet_length(bytes) BETWEEN 1 AND 20971520),
 sha256 text GENERATED ALWAYS AS (encode(sha256(bytes),'hex')) STORED,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(media_id,version)
);
ALTER TABLE public.desktop_media_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.desktop_media_revisions FROM anon,authenticated;
GRANT ALL ON public.desktop_media_revisions TO service_role;

CREATE FUNCTION public.desktop_document_payload_bytes(p_value jsonb)
RETURNS bytea LANGUAGE plpgsql SET search_path=public AS $$
DECLARE original bytea; filename text; extension text; extracted text;
BEGIN
 filename=p_value->>'name'; extension=p_value->>'extension'; extracted=p_value->>'text';
 IF filename IS NULL OR length(filename) NOT BETWEEN 1 AND 255 OR filename~'[\\/]'
  OR extension NOT IN('.txt','.md','.markdown','.csv','.json','.html','.pdf','.docx','.xlsx','.pptx')
  OR extracted IS NULL OR length(extracted)>2097152 OR p_value->>'base64' IS NULL
  OR length(p_value->>'base64')>27962028 THEN RAISE EXCEPTION 'Invalid document upload.'; END IF;
 original=decode(p_value->>'base64','base64');
 IF octet_length(original) NOT BETWEEN 1 AND 20971520 OR encode(sha256(original),'hex') IS DISTINCT FROM p_value->>'sha256'
  THEN RAISE EXCEPTION 'The document upload is incomplete or changed.'; END IF;
 RETURN original;
END $$;

CREATE FUNCTION public.desktop_document_storage_limit(p_user uuid,p_additional bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_additional<0 OR coalesce((SELECT sum(octet_length(bytes)) FROM desktop_media_files WHERE user_id=p_user),0)
  +coalesce((SELECT sum(octet_length(bytes)) FROM desktop_media_revisions WHERE user_id=p_user),0)+p_additional>268435456
  THEN RAISE EXCEPTION 'The library has reached 256 MB of retained originals and file versions. Delete an older version or a permanently archived file to free space.'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.desktop_import_agent_document(p_user uuid,p_agent uuid,p_id uuid,p_value jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE original bytea;
BEGIN
 PERFORM 1 FROM agents WHERE id=p_agent AND user_id=p_user AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Agent not found.'; END IF;
 PERFORM 1 FROM auth.users WHERE id=p_user FOR UPDATE;
 IF (SELECT count(*) FROM media_library WHERE user_id=p_user AND NOT is_archived)>=200
  THEN RAISE EXCEPTION 'The document library supports up to 200 active documents.'; END IF;
 original=desktop_document_payload_bytes(p_value);
 PERFORM desktop_document_storage_limit(p_user,octet_length(original));
 INSERT INTO media_library(id,user_id,file_name,display_name,file_type,file_size,file_extension,
  storage_bucket,storage_path,processing_status,text_content,processed_at,metadata)
 VALUES(p_id,p_user,p_value->>'name',p_value->>'name',p_value->>'mime',octet_length(original),p_value->>'extension',
  'agentopia-desktop-database',p_user::text||'/'||p_id::text,'completed',p_value->>'text',now(),
  jsonb_build_object('desktopDocument',jsonb_build_object('format',1,'sha256',p_value->>'sha256',
   'truncated',coalesce((p_value->>'truncated')::boolean,false),'notice',left(p_value->>'notice',4000))));
 INSERT INTO desktop_media_files(media_id,user_id,bytes) VALUES(p_id,p_user,original);
 RETURN p_id;
END $$;

CREATE FUNCTION public.desktop_save_agent_document_assignments(p_user uuid,p_agent uuid,p_ids jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item uuid;
BEGIN
 PERFORM 1 FROM agents WHERE id=p_agent AND user_id=p_user AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Agent not found.'; END IF;
 PERFORM 1 FROM auth.users WHERE id=p_user FOR UPDATE;
 IF jsonb_typeof(p_ids) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Choose documents from your library.'; END IF;
 IF jsonb_array_length(p_ids)>200 THEN RAISE EXCEPTION 'Choose at most 200 documents.'; END IF;
 FOR item IN SELECT DISTINCT value::uuid FROM jsonb_array_elements_text(p_ids) LOOP
  PERFORM 1 FROM media_library WHERE id=item AND user_id=p_user AND NOT is_archived FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'A selected document was archived, removed or belongs to another account. Refresh the library.'; END IF;
 END LOOP;
 UPDATE agent_media_assignments SET is_active=false WHERE agent_id=p_agent AND user_id=p_user AND is_active;
 INSERT INTO agent_media_assignments(agent_id,media_id,user_id,is_active)
  SELECT p_agent,value::uuid,p_user,true FROM (SELECT DISTINCT value FROM jsonb_array_elements_text(p_ids)) selected
  ON CONFLICT(agent_id,media_id) DO UPDATE SET is_active=true,updated_at=now();
END $$;

-- Keep every existing settings section; route document assignments through the
-- account lock shared by imports, archive, restore and replacement.
ALTER FUNCTION public.desktop_save_agent_settings(uuid,uuid,text,jsonb) RENAME TO desktop_save_agent_settings_v71;
REVOKE ALL ON FUNCTION public.desktop_save_agent_settings_v71(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.desktop_save_agent_settings(p_user uuid,p_agent uuid,p_section text,p_value jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_section='documents' THEN PERFORM desktop_save_agent_document_assignments(p_user,p_agent,p_value->'ids');
 ELSE PERFORM desktop_save_agent_settings_v71(p_user,p_agent,p_section,p_value); END IF;
END $$;

CREATE FUNCTION public.desktop_validate_document_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.is_active THEN
  IF NOT EXISTS(SELECT 1 FROM agents WHERE id=NEW.agent_id AND user_id=NEW.user_id)
   THEN RAISE EXCEPTION 'The document assignment belongs to another account.'; END IF;
  PERFORM 1 FROM media_library WHERE id=NEW.media_id AND user_id=NEW.user_id AND NOT is_archived FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active document in your own library.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER desktop_validate_document_assignment BEFORE INSERT OR UPDATE ON public.agent_media_assignments
 FOR EACH ROW EXECUTE FUNCTION public.desktop_validate_document_assignment();

CREATE FUNCTION public.desktop_update_library_document(p_user uuid,p_agent uuid,p_id uuid,p_expected_version integer,
 p_expected_updated_at timestamptz,p_operation text,p_value jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item media_library; old desktop_media_revisions; original bytea; filename text; extension text;
 mime text; extracted text; extraction jsonb; selected_version integer;
BEGIN
 PERFORM 1 FROM agents WHERE id=p_agent AND user_id=p_user AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Agent not found.'; END IF;
 PERFORM 1 FROM auth.users WHERE id=p_user FOR UPDATE;
 SELECT * INTO item FROM media_library WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.'; END IF;
 IF EXISTS(SELECT 1 FROM desktop_media_files WHERE media_id=p_id AND user_id<>p_user)
  OR EXISTS(SELECT 1 FROM desktop_media_revisions WHERE media_id=p_id AND user_id<>p_user)
  THEN RAISE EXCEPTION 'Stored file ownership does not match this document.'; END IF;
 IF coalesce(item.version,1) IS DISTINCT FROM p_expected_version OR item.updated_at IS DISTINCT FROM p_expected_updated_at
  THEN RAISE EXCEPTION 'This document changed. Refresh the library and review it before trying again.'; END IF;
 IF p_operation='metadata' THEN
  IF length(trim(p_value->>'name')) NOT BETWEEN 1 AND 255 OR p_value->>'name' IS NULL
   OR length(trim(p_value->>'category')) NOT BETWEEN 1 AND 50 OR p_value->>'category' IS NULL
   OR length(p_value->>'description')>4000 OR p_value->>'description' IS NULL
   OR jsonb_typeof(p_value->'tags') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Enter a name, collection and valid tags.'; END IF;
  IF jsonb_array_length(p_value->'tags')>20 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_value->'tags') tag
   WHERE jsonb_typeof(tag)<>'string' OR length(trim(tag#>>'{}')) NOT BETWEEN 1 AND 40)
   THEN RAISE EXCEPTION 'Use at most 20 tags of 1-40 characters.'; END IF;
  UPDATE media_library SET display_name=trim(p_value->>'name'),category=trim(p_value->>'category'),
   description=p_value->>'description',tags=ARRAY(SELECT DISTINCT trim(value) FROM jsonb_array_elements_text(p_value->'tags'))
   WHERE id=p_id;
 ELSIF p_operation='archive' THEN
  UPDATE agent_media_assignments SET is_active=false WHERE media_id=p_id AND user_id=p_user AND is_active;
  UPDATE media_library SET is_archived=true,assigned_agents_count=0 WHERE id=p_id;
 ELSIF p_operation='restore' THEN
  IF NOT item.is_archived THEN RAISE EXCEPTION 'This document is already active.'; END IF;
  IF (SELECT count(*) FROM media_library WHERE user_id=p_user AND NOT is_archived)>=200
   THEN RAISE EXCEPTION 'Archive another document before restoring this one; the active limit is 200.'; END IF;
  UPDATE agent_media_assignments SET is_active=false WHERE media_id=p_id AND user_id=p_user AND is_active;
  UPDATE media_library SET is_archived=false,assigned_agents_count=0 WHERE id=p_id;
 ELSIF p_operation='delete' THEN
  IF NOT item.is_archived OR item.storage_bucket<>'agentopia-desktop-database'
   THEN RAISE EXCEPTION 'Only archived, locally retained library files can be permanently deleted here.'; END IF;
  DELETE FROM media_library WHERE id=p_id;
  RETURN jsonb_build_object('id',p_id,'deleted',true);
 ELSIF p_operation='delete_version' THEN
  selected_version=(p_value->>'version')::integer;
  IF selected_version IS NULL OR selected_version=item.version THEN RAISE EXCEPTION 'Choose a previous file version.'; END IF;
  DELETE FROM desktop_media_revisions WHERE media_id=p_id AND user_id=p_user AND version=selected_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'Previous version not found.'; END IF;
  UPDATE media_library SET updated_at=now() WHERE id=p_id;
 ELSIF p_operation IN('replace','restore_version') THEN
  IF item.is_archived THEN RAISE EXCEPTION 'Restore this document before replacing its file.'; END IF;
  IF (SELECT count(*) FROM desktop_media_revisions WHERE media_id=p_id)>=50
   THEN RAISE EXCEPTION 'Remove a previous version before adding another; the limit is 50 retained versions.'; END IF;
  IF p_operation='replace' THEN
   original=desktop_document_payload_bytes(p_value);filename=p_value->>'name';extension=p_value->>'extension';
   mime=p_value->>'mime';extracted=p_value->>'text';
   extraction=jsonb_build_object('format',1,'sha256',p_value->>'sha256','truncated',coalesce((p_value->>'truncated')::boolean,false),'notice',left(p_value->>'notice',4000));
  ELSE
   SELECT * INTO old FROM desktop_media_revisions WHERE media_id=p_id AND user_id=p_user AND version=(p_value->>'version')::integer;
   IF NOT FOUND OR old.bytes IS NULL THEN RAISE EXCEPTION 'This previous version has no retained original.'; END IF;
   original=old.bytes;filename=old.document->>'file_name';extension=old.document->>'file_extension';
   mime=old.document->>'file_type';extracted=old.document->>'text_content';extraction=old.document->'metadata'->'desktopDocument';
  END IF;
  PERFORM desktop_document_storage_limit(p_user,octet_length(original));
  INSERT INTO desktop_media_revisions(media_id,version,user_id,document,bytes)
   SELECT item.id,coalesce(item.version,1),p_user,to_jsonb(item),(SELECT bytes FROM desktop_media_files WHERE media_id=p_id AND user_id=p_user);
  INSERT INTO desktop_media_files(media_id,user_id,bytes) VALUES(p_id,p_user,original)
   ON CONFLICT(media_id) DO UPDATE SET bytes=excluded.bytes WHERE desktop_media_files.user_id=excluded.user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stored file ownership changed during replacement.'; END IF;
  UPDATE media_library SET file_name=filename,file_extension=extension,file_type=mime,file_size=octet_length(original),
   text_content=extracted,processing_status='completed',processing_error=NULL,processed_at=now(),version=coalesce(version,1)+1,
   storage_bucket='agentopia-desktop-database',storage_path=p_user::text||'/'||p_id::text,
   metadata=coalesce(metadata,'{}')||jsonb_build_object('desktopDocument',extraction) WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Unsupported document operation.';
 END IF;
 SELECT * INTO item FROM media_library WHERE id=p_id;
 RETURN jsonb_build_object('id',item.id,'version',coalesce(item.version,1),'updated_at',item.updated_at,'archived',item.is_archived);
END $$;

CREATE FUNCTION public.desktop_library_document_versions(p_user uuid,p_agent uuid,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM agents WHERE id=p_agent AND user_id=p_user AND active)
  OR NOT EXISTS(SELECT 1 FROM media_library WHERE id=p_id AND user_id=p_user) THEN RAISE EXCEPTION 'Document not found.'; END IF;
 RETURN coalesce((SELECT jsonb_agg(row ORDER BY row.version DESC) FROM (
  SELECT coalesce(m.version,1) AS version,m.file_name,m.file_extension,m.file_size,m.updated_at AS saved_at,true AS current,
   EXISTS(SELECT 1 FROM desktop_media_files f WHERE f.media_id=m.id AND f.user_id=p_user) AS has_original
   FROM media_library m WHERE m.id=p_id AND m.user_id=p_user
  UNION ALL
  SELECT r.version,r.document->>'file_name',r.document->>'file_extension',(r.document->>'file_size')::bigint,
   r.created_at,false,r.bytes IS NOT NULL FROM desktop_media_revisions r WHERE r.media_id=p_id AND r.user_id=p_user
 ) row),'[]');
END $$;

REVOKE ALL ON FUNCTION public.desktop_document_payload_bytes(jsonb),public.desktop_document_storage_limit(uuid,bigint),
 public.desktop_import_agent_document(uuid,uuid,uuid,jsonb),public.desktop_save_agent_document_assignments(uuid,uuid,jsonb),
 public.desktop_save_agent_settings(uuid,uuid,text,jsonb),public.desktop_validate_document_assignment(),
 public.desktop_update_library_document(uuid,uuid,uuid,integer,timestamptz,text,jsonb),
 public.desktop_library_document_versions(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_import_agent_document(uuid,uuid,uuid,jsonb),
 public.desktop_save_agent_settings(uuid,uuid,text,jsonb),public.desktop_save_agent_document_assignments(uuid,uuid,jsonb),
 public.desktop_update_library_document(uuid,uuid,uuid,integer,timestamptz,text,jsonb),
 public.desktop_library_document_versions(uuid,uuid,uuid) TO service_role;
