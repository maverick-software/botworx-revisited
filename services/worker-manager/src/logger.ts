import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';

// Ensure logs are stored relative to the project root, not the service directory
const logDirectory = path.resolve(__dirname, '../../../docs/console/logs'); // Resolves to project_root/docs/console/logs

const dailyRotateFileTransport = new winston.transports.DailyRotateFile({
  level: 'info', // Log info level and above to file
  dirname: logDirectory,
  filename: 'worker-manager-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m', // Max size of each log file
  maxFiles: '30d', // Keep logs for 30 days
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
});

const consoleTransport = new winston.transports.Console({
    level: 'debug', // Log debug level and above to console
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
});

const logger = winston.createLogger({
  transports: [
    dailyRotateFileTransport,
    // Only add console transport if not in production
    ...(process.env.NODE_ENV !== 'production' ? [consoleTransport] : []),
  ],
  exitOnError: false, // Do not exit on handled exceptions
});

export default logger; 