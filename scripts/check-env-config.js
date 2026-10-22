// Simple script to print environment variables
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('=== Environment Variables ===');
console.log('DO_API_TOKEN:', process.env.DO_API_TOKEN ? '✅ Found (value hidden)' : '❌ Not found');
console.log('DO_DEFAULT_REGION:', process.env.DO_DEFAULT_REGION || '❌ Not found');
console.log('DO_DEFAULT_SIZE:', process.env.DO_DEFAULT_SIZE || '❌ Not found');
console.log('DO_DEFAULT_IMAGE:', process.env.DO_DEFAULT_IMAGE || '❌ Not found');
console.log('DO_DEFAULT_SSH_KEY_IDS:', process.env.DO_DEFAULT_SSH_KEY_IDS || '❌ Not found');
console.log('DTMA_GIT_REPO_URL:', process.env.DTMA_GIT_REPO_URL || '❌ Not found');
console.log('DTMA_GIT_BRANCH:', process.env.DTMA_GIT_BRANCH || '❌ Not found');
console.log('AGENTOPIA_API_URL:', process.env.AGENTOPIA_API_URL || '❌ Not found');
console.log('TEST_AGENT_ID:', process.env.TEST_AGENT_ID || '❌ Not found');

// Let's also check if the .env file is in the right location
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = dirname(__dirname);
const envPath = `${rootDir}/.env`;

console.log('\n=== .env File ===');
try {
  const envExists = fs.existsSync(envPath);
  console.log(`.env file exists: ${envExists ? '✅ Yes' : '❌ No'}`);
  
  if (envExists) {
    const envContents = fs.readFileSync(envPath, 'utf8');
    // Don't show actual values, just show which variables are defined
    const definedVars = envContents
      .split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('#'))
      .map(line => line.split('=')[0])
      .join(', ');
      
    console.log(`Variables defined in .env: ${definedVars}`);
  }
} catch (error) {
  console.error('Error checking .env file:', error.message);
} 