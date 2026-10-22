// supabase/_shared/security.ts
// Utilities for encrypting/decrypting sensitive data like bot tokens.

import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encode as encodeBase64, decode as decodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";
import { Buffer } from "https://deno.land/std@0.208.0/io/buffer.ts"; // Node.js Buffer compatibility

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // Bytes for GCM. Recommended length is 12 bytes (96 bits).

// --- Key Derivation (Optional but recommended for robustness) ---
// If the provided ENV key isn't exactly 32 bytes, we can derive one.
// Using PBKDF2 is a standard way.
async function deriveKey(secret: string, salt: string = "agentopia-salt"): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 }, // Key length for AES-256
    true,
    ["encrypt", "decrypt"]
  );
}

// --- Encryption Function ---
/**
 * Encrypts plaintext using AES-256-GCM.
 * @param plaintext The string to encrypt.
 * @param secret The 32-byte encryption key (or a password to derive the key from).
 * @returns Base64 encoded string in the format "iv:encryptedData:tag"
 */
export async function encrypt(plaintext: string, secret: string): Promise<string> {
  if (!secret) {
    throw new Error("Encryption secret is required.");
  }
  const key = await deriveKey(secret);
  
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encodedPlaintext = new TextEncoder().encode(plaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv },
    key,
    encodedPlaintext
  );

  // GCM includes the authentication tag within the ciphertext buffer directly in Web Crypto API
  const ciphertext = new Uint8Array(ciphertextBuffer); // This includes the tag

  // Combine IV and ciphertext (which includes the tag) for storage
  const ivBase64 = encodeBase64(iv);
  const encryptedDataBase64 = encodeBase64(ciphertext);

  // Store as iv:encryptedData (tag is part of encryptedData)
  return `${ivBase64}:${encryptedDataBase64}`;
}

// --- Decryption Function ---
/**
 * Decrypts ciphertext encrypted with AES-256-GCM.
 * @param encryptedString Base64 encoded string in the format "iv:encryptedData"
 * @param secret The 32-byte encryption key (or the password used to derive the key).
 * @returns The original plaintext string.
 */
export async function decrypt(encryptedString: string, secret: string): Promise<string> {
  if (!secret) {
    throw new Error("Decryption secret is required.");
  }
  if (!encryptedString || !encryptedString.includes(':')) {
      throw new Error("Invalid encrypted string format. Expected 'iv:encryptedData'.");
  }

  const key = await deriveKey(secret);

  const parts = encryptedString.split(':');
  if (parts.length !== 2) {
      throw new Error("Invalid encrypted string format. Expected 'iv:encryptedData'.");
  }
  const [ivBase64, encryptedDataBase64] = parts;

  try {
    const iv = decodeBase64(ivBase64);
    const ciphertext = decodeBase64(encryptedDataBase64); // This includes the tag

    if (iv.length !== IV_LENGTH) {
        throw new Error(`Invalid IV length. Expected ${IV_LENGTH} bytes.`);
    }

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: iv },
      key,
      ciphertext // Pass ciphertext including tag
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
      // Handle potential decryption errors (e.g., wrong key, tampered data)
      console.error("Decryption failed:", error);
      throw new Error("Failed to decrypt data. Key may be incorrect or data may be corrupted.");
  }
} 