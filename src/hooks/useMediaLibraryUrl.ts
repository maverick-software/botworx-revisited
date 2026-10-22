import { useState, useEffect } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';

/**
 * Hook to resolve media library references to signed URLs
 * Handles both direct URLs and media-library: references
 * 
 * @param mediaReference - Either a direct URL or "media-library:{id}" format
 * @returns Resolved URL or null
 */
export function useMediaLibraryUrl(mediaReference: string | null | undefined): string | null {
  const supabase = useSupabaseClient();
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Reset if no reference provided
    if (!mediaReference) {
      setResolvedUrl(null);
      return;
    }

    // If it's already a direct URL (http/https), return it as-is
    if (mediaReference.startsWith('http://') || mediaReference.startsWith('https://')) {
      setResolvedUrl(mediaReference);
      return;
    }

    // If it's a media library reference, resolve it
    if (mediaReference.startsWith('media-library:')) {
      const mediaId = mediaReference.replace('media-library:', '');
      
      const resolveMediaUrl = async () => {
        setIsLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke('media-library-api', {
            body: {
              action: 'get_signed_url',
              document_id: mediaId,
              expiry_seconds: 3600 // 1 hour
            }
          });

          if (error) {
            console.error('Failed to resolve media library URL:', error);
            setResolvedUrl(null);
            return;
          }

          if (data?.success && data?.data?.signed_url) {
            setResolvedUrl(data.data.signed_url);
          } else {
            console.error('Media library API returned no URL:', data);
            setResolvedUrl(null);
          }
        } catch (err) {
          console.error('Error resolving media library URL:', err);
          setResolvedUrl(null);
        } finally {
          setIsLoading(false);
        }
      };

      resolveMediaUrl();
    } else {
      // Unknown format, return as-is
      setResolvedUrl(mediaReference);
    }
  }, [mediaReference, supabase]);

  return resolvedUrl;
}

