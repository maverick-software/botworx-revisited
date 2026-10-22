import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Refreshes an agent's avatar URL if it's expired or invalid
 * @param supabase - Supabase client
 * @param agentId - Agent ID
 * @param currentAvatarUrl - Current avatar URL (may be expired)
 * @returns Fresh avatar URL or null if no avatar exists
 */
export async function refreshAgentAvatarUrl(
  supabase: SupabaseClient,
  agentId: string,
  currentAvatarUrl?: string | null
): Promise<string | null> {
  try {
    // If no current avatar URL, return null
    if (!currentAvatarUrl) {
      return null;
    }

    // Check if the current URL is still valid by testing if it loads
    try {
      const response = await fetch(currentAvatarUrl, { method: 'HEAD' });
      if (response.ok) {
        // URL is still valid, return it
        return currentAvatarUrl;
      }
    } catch (error) {
      console.warn('Avatar URL test failed, attempting refresh:', error);
    }

    // URL is invalid/expired, try to get a fresh signed URL
    // First, find the avatar in the media library via the API
    const session = await supabase.auth.getSession();
    if (!session.data.session?.access_token) {
      console.warn('No auth session available for avatar refresh');
      return null;
    }

    // Search for avatar files via the media-library-api
    const searchResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'list_documents',
        category: 'avatars',
        sort_by: 'created_at',
        sort_order: 'desc'
      })
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.warn('Failed to search for avatar:', searchResponse.status, errorText);
      return null;
    }

    const searchData = await searchResponse.json();
    const allAvatars = searchData.data?.documents || searchData.data;

    if (!allAvatars || allAvatars.length === 0) {
      console.warn('No avatars found in media library');
      return null;
    }

    // Filter avatars to find one for this specific agent
    const agentAvatar = allAvatars.find((avatar: any) => 
      avatar.description?.includes(agentId) || 
      avatar.file_name?.includes(`avatar-${agentId}`) ||
      avatar.display_name?.includes(agentId)
    );

    if (!agentAvatar) {
      console.warn('No avatar found in media library for agent:', agentId);
      return null;
    }

    const mediaFile = agentAvatar;

    // Get a fresh signed URL via the media-library-api

    const urlResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'get_signed_url',
        document_id: mediaFile.id,
        expiry_seconds: 31536000 // 1 year for avatars
      })
    });

    if (!urlResponse.ok) {
      const errorText = await urlResponse.text();
      console.warn('Failed to refresh avatar URL:', urlResponse.status, errorText);
      return null;
    }

    const urlData = await urlResponse.json();
    console.log('Avatar refresh response:', urlData);
    const freshUrl = urlData.data?.signed_url;

    if (freshUrl) {
      // Update the agent record with the fresh URL
      const { error: updateError } = await supabase
        .from('agents')
        .update({ avatar_url: freshUrl })
        .eq('id', agentId);

      if (updateError) {
        console.warn('Failed to update agent avatar URL:', updateError);
      } else {
        console.log('Avatar URL refreshed successfully for agent:', agentId);
      }

      return freshUrl;
    }

    return null;
  } catch (error) {
    console.error('Error refreshing avatar URL:', error);
    return null;
  }
}

/**
 * Preloads an avatar image and returns a promise that resolves when loaded
 * @param url - Avatar URL to preload
 * @returns Promise that resolves with the URL if successful, null if failed
 */
export function preloadAvatarImage(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
