import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Missing Supabase URL or Service Role Key in .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function deprovisionByIp(ipAddress) {
  if (!ipAddress) {
    console.error('Error: IP address must be provided.');
    console.log('Usage: node scripts/deprovision-droplet-by-ip.js <ip_address>');
    process.exit(1);
  }

  console.log(`Attempting to deprovision droplet with IP: ${ipAddress}`);

  // 1. Find the toolbox ID from the IP address
  console.log('Finding toolbox environment record...');
  let { data: env, error: findError } = await supabase
    .from('account_tool_environments')
    .select('id, name')
    .eq('public_ip_address', ipAddress)
    .maybeSingle();

  if (findError) {
    console.error(`Database error while searching for IP ${ipAddress}:`, findError.message);
    process.exit(1);
  }

  if (!env) {
    console.warn(`No record found for IP ${ipAddress}. Trying to find by name 'toolbox-3f966af2-f432091a'...`);
    const { data: envByName, error: findByNameError } = await supabase
        .from('account_tool_environments')
        .select('id, name')
        .eq('do_droplet_name', 'toolbox-3f966af2-f432091a')
        .single();
    
    if (findByNameError || !envByName) {
        console.error(`Error: Could not find an environment record by name either.`);
        console.error(findByNameError?.message || 'No record found.');
        process.exit(1);
    }
    env = envByName;
  }

  const { id: toolboxId, name: toolboxName } = env;
  console.log(`Found Toolbox ID: ${toolboxId} (Name: ${toolboxName})`);

  // 2. Call the deprovisioning edge function
  console.log(`Calling edge function 'toolboxes-user' to deprovision ${toolboxId}...`);
  const { error: invokeError } = await supabase.functions.invoke(`toolboxes-user/${toolboxId}`, {
    method: 'DELETE',
  });

  if (invokeError) {
    console.error(`Error deprovisioning toolbox ${toolboxId}:`, invokeError.message);
    if (invokeError.context) {
        console.error('Error context:', invokeError.context);
    }
    process.exit(1);
  }

  console.log(`✅ Successfully triggered deprovisioning for Toolbox ID ${toolboxId} (IP: ${ipAddress}).`);
  console.log('It may take a few minutes for the droplet to be deleted from DigitalOcean.');
}

const ip = process.argv[2];
deprovisionByIp(ip); 