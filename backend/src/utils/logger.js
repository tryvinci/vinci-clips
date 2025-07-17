const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
require('fs').mkdirSync(logsDir, { recursive: true });

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create daily rotating file transport for all logs
const allLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat
});

// Create daily rotating file transport for error logs only
const errorLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat
});

// Create daily rotating file transport for video processing logs
const videoProcessingTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'video-processing-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '50m',
  maxFiles: '7d',
  format: logFormat
});

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    allLogsTransport,
    errorLogsTransport
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Create specialized loggers
const videoLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    videoProcessingTransport,
    new winston.transports.Console({
      format: consoleFormat
    })
  ]
});

// Utility functions for common logging patterns
logger.logVideoProcessing = (transcriptId, status, message, metadata = {}) => {
  videoLogger.info(message, {
    transcriptId,
    status,
    timestamp: new Date().toISOString(),
    ...metadata
  });
};

logger.logError = (error, context = {}) => {
  logger.error(error.message, {
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  });
};

logger.logApiCall = (method, url, statusCode, duration, metadata = {}) => {
  logger.info(`${method} ${url}`, {
    statusCode,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...metadata
  });
};

// Express middleware for request logging
logger.requestMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logApiCall(req.method, req.originalUrl, res.statusCode, duration, {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      body: req.method === 'POST' ? (req.body || {}) : undefined
    });
  });
  
  next();
};

module.exports = logger;