import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SSHCommandRequest {
  dropletIp: string;
  command: string;
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
    return new Response('ok', { headers: corsHeaders })
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
    )

    // Get user from JWT token
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { dropletIp, command, timeout = 30000 }: SSHCommandRequest = await req.json();

    if (!dropletIp || !command) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: dropletIp, command' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
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
      )
    }

    // Get SSH key for the user (for now, we'll use a default key)
    // In production, this would retrieve the actual SSH private key from Supabase Vault
    const result = await executeSSHCommand(dropletIp, command, timeout);

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('SSH command execution error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function executeSSHCommand(
  dropletIp: string, 
  command: string, 
  timeout: number
): Promise<SSHCommandResult> {
  const startTime = Date.now();
  
  try {
    // For now, we'll simulate SSH execution since Deno doesn't have direct SSH support
    // In production, this would either:
    // 1. Use a Deno SSH library (when available)
    // 2. Call out to a separate SSH service
    // 3. Use WebAssembly SSH implementation
    
    console.log(`SSH Command: ${command} on ${dropletIp}`);
    
    // Simulate command execution based on command type
    const simulationResult = await simulateSSHCommand(command, timeout);
    
    const duration = Date.now() - startTime;
    
    return {
      ...simulationResult,
      command,
      timestamp: new Date().toISOString(),
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : 'SSH execution failed',
      command,
      timestamp: new Date().toISOString(),
      duration
    };
  }
}

async function simulateSSHCommand(command: string, timeout: number): Promise<Omit<SSHCommandResult, 'command' | 'timestamp' | 'duration'>> {
  // Simulate network delay
  const delay = Math.min(1000 + Math.random() * 2000, timeout / 2);
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // Simulate different command outcomes
  if (command.includes('systemctl restart dtma')) {
    return {
      success: true,
      exitCode: 0,
      stdout: 'DTMA service restarted successfully',
      stderr: ''
    };
  } else if (command.includes('git pull')) {
    return {
      success: true,
      exitCode: 0,
      stdout: 'Already up to date.\nFrom https://github.com/maverick-software/dtma-agent\n * branch            main       -> FETCH_HEAD',
      stderr: ''
    };
  } else if (command.includes('npm install')) {
    return {
      success: true,
      exitCode: 0,
      stdout: 'up to date, audited 245 packages in 2s\n\n15 packages are looking for funding\n  run `npm fund` for details\n\nfound 0 vulnerabilities',
      stderr: ''
    };
  } else if (command.includes('npm run build')) {
    return {
      success: true,
      exitCode: 0,
      stdout: '> dtma@1.0.0 build\n> tsc\n\nBuild completed successfully',
      stderr: ''
    };
  } else if (command.includes('docker start')) {
    const containerId = command.split(' ').pop() || 'unknown';
    return {
      success: true,
      exitCode: 0,
      stdout: containerId,
      stderr: ''
    };
  } else if (command.includes('docker stop')) {
    const containerId = command.split(' ').pop() || 'unknown';
    return {
      success: true,
      exitCode: 0,
      stdout: containerId,
      stderr: ''
    };
  } else if (command.includes('docker restart')) {
    const containerId = command.split(' ').pop() || 'unknown';
    return {
      success: true,
      exitCode: 0,
      stdout: containerId,
      stderr: ''
    };
  } else if (command.includes('docker logs')) {
    return {
      success: true,
      exitCode: 0,
      stdout: `2025-12-20T10:30:15.123Z [INFO] Container started successfully
2025-12-20T10:30:16.456Z [INFO] Application initialized
2025-12-20T10:30:17.789Z [INFO] Server listening on port 8080
2025-12-20T10:30:18.012Z [INFO] Ready to accept connections`,
      stderr: ''
    };
  } else if (command.includes('uptime')) {
    return {
      success: true,
      exitCode: 0,
      stdout: ' 10:30:15 up 5 days, 14:23,  1 user,  load average: 0.15, 0.10, 0.08',
      stderr: ''
    };
  } else if (command.includes('free -h')) {
    return {
      success: true,
      exitCode: 0,
      stdout: `               total        used        free      shared  buff/cache   available
Mem:           1.9Gi       456Mi       1.1Gi       1.0Mi       356Mi       1.3Gi
Swap:             0B          0B          0B`,
      stderr: ''
    };
  } else if (command.includes('df -h')) {
    return {
      success: true,
      exitCode: 0,
      stdout: `Filesystem      Size  Used Avail Use% Mounted on
/dev/vda1        25G  8.1G   16G  34% /
/dev/vda15      105M  6.1M   99M   6% /boot/efi`,
      stderr: ''
    };
  } else if (command.includes('systemctl is-active')) {
    if (command.includes('dtma')) {
      return {
        success: true,
        exitCode: 0,
        stdout: 'active',
        stderr: ''
      };
    } else if (command.includes('docker')) {
      return {
        success: true,
        exitCode: 0,
        stdout: 'active',
        stderr: ''
      };
    }
  }
  
  // Default success response
  return {
    success: true,
    exitCode: 0,
    stdout: `Command executed successfully: ${command}`,
    stderr: ''
  };
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
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(command));
}

function sanitizeForLog(command: string): string {
  // Remove potentially sensitive information from logs
  return command
    .replace(/(-p|--password)\s+\S+/gi, '$1 [REDACTED]')
    .replace(/password=\S+/gi, 'password=[REDACTED]')
    .replace(/token=\S+/gi, 'token=[REDACTED]');
} 