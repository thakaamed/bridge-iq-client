/**
 * Logging configuration for the BridgeIQ client.
 *
 * This module provides a customized logger for the client library that
 * supports different log levels and formats.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Log levels enum.
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * Logger class for the Bridge IQ client.
 */
export class Logger {
  private level: LogLevel;
  private name: string;
  private logToFile: boolean;
  private logFile?: string;
  private logStream?: fs.WriteStream;

  /**
   * Create a new Logger.
   *
   * @param name - Logger name
   * @param level - Logging level (ERROR, WARN, INFO, DEBUG)
   * @param logToFile - Whether to log to a file
   * @param logFile - Optional path to log file
   */
  constructor(
    name = 'bridge_iq',
    level: LogLevel = LogLevel.INFO,
    logToFile = false,
    logFile?: string
  ) {
    this.name = name;
    this.level = level;
    this.logToFile = logToFile;

    if (logToFile) {
      // Set up logging to file
      if (!logFile) {
        // Use default location
        const logDir = path.join(os.homedir(), '.bridge_iq', 'logs');

        // Create log directory if it doesn't exist
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }

        this.logFile = path.join(logDir, 'bridge_iq.log');
      } else {
        this.logFile = logFile;

        // Create parent directory if it doesn't exist
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
      }

      // Open log file stream
      this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
    }
  }

  /**
   * Format log message with timestamp and metadata.
   *
   * @param level - Log level label
   * @param message - Log message
   * @returns Formatted log message
   */
  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `${timestamp} - ${this.name} - ${level} - ${message}`;
  }

  /**
   * Write log message to console and optionally to file.
   *
   * @param level - Log level label
   * @param levelValue - Numeric log level
   * @param message - Log message
   */
  private log(level: string, levelValue: LogLevel, message: string): void {
    if (levelValue <= this.level) {
      const formattedMessage = this.formatMessage(level, message);

      // Log to console
      switch (levelValue) {
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.DEBUG:
          console.debug(formattedMessage);
          break;
      }

      // Log to file if enabled
      if (this.logToFile && this.logStream) {
        this.logStream.write(formattedMessage + '\n');
      }
    }
  }

  /**
   * Log a debug message.
   *
   * @param message - Log message
   */
  debug(message: string): void {
    this.log('DEBUG', LogLevel.DEBUG, message);
  }

  /**
   * Log an info message.
   *
   * @param message - Log message
   */
  info(message: string): void {
    this.log('INFO', LogLevel.INFO, message);
  }

  /**
   * Log a warning message.
   *
   * @param message - Log message
   */
  warn(message: string): void {
    this.log('WARN', LogLevel.WARN, message);
  }

  /**
   * Alias for warn() method.
   *
   * @param message - Log message
   */
  warning(message: string): void {
    this.warn(message);
  }

  /**
   * Log an error message.
   *
   * @param message - Log message
   */
  error(message: string): void {
    this.log('ERROR', LogLevel.ERROR, message);
  }

  /**
   * Close the logger and any open file streams.
   */
  close(): void {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = undefined;
    }
  }
}

// Default logger instance
export const defaultLogger = new Logger();

/**
 * Get a configured logger instance.
 *
 * @param name - Logger name
 * @param level - Log level
 * @param logToFile - Whether to log to file
 * @param logFile - Optional log file path
 * @returns Logger instance
 */
export function getLogger(
  name?: string,
  level: LogLevel = LogLevel.INFO,
  logToFile = false,
  logFile?: string
): Logger {
  if (!name) {
    // Return default logger if no name provided
    defaultLogger.debug('Returning default logger');
    return defaultLogger;
  }

  // Create a new logger with the specified configuration
  return new Logger(name, level, logToFile, logFile);
}
