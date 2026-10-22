/**
 * Agentopia WebSocket Voice Server
 * 
 * Main entry point for the WebSocket server that handles real-time voice chat
 * using OpenAI's Realtime API (gpt-4o-realtime-preview-2024-10-01)
 */

import WebSocket from 'ws';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { authenticateConnection } from './auth';
import { createOpenAIProxy } from './openai-proxy';
import { logger } from './logger';
import * as dotenv from 'dotenv';
import * as http from 'http';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '8080', 10);
const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS || '1000', 10);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  logger.error('Missing required environment variables: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

logger.info('Supabase client initialized');

// Create WebSocket server
const wss = new WebSocket.Server({
  port: PORT,
  perMessageDeflate: false, // Disable compression for lower latency
  maxPayload: 10 * 1024 * 1024, // 10MB max message size
});

let activeConnections = 0;

wss.on('connection', async (clientWs: WebSocket, req) => {
  // Check connection limit
  if (activeConnections >= MAX_CONNECTIONS) {
    logger.warn('Connection limit reached, rejecting new connection');
    clientWs.close(1008, 'Server at capacity');
    return;
  }

  activeConnections++;
  const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  logger.info(`[${connectionId}] New connection attempt from ${req.socket.remoteAddress}`);

  try {
    // Parse query parameters
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const agentId = url.searchParams.get('agent_id');
    const conversationId = url.searchParams.get('conversation_id') || null;
    const voice = url.searchParams.get('voice') || 'alloy';

    if (!token || !agentId) {
      logger.warn(`[${connectionId}] Missing required parameters`);
      clientWs.close(4000, 'Missing token or agent_id');
      activeConnections--;
      return;
    }

    // Authenticate user
    const authResult = await authenticateConnection(supabase, token);
    
    if (!authResult.success || !authResult.user) {
      logger.warn(`[${connectionId}] Authentication failed: ${authResult.error}`);
      clientWs.close(4001, 'Unauthorized');
      activeConnections--;
      return;
    }

    logger.info(`[${connectionId}] User authenticated: ${authResult.user.id}`);

    // Create OpenAI proxy connection
    const proxy = await createOpenAIProxy({
      connectionId,
      clientWs,
      supabase,
      userId: authResult.user.id,
      agentId,
      conversationId,
      voice,
      logger
    });

    // Handle client disconnection
    clientWs.on('close', (code, reason) => {
      logger.info(`[${connectionId}] Client disconnected: ${code} - ${reason}`);
      proxy.cleanup();
      activeConnections--;
    });

    clientWs.on('error', (error) => {
      logger.error(`[${connectionId}] Client error:`, error);
      proxy.cleanup();
      activeConnections--;
    });

  } catch (error) {
    logger.error(`[${connectionId}] Connection setup error:`, error);
    clientWs.close(1011, 'Internal server error');
    activeConnections--;
  }
});

wss.on('error', (error) => {
  logger.error('WebSocket server error:', error);
});

logger.info(`WebSocket server listening on port ${PORT}`);
logger.info(`Max connections: ${MAX_CONNECTIONS}`);

// Health check endpoint (simple HTTP server)
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      activeConnections,
      maxConnections: MAX_CONNECTIONS,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const HEALTH_PORT = PORT + 1;
healthServer.listen(HEALTH_PORT, () => {
  logger.info(`Health check server listening on port ${HEALTH_PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing connections...');
  wss.close(() => {
    logger.info('WebSocket server closed');
    healthServer.close(() => {
      logger.info('Health check server closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, closing connections...');
  wss.close(() => {
    logger.info('WebSocket server closed');
    healthServer.close(() => {
      logger.info('Health check server closed');
      process.exit(0);
    });
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

logger.info('WebSocket Voice Server started successfully');

