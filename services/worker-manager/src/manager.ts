import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
// @ts-ignore 
import pm2 from 'pm2';
import logger from './logger'; // Import the new logger

// Load environment variables from .env file in the project root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); 

logger.info("--- Worker Manager Service Starting ---");

// --- Configuration --- 
const portString = process.env.PORT || '8000'; // Default to string '8000'
const PORT = parseInt(portString, 10); // Explicitly parse to number
const MANAGER_SECRET_KEY = process.env.MANAGER_SECRET_KEY;
const WORKER_SCRIPT_PATH = process.env.WORKER_SCRIPT_PATH || '../discord-worker/src/worker.ts';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; // Worker uses anon key
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service key for admin check
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!MANAGER_SECRET_KEY) {
    logger.error("FATAL: MANAGER_SECRET_KEY environment variable not set.");
    process.exit(1);
}

// --- State ---
// REMOVED: const activeWorkers = new Map<string, WorkerInfo>(); // No longer needed

// *** ADDED: Supabase Admin Client ***
let supabaseAdmin: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    supabaseAdmin = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false }
    });
    logger.info("Supabase Admin client initialized for checks.");
} else {
    logger.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. Cannot perform pre-spawn checks.");
}

// --- PM2 Connection ---
let pm2Connected = false;
pm2.connect((err: any) => {
  if (err) {
    logger.error('PM2 connection error:', err);
    process.exit(2);
  }
  logger.info('Connected to PM2 daemon successfully.');
  pm2Connected = true;
  // Optional: Clean up any old worker processes on startup?
});

// --- Express App Setup --- 
const app = express();
app.use(cors()); // Allow all origins for now, restrict in production
app.use(express.json()); // Parse JSON bodies

// --- Authentication Middleware --- 
const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('Auth failed: Header missing/malformed');
        res.status(401).json({ error: 'Authorization header missing or malformed' });
        return;
    }
    const token = authHeader.split(' ')[1];
    if (token !== MANAGER_SECRET_KEY) {
        logger.warn('Auth failed: Invalid secret key');
        res.status(403).json({ error: 'Invalid secret key' });
        return;
    }
    next(); // Authentication successful
};

// --- Helper Function ---
const getWorkerPm2Name = (agentId: string): string => `worker-${agentId}`;

// --- Routes --- 

app.get('/', (req: Request, res: Response) => {
    res.status(200).send('Worker Manager Service is running.');
});

