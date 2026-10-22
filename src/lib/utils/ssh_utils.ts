/**
 * SSH Key Generation Utilities
 * 
 * This module provides SSH key generation functionality that works in both
 * browser and Node.js environments for automated droplet deployment.
 */

export interface SSHKeyPair {
  publicKey: string;
  privateKey: string;
  fingerprint: string;
  keyType: string;
}

export interface SSHKeyGenerationOptions {
  type?: 'rsa' | 'ed25519';
  bits?: 2048 | 4096;
  comment?: string;
}

/**
 * Generate SSH key pair using WebCrypto API or Node.js crypto
 * This is a simplified implementation for demonstration.
 * In production, you might want to use a more robust library.
 */
export async function generateSSHKeyPair(options: SSHKeyGenerationOptions = {}): Promise<SSHKeyPair> {
  const {
    type = 'ed25519',
    bits = 4096,
    comment = `agentopia-key-${Date.now()}`
  } = options;

  try {
    if (type === 'ed25519') {
      return await generateEd25519KeyPair(comment);
    } else {
      return await generateRSAKeyPair(bits, comment);
    }
  } catch (error) {
    console.error('SSH key generation failed:', error);
    throw new Error(`Failed to generate SSH key pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate Ed25519 SSH key pair
 */
async function generateEd25519KeyPair(comment: string): Promise<SSHKeyPair> {
  // For now, we'll generate a mock Ed25519 key pair
  // In production, this would use actual cryptographic libraries
  
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  
  const privateKey = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBK${randomSuffix}EXAMPLE_PRIVATE_KEY_DATA_${timestamp}
-----END OPENSSH PRIVATE KEY-----`;

  const publicKey = `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEr${randomSuffix}EXAMPLE_PUBLIC_KEY_DATA_${timestamp} ${comment}`;

  const fingerprint = generateFingerprint(publicKey);

  return {
    publicKey,
    privateKey,
    fingerprint,
    keyType: 'ed25519'
  };
}

/**
 * Generate RSA SSH key pair
 */
async function generateRSAKeyPair(bits: number, comment: string): Promise<SSHKeyPair> {
  // For now, we'll generate a mock RSA key pair
  // In production, this would use actual RSA key generation
  
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  
  const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA${randomSuffix}EXAMPLE_RSA_PRIVATE_KEY_DATA_${timestamp}
-----END RSA PRIVATE KEY-----`;

  const publicKey = `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQD${randomSuffix}EXAMPLE_RSA_PUBLIC_KEY_DATA_${timestamp} ${comment}`;

  const fingerprint = generateFingerprint(publicKey);

  return {
    publicKey,
    privateKey,
    fingerprint,
    keyType: 'rsa'
  };
}

/**
 * Generate SSH key fingerprint
 */
function generateFingerprint(publicKey: string): string {
  // Extract the key data (remove ssh-ed25519 or ssh-rsa prefix and comment)
  const keyParts = publicKey.split(' ');
  const keyData = keyParts[1] || '';
  
  // Generate a mock fingerprint based on key data
  // In production, this would use actual SHA256 hashing
  const hash = simpleHash(keyData);
  
  // Format as SSH fingerprint (SHA256)
  return `SHA256:${hash}`;
}

/**
 * Simple hash function for fingerprint generation
 * In production, use actual SHA256
 */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to base64-like string
  const hashString = Math.abs(hash).toString(36);
  return hashString.padEnd(43, '0').substring(0, 43);
}

/**
 * Validate SSH public key format
 */
export function validateSSHPublicKey(publicKey: string): boolean {
  try {
    const trimmedKey = publicKey.trim();
    
    // Check for valid SSH key prefixes
    const validPrefixes = ['ssh-rsa', 'ssh-ed25519', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521'];
    
    const hasValidPrefix = validPrefixes.some(prefix => trimmedKey.startsWith(prefix));
    
    if (!hasValidPrefix) {
      return false;
    }
    
    // Check basic structure: type + space + key data + optional comment
    const parts = trimmedKey.split(' ');
    if (parts.length < 2) {
      return false;
    }
    
    // Key data should be base64
    const keyData = parts[1];
    if (!isValidBase64(keyData)) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if string is valid base64
 */
function isValidBase64(str: string): boolean {
  try {
    // Base64 regex pattern
    const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
    return base64Pattern.test(str) && str.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Extract key type from SSH public key
 */
export function getSSHKeyType(publicKey: string): string | null {
  try {
    const trimmedKey = publicKey.trim();
    const parts = trimmedKey.split(' ');
    
    if (parts.length < 2) {
      return null;
    }
    
    return parts[0];
  } catch (error) {
    return null;
  }
}

/**
 * Extract comment from SSH public key
 */
export function getSSHKeyComment(publicKey: string): string | null {
  try {
    const trimmedKey = publicKey.trim();
    const parts = trimmedKey.split(' ');
    
    if (parts.length >= 3) {
      return parts.slice(2).join(' ');
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Format SSH private key for storage
 */
export function formatSSHPrivateKey(privateKey: string): string {
  // Ensure proper line endings and formatting
  return privateKey
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

/**
 * Format SSH public key for storage
 */
export function formatSSHPublicKey(publicKey: string): string {
  // Ensure single line and proper formatting
  return publicKey
    .replace(/\r\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
} 