import winston from 'winston';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'analyzer' },
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
    }),
    // Always log to console, even in production, for Docker visibility
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

