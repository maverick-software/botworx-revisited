// Re-exporting core types from dots-wrapper for convenience if needed elsewhere,
// or define specific request/response types for our service methods.

// Example: Re-exporting the Droplet type from dots-wrapper
// The actual path might vary based on dots-wrapper structure, e.g., dots-wrapper/dist/modules/droplet
// For now, let's assume it's directly accessible or we define our own simplified versions.

export type { Droplet } from 'https://esm.sh/dots-wrapper@3.11.17'; // Changed to esm.sh URL and export type

/**
 * Represents a DigitalOcean Droplet resource as potentially returned by dots-wrapper.
 * This is a simplified example; refer to dots-wrapper documentation for the full type.
 */
export interface DigitalOceanDroplet {
  id: number;
  name: string;
  memory: number;
  vcpus: number;
  disk: number;
  region: {
    slug: string;
    name: string;
    available: boolean;
  };
  size_slug: string;
  image: {
    id: number;
    name: string;
    distribution: string;
    slug: string | null;
    public: boolean;
    regions: string[];
    type: string;
  };
  status: 'new' | 'active' | 'off' | 'archive';
  locked: boolean;
  created_at: string;
  networks: {
    v4: Array<{
      ip_address: string;
      netmask: string;
      gateway: string;
      type: 'public' | 'private';
    }>;
    v6?: Array<{
      ip_address: string;
      netmask: number;
      gateway: string;
      type: 'public';
    }>;
  };
  kernel: {
    id: number;
    name: string;
    version: string;
  } | null;
  backup_ids: number[];
  snapshot_ids: number[];
  features: string[];
  tags: string[];
  volume_ids: string[];
  vpc_uuid?: string;
  // Add other fields as necessary based on dots-wrapper's Droplet type
}

/**
 * Options for creating a new DigitalOcean Droplet.
 * This should align with the parameters expected by dots-wrapper's createDroplet or similar function.
 */
export interface CreateDropletServiceOptions {
  name: string;
  region: string; // e.g., 'nyc3'
  size: string;   // e.g., 's-1vcpu-1gb'
  image: string;  // e.g., 'ubuntu-22-04-x64' or a snapshot ID
  ssh_keys?: (string | number)[]; // Array of SSH key IDs or fingerprints
  backups?: boolean;
  ipv6?: boolean;
  private_networking?: boolean; // Deprecated by VPCs, but might still be in SDK
  vpc_uuid?: string;
  user_data?: string; // For cloud-init script
  monitoring?: boolean;
  tags?: string[];
  with_droplet_agent?: boolean; // If the SDK supports DigitalOcean agent installation
}

/**
 * Simplified response structure for droplet creation, if different from DigitalOceanDroplet.
 */
export interface CreateDropletServiceResponse {
  id: number;
  name: string;
  status: string;
  // Potentially other fields like action_id if creation is asynchronous
  digitalOceanDroplet?: DigitalOceanDroplet; // Full droplet details if available immediately
}

// Add other service-specific types as the module grows (e.g., for firewalls, volumes) 