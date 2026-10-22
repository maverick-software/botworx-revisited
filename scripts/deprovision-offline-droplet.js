// Deprovision Offline Droplet Script
// This script deprovisiones a test droplet that was created in offline mode

import dotenv from 'dotenv';
import { deleteDigitalOceanDroplet } from '../src/services/digitalocean_service/index.js';
import fs from 'fs/promises';

// Load environment variables
dotenv.config();

async function deprovisionOfflineDroplet() {
  console.log('Deprovisioning offline test droplet...');
  
  // Get droplet ID from command line or from saved file
  let dropletId = process.argv[2];
  let dropletInfo = null;
  
  try {
    // Try to read droplet info from file if not provided as argument
    if (!dropletId) {
      try {
        const fileContent = await fs.readFile('./offline-droplet-info.json', 'utf8');
        dropletInfo = JSON.parse(fileContent);
        dropletId = dropletInfo.droplet_id;
        
        console.log(`Found droplet info in file:`);
        console.log(`- Agent ID: ${dropletInfo.agent_id}`);
        console.log(`- Droplet ID: ${dropletInfo.droplet_id}`);
        console.log(`- Droplet Name: ${dropletInfo.droplet_name}`);
        console.log(`- IP Address: ${dropletInfo.ip_address || 'Not available'}`);
      } catch (readError) {
        console.error('Error reading offline-droplet-info.json:', readError.message);
        console.error('Please provide the droplet ID as a command line argument:');
        console.error('node scripts/deprovision-offline-droplet.js <DROPLET_ID>');
        process.exit(1);
      }
    }
    
    if (!dropletId) {
      console.error('Error: No droplet ID provided or found in offline-droplet-info.json');
      process.exit(1);
    }
    
    console.log(`\nAttempting to delete DigitalOcean droplet with ID: ${dropletId}`);
    
    // Delete the droplet
    await deleteDigitalOceanDroplet(dropletId);
    console.log(`\nDroplet deletion request sent successfully!`);
    console.log('Note: It may take a few minutes for the droplet to be fully removed from your account');
    
    // Update the info file if it exists
    if (dropletInfo) {
      dropletInfo.status = 'deleted';
      dropletInfo.deprovisioned_at = new Date().toISOString();
      await fs.writeFile('./offline-droplet-info.json', JSON.stringify(dropletInfo, null, 2));
      console.log('\nUpdated offline-droplet-info.json with deletion status');
    }
    
    console.log('\nDeprovisioning complete. Resources have been released.');
  } catch (error) {
    console.error(`\nError deprovisioning droplet:`, error);
    
    if (error.message && error.message.includes('not found')) {
      console.log('\nDroplet not found. It may have already been deleted.');
      
      // Update the info file if it exists
      if (dropletInfo) {
        dropletInfo.status = 'deleted';
        dropletInfo.deprovisioned_at = new Date().toISOString();
        dropletInfo.notes = 'Droplet not found during deprovisioning, may have been manually deleted';
        await fs.writeFile('./offline-droplet-info.json', JSON.stringify(dropletInfo, null, 2));
        console.log('Updated offline-droplet-info.json with deletion status');
      }
    }
  }
}

// Execute deprovisioning
deprovisionOfflineDroplet(); 