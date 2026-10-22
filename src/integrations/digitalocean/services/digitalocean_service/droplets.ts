import { getDOClient, type DotsApiClient } from './client.ts';
import type {
  // DigitalOceanDroplet, // Using Droplet type from dots-wrapper directly
  CreateDropletServiceOptions,
  // CreateDropletServiceResponse, // We might return the raw Droplet object from dots-wrapper directly
} from './types.ts';
// Use local type definitions to avoid ESM import issues
interface Droplet {
  id: number;
  name: string;
  memory: number;
  vcpus: number;
  disk: number;
  status: string;
  region: any;
  size: any;
  image: any;
  networks: any;
  created_at: string;
  tags: string[];
  // Add other fields as needed
}

interface CreateDropletsRequest {
  names: string[];
  region: string;
  size: string;
  image: string;
  ssh_keys?: (string | number)[];
  backups?: boolean;
  ipv6?: boolean;
  user_data?: string;
  monitoring?: boolean;
  tags?: string[];
  vpc_uuid?: string;
  with_droplet_agent?: boolean;
}

interface Action {
  id: number;
  status: string;
  type: string;
  started_at: string;
  completed_at: string | null;
  resource_id: number;
  resource_type: string;
  region: any;
}
import { callWithRetry } from './utils.ts';
import {
  DigitalOceanServiceError, // Import base error if needed for specific catches
  // Potentially import other specific errors if needed directly here
} from './errors.ts';

/**
 * Creates a new DigitalOcean Droplet.
 * @param options - Configuration options for the new droplet.
 * @returns {Promise<Droplet>} The created droplet object from DigitalOcean.
 * @throws {Error} If droplet creation fails.
 */
export async function createDigitalOceanDroplet(
  options: CreateDropletServiceOptions
): Promise<Droplet> {
  const createRequest: CreateDropletsRequest = {
    names: [options.name], // Fixed: Use names array instead of name string
    region: options.region,
    size: options.size,
    image: options.image,
    ssh_keys: options.ssh_keys,
    backups: options.backups,
    ipv6: options.ipv6,
    user_data: options.user_data,
    monitoring: options.monitoring,
    tags: options.tags,
    vpc_uuid: options.vpc_uuid,
    with_droplet_agent: options.with_droplet_agent,
  };

  // Wrap the API call with retry logic
  const response = await callWithRetry(async () => {
    const doClient = await getDOClient();
    // Using createDroplets which expects names as an array
    return doClient.droplet.createDroplets(createRequest);
  });

  // Updated response parsing logic - createDroplets returns array of droplets
  // Handle response.data.droplets structure (wrapped response)
  if (response?.data?.droplets && Array.isArray(response.data.droplets) && response.data.droplets.length > 0) {
    return response.data.droplets[0] as Droplet;
  }
  // Handle direct response.droplets structure
  if (Array.isArray(response.droplets) && response.droplets.length > 0) {
    return response.droplets[0] as Droplet;
  }
  // Handle single droplet response structures
  if (response?.data?.droplet) {
      return response.data.droplet as Droplet;
  }
  if (response.droplet) {
      return response.droplet as Droplet;
  }
  console.error("Unexpected response structure from createDroplets:", response);
  // Throw specific error if parsing fails after successful call
  throw new DigitalOceanServiceError('Failed to parse create droplet response: Unexpected API response format.');
}

/**
 * Retrieves details for a specific DigitalOcean Droplet.
 * @param dropletId - The ID of the droplet to retrieve.
 * @returns {Promise<Droplet>} The droplet object.
 * @throws {Error} If retrieval fails.
 */
export async function getDigitalOceanDroplet(dropletId: number): Promise<Droplet> {
  const response = await callWithRetry(async () => {
    const doClient = await getDOClient();
    return doClient.droplet.getDroplet({ droplet_id: dropletId });
  });

  // Handle wrapped response structure
  if (response?.data?.droplet) {
     return response.data.droplet as Droplet;
  }
  // Handle direct response structure
  if (response?.droplet) {
     return response.droplet as Droplet;
  }
  throw new DigitalOceanServiceError('Failed to parse get droplet response: Unexpected API response format.');
}

/**
 * Deletes a specific DigitalOcean Droplet.
 * @param dropletId - The ID of the droplet to delete.
 * @returns {Promise<void>} A promise that resolves when deletion is initiated.
 * @throws {Error} If deletion fails.
 */
export async function deleteDigitalOceanDroplet(dropletId: number): Promise<void> {
  // deleteDroplet might return void or an Action object depending on API/wrapper.
  // callWithRetry handles errors. If it completes successfully, assume initiated.
  await callWithRetry(async () => {
    const doClient = await getDOClient();
    // If deleteDroplet returns something (like an action), it will be ignored here.
    // Consider logging the response if needed.
    await doClient.droplet.deleteDroplet({ droplet_id: dropletId });
  });
  console.info(`Deletion initiated via API for DigitalOcean droplet ID '${dropletId}'.`);
}

/**
 * Lists DigitalOcean Droplets by a specific tag.
 * @param tagName - The tag to filter droplets by.
 * @returns {Promise<Droplet[]>} An array of droplet objects.
 * @throws {Error} If listing fails.
 */
export async function listDigitalOceanDropletsByTag(tagName: string): Promise<Droplet[]> {
  const response = await callWithRetry(async () => {
    const doClient = await getDOClient();
    return doClient.droplet.listDroplets({ tag_name: tagName });
  });

  // Handle wrapped response structure
  if (response?.data?.droplets) {
      return response.data.droplets as Droplet[]; 
  }
  // Handle direct response structure
  if (response?.droplets) {
      return response.droplets as Droplet[]; 
  }
  throw new DigitalOceanServiceError('Failed to parse list droplets response: Unexpected API response format.');
}

/**
 * Resizes a DigitalOcean Droplet.
 * This action initiates a resize. For non-SSD droplets, this involves a power-cycle.
 * For SSD droplets, this is usually a live resize for CPU/RAM, but disk resizes require a power-cycle.
 * This function will initiate the action. Monitoring the action's completion would be separate.
 * @param dropletId - The ID of the droplet to resize.
 * @param newSizeSlug - The new size slug for the droplet.
 * @returns {Promise<Action>} The action object from DigitalOcean.
 * @throws {Error} If initiating the resize action fails.
 */
export async function resizeDigitalOceanDroplet(
  dropletId: number,
  newSizeSlug: string
): Promise<Action> {
  const response = await callWithRetry(async () => {
    const doClient = await getDOClient();
    // Assuming the method is directly on droplet and it returns an object with an action property
    return doClient.droplet.resizeDroplet({
      droplet_id: dropletId,
      size: newSizeSlug,
    });
  });

  // Handle wrapped response structure
  if (response?.data?.action) {
    return response.data.action as Action;
  }
  // Handle direct response structure
  if (response?.action) {
    return response.action as Action;
  }
  // Fallback if the response itself is the Action object (less common for this wrapper based on other calls)
  if (response && typeof response.id === 'number' && typeof response.status === 'string') {
    return response as Action;
  }
  throw new DigitalOceanServiceError(
    'Failed to parse resize droplet response: Unexpected API response format.'
  );
} 