// *** REFACTORED: Use pm2.start API - Attempt 3 (Run ts-node as script) ***
app.post('/start-worker', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    logger.info(`[MANAGER START REQ] Received /start-worker request`);
    try {
        const { agentId, connectionDbId, botToken, agentName, systemPrompt, agentInstructions } = req.body;

        // --- Input Validation (as before) --- 
        if (!agentId || !connectionDbId || !botToken || !agentName) {
            logger.warn(`[MANAGER START REQ ${agentId}] Missing required core fields`);
            res.status(400).json({ error: 'Missing required core fields (agentId, connectionDbId, botToken, agentName).' }); 
            return; 
        }
        logger.info(`[MANAGER START REQ ${agentId}] Validated required fields for connection ${connectionDbId}`);

        // --- Env Var Check (as before) --- 
        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
            logger.error('[MANAGER START REQ] Server configuration error: Missing environment variables.');
            res.status(500).json({ error: 'Server configuration error.' });
            return;
        }
        if (!supabaseAdmin) {
             logger.error('[MANAGER START REQ] Server configuration error: Supabase admin client not initialized.');
             res.status(500).json({ error: 'Server configuration error.' });
             return;
        }
        logger.info(`[MANAGER START REQ ${agentId}] Environment variables and Supabase client OK.`);

        const workerName = getWorkerPm2Name(agentId);
        // Define paths relative to manager's location
        const tsNodePath = path.resolve(__dirname, '../../discord-worker/node_modules/.bin/ts-node');
        const workerScriptPath = path.resolve(__dirname, '../../discord-worker/src/worker.ts');
        const workerCwd = path.dirname(workerScriptPath); // Get the directory of the worker script
        logger.debug(`[MANAGER PRE-PM2 ${agentId}] ts-node path: ${tsNodePath}`);
        logger.debug(`[MANAGER PRE-PM2 ${agentId}] Worker script path: ${workerScriptPath}`);
        logger.debug(`[MANAGER PRE-PM2 ${agentId}] Worker CWD: ${workerCwd}`);

        // Wrap the core PM2 interaction and polling in a Promise
        await new Promise<void>((resolve, reject) => {
            logger.info(`[MANAGER START ${agentId}] Checking if ${workerName} already exists via pm2.describe...`);
            pm2.describe(workerName, (descErr: any, description: any) => {
                try { 
                    logger.debug(`[MANAGER START ${agentId}] Entered pm2.describe callback for ${workerName}.`);
                    if (descErr && !descErr.message.toLowerCase().includes('not found')) {
                        logger.error(`[MANAGER START ERR - DESCRIBE ${agentId}] pm2.describe failed for ${workerName}: ${descErr.message}`);
                        return reject(new Error(`PM2 describe error: ${descErr.message}`));
                    }
                    if (description && description.length > 0 && description[0].pm2_env.status === 'online') {
                        logger.warn(`[MANAGER START ${agentId}] Worker ${workerName} is already running.`);
                        return resolve(); // Resolve if already running
                    }
                    logger.info(`[MANAGER START ${agentId}] Worker ${workerName} not running or stopped. Proceeding to start via pm2.start API (ts-node as script)...`);

                    // --- Construct Environment Variables (as before) --- 
                    const inactivityTimeoutValue = req.body.inactivityTimeout === undefined || req.body.inactivityTimeout === null
                        ? '10' 
                        : String(req.body.inactivityTimeout);
                    logger.info(`[MANAGER START ${agentId}] Inactivity timeout set to: ${inactivityTimeoutValue} minutes`);
                    
                    const workerEnv = {
                        AGENT_ID: agentId,
                        AGENT_NAME: agentName,
                        CONNECTION_DB_ID: connectionDbId,
                        DISCORD_BOT_TOKEN: botToken,                 
                        SYSTEM_PROMPT: systemPrompt ?? '',             
                        AGENT_INSTRUCTIONS: agentInstructions ?? '',   
                        INACTIVITY_TIMEOUT_MINUTES: inactivityTimeoutValue,
                        SUPABASE_URL: SUPABASE_URL,
                        SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_KEY,
                        OPENAI_API_KEY: OPENAI_API_KEY,
                        NODE_ENV: process.env.NODE_ENV || 'production'
                    };
                    logger.debug(`[MANAGER START ${agentId}] Worker env prepared.`);

                    // --- PM2 Start Options: Run ts-node binary, pass worker.ts as arg --- 
                    const startOptions = {
                        // Run the ts-node binary itself as the script
                        script: tsNodePath, 
                        // Pass the actual worker.ts path as an argument to ts-node
                        args: [workerScriptPath], 
                        name: workerName,
                        env: workerEnv, // Pass constructed environment
                        autorestart: false,
                        cwd: workerCwd, // Set CWD to the worker's src directory
                        // No interpreter or node_args needed here, as we run ts-node directly
                    };

                    logger.info(`[MANAGER PM2 START ${agentId}] Attempting pm2.start with options: ${JSON.stringify(startOptions)}`);

                    // --- Execute PM2 Start using Programmatic API --- 
                    pm2.start(startOptions, async (startErr: any, apps: any) => { // Callback for pm2.start
                        // Restore original check for start error
                            if (startErr) {
                             logger.error(`[MANAGER START ERR - PM2 START ${agentId}] pm2.start failed: ${startErr.message}`, { error: startErr });
                            // Attempt cleanup if start fails
                             try {
                                 logger.warn(`[MANAGER START FAIL CLEANUP ${agentId}] Attempting pm2.stop for ${workerName} after start failure.`);
                                 // Ensure the callback signature is correct: (err, proc)
                                 pm2.stop(workerName, (stopErr: any, stopProc: any) => {
                                     if (stopErr) {
                                         logger.error(`[MANAGER START FAIL CLEANUP ERR ${agentId}] Failed to stop worker ${workerName} after start failure: ${stopErr.message}`, { error: stopErr });
                            } else {
                                         logger.info(`[MANAGER START FAIL CLEANUP OK ${agentId}] Stopped worker ${workerName} after start failure.`);
                                     }
                                     // No need to resolve/reject here, just perform cleanup
                                 });
                             } catch (cleanupErr: any) {
                                 // This catch might not be reachable if pm2.stop callback handles error
                                 logger.error(`[MANAGER START FAIL CLEANUP CATCH ERR ${agentId}] Failed to stop worker ${workerName} after start failure: ${cleanupErr.message}`, { error: cleanupErr });
                             }
                             // Reject the main promise because pm2.start failed
                             return reject(new Error(`PM2 start error: ${startErr.message}`));
                         }

                         // PM2 start command succeeded
                         logger.info(`[MANAGER PM2 START OK ${agentId}] pm2.start command successful for ${workerName}. Apps: ${apps?.[0]?.name || 'N/A'}`);

                         // *** REMOVED Polling Logic ***
                         // We now assume pm2.start success means the worker WILL eventually be active.
                         // The manage-discord-worker function will handle setting the final DB status.
                         logger.info(`[MANAGER START OK ${agentId}] Worker ${workerName} start process initiated successfully.`);
                         resolve(); // Resolve the main promise immediately after successful PM2 start

                    }); // End pm2.start callback
                } catch (innerErr: any) { // Catch sync errors within the describe callback
                    logger.error(`[MANAGER START ERR - DESCRIBE INNER ${agentId}] ${innerErr.message}`, { error: innerErr });
                    reject(innerErr);
                }
            }); // End pm2.describe callback
        }); // End new Promise for start logic

        // If promise resolved successfully
        logger.info(`[MANAGER START OK ${agentId}] Worker ${agentId} start process completed.`);
        res.status(200).json({ message: `Worker ${agentId} started successfully.` });

    } catch (error: any) {
        const agentId = req.body?.agentId || 'unknown';
        logger.error(`[MANAGER START ERR - GLOBAL ${agentId}] Error in /start-worker: ${error.message}`, { error });
        if (!res.headersSent) {
            res.status(500).json({ error: error.message || 'Failed to start worker' });
        }
        // next(error); // Pass to global error handler if implemented
    }
});

