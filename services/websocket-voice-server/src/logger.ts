/**
 * Winston logger configuration for WebSocket Voice Server
 */

import winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

const logLevel = process.env.LOG_LEVEL || 'info';
const logDir = process.env.LOG_DIR || '/var/log/websocket-voice-server';

// Ensure log directory exists (create if in production)
if (process.env.NODE_ENV === 'production') {
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  } catch (error) {
    console.warn(`Could not create log directory ${logDir}, using ./logs instead`);
  }
}

// Use local logs directory in development
const effectiveLogDir = (process.env.NODE_ENV === 'production' && fs.existsSync(logDir)) 
  ? logDir 
  : path.join(process.cwd(), 'logs');

// Ensure effective log directory exists
if (!fs.existsSync(effectiveLogDir)) {
  fs.mkdirSync(effectiveLogDir, { recursive: true });
}

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'websocket-voice-server' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length && meta.service !== 'websocket-voice-server'
            ? JSON.stringify(meta) 
            : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      )
    }),
    // File output - errors only
    new winston.transports.File({
      filename: path.join(effectiveLogDir, 'error.log'),
      level: 'error'
    }),
    // File output - all logs
    new winston.transports.File({
      filename: path.join(effectiveLogDir, 'combined.log')
    })
  ]
});

logger.info(`Logger initialized with level: ${logLevel}, directory: ${effectiveLogDir}`);

