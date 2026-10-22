import { SupabaseClient } from '@supabase/supabase-js';

// Define the expected response structure from the Supabase Function
interface GenerateAgentAvatarResponse {
  mediaLibraryId?: string;
  storagePath?: string;
  fileName?: string;
  error?: string;
}

/**
 * Invokes the Supabase Edge Function to generate an agent avatar using OpenAI.
 *
 * @param supabase The Supabase client instance.
 * @param agentId The ID of the agent for whom to generate the avatar.
 * @param prompt The text prompt for image generation.
 * @returns An object containing the media library ID, storage path, and filename.
 */
export async function generateAgentAvatar(
  supabase: SupabaseClient,
  agentId: string,
  prompt: string
): Promise<GenerateAgentAvatarResponse> {
  const { data, error } = await supabase.functions.invoke<GenerateAgentAvatarResponse>(
    'generate-agent-image',
    {
      body: { agentId, prompt },
    }
  );

  if (error) {
    console.error('Supabase function invocation error:', error);
    // Try to parse a specific error message if the function returned one
    if (data?.error) {
        throw new Error(`Generation failed: ${data.error}`);
    }
    throw new Error(`Failed to invoke generation function: ${error.message}`);
  }

  if (data?.error) {
     console.error('Supabase function returned error:', data.error);
     throw new Error(`Generation failed: ${data.error}`);
  }

  if (!data?.mediaLibraryId) {
      console.error('Supabase function did not return media library ID:', data);
      throw new Error('Generation function did not return a valid media library ID.');
  }

  return { 
    mediaLibraryId: data.mediaLibraryId,
    storagePath: data.storagePath,
    fileName: data.fileName
  };
} 