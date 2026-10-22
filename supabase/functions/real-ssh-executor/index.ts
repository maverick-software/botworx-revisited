import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log('=== real-ssh-executor function initializing ===');

interface SSHCommandRequest {
  dropletIp: string;
  command: string;
  userId: string;
  timeout?: number;
}

interface SSHCommandResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  command: string;
  timestamp: string;
  duration: number;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user from JWT token
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { dropletIp, command, userId, timeout = 30000 }: SSHCommandRequest = await req.json();

    if (!dropletIp || !command || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: dropletIp, command, userId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate command safety
    if (!isCommandSafe(command)) {
      return new Response(
        JSON.stringify({ 
          error: 'Command rejected for security reasons',
          command: sanitizeForLog(command)
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Execute SSH command with real implementation
    const result = await executeRealSSHCommand(dropletIp, command, userId, timeout);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('SSH executor error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function executeRealSSHCommand(
  dropletIp: string, 
  command: string, 
  userId: string,
  timeout: number
): Promise<SSHCommandResult> {
  const startTime = Date.now();
  
  try {
    console.log(`🔧 Executing SSH command: ${sanitizeForLog(command)} on ${dropletIp}`);
    
    // Get SSH key for the user from Supabase
    const sshKey = await getSSHKeyForUser(userId);
    
    if (!sshKey) {
      throw new Error('No SSH key found for user. Please configure SSH access first.');
    }

    // Execute the command using SSH
    const result = await runSSHCommand(dropletIp, command, sshKey.privateKey, timeout);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ SSH command completed in ${duration}ms`);
    
    return {
      ...result,
      command: sanitizeForLog(command),
      timestamp: new Date().toISOString(),
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error(`❌ SSH command failed: ${error}`);
    
    return {
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : 'SSH execution failed',
      command: sanitizeForLog(command),
      timestamp: new Date().toISOString(),
      duration
    };
  }
}

async function getSSHKeyForUser(userId: string): Promise<{ privateKey: string; publicKey: string } | null> {
  try {
    // Initialize admin Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user's SSH key metadata
    const { data: sshKeys, error: keyError } = await supabaseAdmin
      .from('user_ssh_keys')
      .select('public_key_vault_id, private_key_vault_id')
      .eq('user_id', userId)
      .limit(1);

    if (keyError || !sshKeys || sshKeys.length === 0) {
      console.log('No SSH keys found for user:', userId);
      return null;
    }

    const keyMetadata = sshKeys[0];

    // Retrieve private key from vault
    const { data: privateKeyData, error: privateError } = await supabaseAdmin
      .rpc('get_secret', { secret_id: keyMetadata.private_key_vault_id });

    if (privateError || !privateKeyData) {
      throw new Error(`Failed to retrieve private key: ${privateError?.message}`);
    }

    // Retrieve public key from vault
    const { data: publicKeyData, error: publicError } = await supabaseAdmin
      .rpc('get_secret', { secret_id: keyMetadata.public_key_vault_id });

    if (publicError || !publicKeyData) {
      throw new Error(`Failed to retrieve public key: ${publicError?.message}`);
    }

    return {
      privateKey: privateKeyData.key || privateKeyData,
      publicKey: publicKeyData.key || publicKeyData
    };

  } catch (error) {
    console.error('Error retrieving SSH key:', error);
    return null;
  }
}

async function runSSHCommand(
  host: string,
  command: string,
  privateKey: string,
  timeout: number
): Promise<Omit<SSHCommandResult, 'command' | 'timestamp' | 'duration'>> {
  try {
    // For Deno environment, we'll use the system SSH command
    // This requires SSH to be available in the container/environment
    
    // Create temporary key file
    const tempKeyFile = await Deno.makeTempFile({ suffix: '.pem' });
    
    try {
      // Write private key to temporary file
      await Deno.writeTextFile(tempKeyFile, privateKey);
      
      // Set proper permissions (equivalent to chmod 600)
      await Deno.chmod(tempKeyFile, 0o600);
      
      // Construct SSH command
      const sshArgs = [
        '-i', tempKeyFile,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'ConnectTimeout=10',
        '-o', 'ServerAliveInterval=60',
        '-o', 'ServerAliveCountMax=3',
        `root@${host}`,
        command
      ];

      console.log(`Running SSH command: ssh ${sshArgs.join(' ')}`);

      // Execute SSH command
      const process = new Deno.Command('ssh', {
        args: sshArgs,
        stdout: 'piped',
        stderr: 'piped'
      });

      // Set up timeout
      const timeoutId = setTimeout(() => {
        try {
          process.kill('SIGTERM');
        } catch (e) {
          console.warn('Failed to kill SSH process:', e);
        }
      }, timeout);

      const { code, stdout, stderr } = await process.output();
      
      clearTimeout(timeoutId);

      const stdoutText = new TextDecoder().decode(stdout);
      const stderrText = new TextDecoder().decode(stderr);

      return {
        success: code === 0,
        exitCode: code,
        stdout: stdoutText,
        stderr: stderrText
      };

    } finally {
      // Clean up temporary key file
      try {
        await Deno.remove(tempKeyFile);
      } catch (e) {
        console.warn('Failed to remove temporary key file:', e);
      }
    }

  } catch (error) {
    console.error('SSH execution error:', error);
    
    return {
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : 'SSH command execution failed'
    };
  }
}

function isCommandSafe(command: string): boolean {
  // Basic command safety checks
  const dangerousPatterns = [
    /rm\s+-rf\s+\//, // rm -rf /
    />\s*\/dev\/sd/, // Writing to disk devices
    /mkfs/, // Format filesystem
    /dd\s+.*of=\/dev/, // Writing to devices with dd
    /shutdown/, // System shutdown
    /reboot/, // System reboot
    /halt/, // System halt
    /init\s+0/, // System shutdown
    /init\s+6/, // System reboot
    /passwd/, // Password changes
    /userdel/, // User deletion
    /deluser/, // User deletion
    /crontab\s+-r/, // Remove all cron jobs
    /sudo\s+su/, // Privilege escalation
    /chmod\s+777/, // Dangerous permissions
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(command));
}

function sanitizeForLog(command: string): string {
  // Remove potentially sensitive information from logs
  return command
    .replace(/(-p|--password)\s+\S+/gi, '$1 [REDACTED]')
    .replace(/password=\S+/gi, 'password=[REDACTED]')
    .replace(/token=\S+/gi, 'token=[REDACTED]')
    .replace(/key=\S+/gi, 'key=[REDACTED]');
}

console.log('=== real-ssh-executor function script processed ==='); 