app.post('/stop-worker', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { agentId } = req.body; // Only agentId is strictly needed now
    if (!agentId) {
        logger.warn(`[MANAGER STOP REQ] Missing agentId`);
        res.status(400).json({ error: 'Missing agentId' });
        return;
    }
    logger.info(`[MANAGER STOP REQ ${agentId}] Received /stop-worker request`);

    const workerName = getWorkerPm2Name(agentId);

    try {
        await new Promise<void>((resolve, reject) => {
            logger.info(`[MANAGER STOP ${agentId}] Attempting pm2.stop for ${workerName}...`);
            pm2.stop(workerName, async (stopErr: any, proc: any) => { 
                if (stopErr && !stopErr.message.toLowerCase().includes('not found')) {
                    logger.error(`[MANAGER STOP ERR - PM2 STOP ${agentId}] pm2.stop failed for ${workerName}: ${stopErr.message}`, { error: stopErr });
                    // Don't reject, just log and resolve.
                }
                if (stopErr && stopErr.message.toLowerCase().includes('not found')) {
                     logger.warn(`[MANAGER STOP ${agentId}] Worker ${workerName} was already stopped or not found.`);
                } else {
                    logger.info(`[MANAGER STOP OK - PM2 STOP ${agentId}] pm2.stop command successful or worker already stopped for ${workerName}.`);
                }

                // Polling logic remains removed.
                logger.info(`[MANAGER STOP OK ${agentId}] Worker ${workerName} stop process completed.`);
                resolve(); // Resolve the promise immediately 

            }); // End pm2.stop callback
        }); // End new Promise for stop logic

        // If promise resolved successfully
        res.status(200).json({ message: `Worker ${agentId} stopped successfully.` });

    } catch (error: any) {
        logger.error(`[MANAGER STOP ERR - GLOBAL ${agentId}] Error in /stop-worker: ${error.message}`, { error });
        res.status(500).json({ error: error.message || 'Failed to stop worker.' });
    }
});

