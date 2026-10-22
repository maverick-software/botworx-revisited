// Deprovision Test Droplet Script
// This script tests deprovisioning a DigitalOcean droplet for an agent

import dotenv from 'dotenv';
import axios from 'axios';

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

async function deprovisionTestDroplet() {
  console.log(`Deprovisioning test droplet for agent: ${TEST_AGENT_ID}`);
  
  try {
    // Call the internal API endpoint to deprovision tool environment
    const response = await axios.delete(
      `${BACKEND_URL}/internal/agents/${TEST_AGENT_ID}/tool-environment`,
      {
        headers: {
          'X-Internal-Api-Secret': INTERNAL_API_SECRET
        }
      }
    );
    
    console.log('Deprovisioning response:', response.data);
    
    if (response.data.success) {
      console.log('Deprovisioning initiated successfully!');
      console.log('Message:', response.data.message);
    } else {
      console.error('Deprovisioning failed:', response.data.error);
    }
  } catch (error) {
    console.error('Error deprovisioning test droplet:');
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

// Execute the deprovisioning
deprovisionTestDroplet(); 