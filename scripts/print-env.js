// Simple script to directly read .env file
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);
const envPath = path.join(rootDir, '.env');

console.log('Checking .env file at path:', envPath);

try {
  if (fs.existsSync(envPath)) {
    console.log('.env file exists');
    
    // Read the file but don't print actual values (for security)
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    
    console.log('\nVariables in .env file:');
    lines.forEach(line => {
      if (line.trim() && !line.trim().startsWith('#')) {
        const parts = line.split('=');
        if (parts.length >= 1) {
          const varName = parts[0].trim();
          console.log(`- ${varName}: ${parts.length > 1 ? '(value exists)' : '(empty)'}`);
        }
      }
    });
  } else {
    console.log('.env file does not exist at this location');
  }
} catch (error) {
  console.error('Error reading .env file:', error.message);
}

// Try using dotenv and print the result
console.log('\nTrying dotenv package:');
try {
  const dotenv = await import('dotenv');
  dotenv.config();
  
  const envVars = [
    'DO_API_TOKEN',
    'DO_DEFAULT_REGION',
    'DO_DEFAULT_SIZE',
    'DO_DEFAULT_IMAGE',
    'DO_DEFAULT_SSH_KEY_IDS',
    'DTMA_GIT_REPO_URL',
    'DTMA_GIT_BRANCH',
    'AGENTOPIA_API_URL',
    'TEST_AGENT_ID'
  ];
  
  envVars.forEach(varName => {
    const exists = typeof process.env[varName] !== 'undefined';
    console.log(`- ${varName}: ${exists ? '(exists)' : '(not found)'}`);
  });
} catch (error) {
  console.error('Error using dotenv:', error.message);
} 