app.post('/restart-worker', authenticate, async (req: Request, res: Response): Promise<void> => {
    const { agentId } = req.body;
    if (!agentId) {
         logger.warn(`[MANAGER RESTART REQ] Missing agentId`);
         res.status(400).json({ error: 'Missing agentId' });
         return;
    }
    logger.info(`[MANAGER RESTART REQ ${agentId}] Received /restart-worker request`);
    const workerName = getWorkerPm2Name(agentId);

    // PM2 restart doesn't return a promise directly in its callback type,
    // so we wrap it to ensure async flow if needed, though it's simple here.
    try {
        await new Promise<void>((resolve, reject) => {
            pm2.restart(workerName, (err: any, proc: any) => {
                if (err && !err.message.toLowerCase().includes('not found')) {
                    logger.error(`[MANAGER RESTART ERR ${agentId}] Failed to restart ${workerName}: ${err.message}`, { error: err });
                    // Don't send response inside promise reject, let the catch block handle it
                    return reject(new Error(`Failed to restart worker: ${err.message}`));
                }
                if (err && err.message.toLowerCase().includes('not found')) {
                    logger.warn(`[MANAGER RESTART ${agentId}] Worker ${workerName} not found, cannot restart.`);
                    // Reject with a specific error type or message
                    return reject({ status: 404, message: `Worker ${workerName} not found.` }); 
                }
                logger.info(`[MANAGER RESTART OK ${agentId}] Worker ${workerName} restarted successfully.`);
                resolve();
            });
        });
        // If promise resolved successfully
        res.status(200).json({ message: `Worker ${agentId} restarted successfully.` });

    } catch (error: any) {
        // Handle promise rejection from pm2.restart callback
        if (error?.status === 404) {
            res.status(404).json({ error: error.message });
        } else {
            logger.error(`[MANAGER RESTART ERR - GLOBAL ${agentId}] Error: ${error.message}`, { error });
            if (!res.headersSent) {
                 res.status(500).json({ error: error.message || 'Failed to restart worker' });
            }
        }
        return; // Explicit return in catch block
    }
});

app.get('/list-workers', authenticate, (req: Request, res: Response) => {
    logger.info(`[MANAGER LIST REQ] Received /list-workers request`);
    pm2.list((err: any, list: any[]) => {
             if (err) {
            logger.error(`[MANAGER LIST ERR] Failed to list workers: ${err.message}`, { error: err });
            return res.status(500).json({ error: 'Failed to list workers' });
        }
        const workerList = list
            .filter(proc => proc.name?.startsWith('worker-'))
            .map(proc => ({ 
                name: proc.name, 
                status: proc.pm2_env?.status,
                cpu: proc.monit?.cpu,
                memory: proc.monit?.memory,
                agentId: proc.name?.replace('worker-', ''), // Extract agentId
                connectionDbId: proc.pm2_env?.CONNECTION_DB_ID // Get connection ID from env
            }));
        logger.info(`[MANAGER LIST OK] Found ${workerList.length} workers.`);
        res.status(200).json(workerList);
    });
});

// --- Global Error Handler (Optional) --- 
// app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
//     logger.error(`Unhandled Error: ${err.message}`, { stack: err.stack });
//     if (!res.headersSent) {
//         res.status(500).json({ error: 'Internal Server Error' });
//     }
// });

// --- Start Server --- 
app.listen(PORT, () => {
    logger.info(`Worker Manager Service listening on port ${PORT}`);
});

// --- Graceful Shutdown --- 
const cleanup = () => {
    logger.info("Received shutdown signal. Disconnecting from PM2...");
    pm2.disconnect();
    logger.info("PM2 disconnected. Exiting.");
    process.exit(0);
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);