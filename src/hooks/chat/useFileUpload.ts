import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

interface AttachedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadStatus: 'uploading' | 'completed' | 'error';
}

export function useFileUpload(user: any, agent: any) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [attachedDocuments, setAttachedDocuments] = useState<AttachedDocument[]>([]);

  const handleFileUpload = useCallback(async (files: FileList) => {
    if (!user || !agent) return;

    try {
      setUploading(true);
      const uploadedFiles: string[] = [];
      const uploadType = files[0].type.startsWith('image/') ? 'image' : 'document';

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = `${Date.now()}_${file.name}`;

        setAttachedDocuments(prev => [...prev, {
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          uploadStatus: 'uploading'
        }]);

        const filePath = `${user.id}/${agent.id}/${fileId}_${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          setAttachedDocuments(prev => prev.map(doc =>
            doc.id === fileId ? { ...doc, uploadStatus: 'error' as const } : doc
          ));
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        const { error: dbError } = await supabase
          .from('agent_media_library')
          .insert({
            agent_id: agent.id,
            user_id: user.id,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            public_url: publicUrl,
            media_type: uploadType,
            uploaded_at: new Date().toISOString()
          });

        if (dbError) {
          console.error('Database insert error:', dbError);
          setAttachedDocuments(prev => prev.map(doc =>
            doc.id === fileId ? { ...doc, uploadStatus: 'error' as const } : doc
          ));
          continue;
        }

        uploadedFiles.push(file.name);
        setAttachedDocuments(prev => prev.map(doc =>
          doc.id === fileId ? { ...doc, uploadStatus: 'completed' as const } : doc
        ));

        setTimeout(() => {
          setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileId];
            return newProgress;
          });
        }, 2000);
      }

      if (uploadedFiles.length > 0) {
        toast.success(`Successfully uploaded ${uploadedFiles.length} file(s)`);
      }

    } catch (error: any) {
      console.error('Upload process error:', error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }, [user, agent]);

  const handleRemoveAttachment = useCallback((docId: string) => {
    setAttachedDocuments(prev => prev.filter(doc => doc.id !== docId));
  }, []);

  return {
    uploading,
    uploadProgress,
    attachedDocuments,
    setAttachedDocuments,
    handleFileUpload,
    handleRemoveAttachment,
  };
}

