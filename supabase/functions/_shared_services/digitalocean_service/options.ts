import { getDOClient } from './client.ts';
import { callWithRetry } from './utils.ts';
import { DigitalOceanServiceError } from './errors.ts';
import type { Region, Size } from 'https://esm.sh/dots-wrapper@3.11.17';

export interface DORegion {
  slug: string;
  name: string;
  available: boolean;
  features?: string[]; // Added optional features
  sizes?: string[];    // Added optional sizes available in this region
}

export interface DOSize {
  slug: string;
  memory: number;
  vcpus: number;
  disk: number;
  transfer: number;
  price_monthly: number;
  price_hourly: number;
  regions: string[];
  available: boolean;
  description: string; 
}

/**
 * Lists all available DigitalOcean regions.
 * @returns {Promise<DORegion[]>} A promise that resolves to an array of available regions.
 * @throws {DigitalOceanServiceError} If the API call fails or the response is malformed.
 */
export async function listAvailableRegions(): Promise<DORegion[]> {
  const response = await callWithRetry(async () => {
    const doClient = await getDOClient();
    // Assuming doClient.region.list() returns a paginated response or direct data
    // The actual response structure from dots-wrapper might require adjustment here
    // e.g., response.data.regions or just response.regions if the list method resolves directly
    return doClient.region.list();
  });

  // Adjust based on the actual structure of the response from doClient.region.list()
  if (response && response.data && Array.isArray(response.data.regions)) {
    return response.data.regions.map((r: Region) => ({
      slug: r.slug,
      name: r.name,
      available: r.available,
      features: r.features,
      sizes: r.sizes,
    }));
  } else if (response && Array.isArray(response.regions)) { // Fallback for older/different versions
     return response.regions.map((r: Region) => ({
      slug: r.slug,
      name: r.name,
      available: r.available,
      features: r.features,
      sizes: r.sizes,
    }));
  }
  console.error("Failed to parse list regions response:", response);
  throw new DigitalOceanServiceError('Failed to parse list regions response: Unexpected API response format.');
}

/**
 * Lists all available DigitalOcean droplet sizes.
 * @returns {Promise<DOSize[]>} A promise that resolves to an array of available droplet sizes.
 * @throws {DigitalOceanServiceError} If the API call fails or the response is malformed.
 */
export async function listAvailableSizes(): Promise<DOSize[]> {
  const response = await callWithRetry(async () => {
    const doClient = await getDOClient();
    // Assuming doClient.size.list() returns a paginated response or direct data
    return doClient.size.list();
  });

  // Adjust based on the actual structure of the response from doClient.size.list()
  if (response && response.data && Array.isArray(response.data.sizes)) {
    return response.data.sizes.map((s: Size) => ({
      slug: s.slug,
      memory: s.memory,
      vcpus: s.vcpus,
      disk: s.disk,
      transfer: s.transfer,
      price_monthly: s.price_monthly,
      price_hourly: s.price_hourly,
      regions: s.regions,
      available: s.available,
      description: s.description || `${s.vcpus} vCPU(s), ${s.memory / 1024}GB RAM, ${s.disk}GB SSD`,
    }));
  } else if (response && Array.isArray(response.sizes)) { // Fallback
    return response.sizes.map((s: Size) => ({
      slug: s.slug,
      memory: s.memory,
      vcpus: s.vcpus,
      disk: s.disk,
      transfer: s.transfer,
      price_monthly: s.price_monthly,
      price_hourly: s.price_hourly,
      regions: s.regions,
      available: s.available,
      description: s.description || `${s.vcpus} vCPU(s), ${s.memory / 1024}GB RAM, ${s.disk}GB SSD`,
    }));
  }
  console.error("Failed to parse list sizes response:", response);
  throw new DigitalOceanServiceError('Failed to parse list sizes response: Unexpected API response format.');
} 