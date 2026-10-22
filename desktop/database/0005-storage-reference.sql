-- Non-sensitive bucket definitions from the current installation (zero objects).
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
 ('artifacts','artifacts',false,NULL,NULL),
 ('media-library','media-library',false,52428800,ARRAY[
  'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','text/plain',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/markdown',
  'text/csv','application/json','image/jpeg','image/png','image/gif','image/webp','audio/mpeg','audio/wav','video/mp4','video/webm'
 ]) ON CONFLICT(id) DO NOTHING;
