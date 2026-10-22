// Deploy Test Droplet Script
// This script tests deploying a DigitalOcean droplet for agent tools

import dotenv from 'dotenv';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

// Load environment variables
dotenv.config();

// Configuration (ideally from .env file)
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
const TEST_AGENT_ID = process.env.TEST_AGENT_ID || 'test-agent-1';

if (!INTERNAL_API_SECRET) {
  console.error('ERROR: INTERNAL_API_SECRET environment variable is required');
  process.exit(1);
}

async function deployTestDroplet() {
  console.log(`Deploying test droplet for agent: ${TEST_AGENT_ID}`);
  
  try {
    // Call the internal API endpoint to ensure tool environment
    const response = await axios.post(
      `${BACKEND_URL}/internal/agents/${TEST_AGENT_ID}/ensure-tool-environment`,
      {}, // No body needed
      {
        headers: {
          'X-Internal-Api-Secret': INTERNAL_API_SECRET
        }
      }
    );
    
    console.log('Deployment response:', response.data);
    
    if (response.data.success) {
      console.log('Deployment initiated successfully!');
      console.log('Droplet details:', response.data.data);
      
      // If deployment is successful, periodically check status
      if (response.data.data && response.data.data.droplet_id) {
        console.log(`Droplet ID: ${response.data.data.droplet_id}`);
        console.log(`Status: ${response.data.data.status}`);
        console.log(`IP Address: ${response.data.data.ip_address || 'Pending...'}`);
      }
    } else {
      console.error('Deployment failed:', response.data.error);
    }
  } catch (error) {
    console.error('Error deploying test droplet:');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error:', error.message);
    }
  }
}

// Execute the deployment
deployTestDroplet(); 