import { getDOClient, type DotsApiClient } from './client.ts';
import type {
  // DigitalOceanDroplet, // Using Droplet type from dots-wrapper directly
  CreateDropletServiceOptions,
  // CreateDropletServiceResponse, // We might return the raw Droplet object from dots-wrapper directly
} from './types.ts';
import { callWithRetry } from './utils.ts';
import {
  DigitalOceanServiceError, // Import base error if needed for specific catches
  // Potentially import other specific errors if needed directly here
} from './errors.ts';

// Local type definitions to avoid external import linter issues
// These match the dots-wrapper types used in this file
interface Droplet {
  id: number;
  name: string;
  status: string;
  region?: { slug: string } | string;
  [key: string]: any; // Allow other properties
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
  [key: string]: any; // Allow other properties
}

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

  console.log(`[DigitalOcean] Creating droplet with request:`, JSON.stringify(createRequest, null, 2));

  // Wrap the API call with retry logic
  const response = await callWithRetry(async () => {
    const doClient = await getDOClient();
    // Using createDroplets which expects names as an array
    return doClient.droplet.createDroplets(createRequest);
  });

  console.log(`[DigitalOcean] Raw API response:`, JSON.stringify(response, null, 2));
  console.log(`[DigitalOcean] Response type:`, typeof response);
  console.log(`[DigitalOcean] Response keys:`, Object.keys(response || {}));

  // Comprehensive response parsing with multiple format support
  let foundDroplet: any = null;

  // Format 1: Standard { droplets: [Droplet] } format
  if (Array.isArray(response.droplets) && response.droplets.length > 0) {
    console.log(`[DigitalOcean] Found droplets array with ${response.droplets.length} items`);
    foundDroplet = response.droplets[0];
  }
  // Format 2: Single droplet { droplet: Droplet } format
  else if (response.droplet) {
    console.log(`[DigitalOcean] Found single droplet object`);
    foundDroplet = response.droplet;
  }
  // Format 3: Response might be the droplet object itself
  else if (response && response.id && response.name) {
    console.log(`[DigitalOcean] Response appears to be droplet object directly`);
    foundDroplet = response;
  }
  // Format 4: Check for 'data' property containing droplets
  else if (response.data) {
    console.log(`[DigitalOcean] Found data property`);
    if (Array.isArray(response.data.droplets) && response.data.droplets.length > 0) {
      console.log(`[DigitalOcean] Found droplets in data property`);
      foundDroplet = response.data.droplets[0];
    } else if (response.data.droplet) {
      console.log(`[DigitalOcean] Found single droplet in data property`);
      foundDroplet = response.data.droplet;
    } else if (response.data.id && response.data.name) {
      console.log(`[DigitalOcean] Data appears to be droplet object directly`);
      foundDroplet = response.data;
    }
  }

  if (foundDroplet) {
    console.log(`[DigitalOcean] Successfully parsed droplet:`, {
      id: foundDroplet.id,
      name: foundDroplet.name,
      status: foundDroplet.status,
      region: foundDroplet.region?.slug || foundDroplet.region
    });
    return foundDroplet as Droplet;
  }
  
  // Enhanced error logging if no droplet found
  console.error(`[DigitalOcean] Could not parse droplet from response.`);
  console.error(`[DigitalOcean] Response structure analysis:`);
  
  if (response && typeof response === 'object') {
    const responseKeys = Object.keys(response);
    console.error(`[DigitalOcean] Top-level keys:`, responseKeys);
    
    // Log structure of each top-level property
    for (const key of responseKeys) {
      const value = response[key];
      const valueType = typeof value;
      const isArray = Array.isArray(value);
      const arrayInfo = isArray ? `Array[${value.length}]` : '';
      console.error(`[DigitalOcean] Key "${key}": ${valueType}${arrayInfo}`);
      
      // Log first item of arrays for debugging
      if (isArray && value.length > 0) {
        console.error(`[DigitalOcean] First item in "${key}":`, JSON.stringify(value[0], null, 2));
      }
      // Log object structure
      else if (valueType === 'object' && value !== null) {
        console.error(`[DigitalOcean] Object "${key}" keys:`, Object.keys(value));
      }
    }
  } else {
    console.error(`[DigitalOcean] Response is not an object:`, typeof response, response);
  }
  
  // Throw detailed error for debugging
  throw new DigitalOceanServiceError(
    `Failed to parse create droplet response: Unexpected API response format. ` +
    `Response keys: ${response ? Object.keys(response).join(', ') : 'null'}`
  );
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