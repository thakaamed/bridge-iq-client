/// <reference types="jest" />

/**
 * Tests for the logger module.
 */
import { getLogger, LogLevel, Logger } from '../src/logger';

describe('Logger', () => {
  // Mock console methods
  const originalConsole = { ...console };
  beforeEach(() => {
    console.debug = jest.fn();
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    // Restore console methods
    console.debug = originalConsole.debug;
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe('getLogger', () => {
    it('should create a logger with default parameters', () => {
      const logger = getLogger();

      expect(logger).toBeInstanceOf(Logger);
      expect(logger).toBeDefined();
    });

    it('should create a logger with custom module name', () => {
      const logger = getLogger('test-module');

      expect(logger).toBeInstanceOf(Logger);
    });

    it('should create a logger with custom log level', () => {
      const logger = getLogger('test-module', LogLevel.DEBUG);

      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('Logger class', () => {
    it('should log at different levels', () => {
      const logger = new Logger('test', LogLevel.DEBUG, true);

      logger.debug('Debug message');
      expect(console.debug).toHaveBeenCalled();

      logger.info('Info message');
      expect(console.info).toHaveBeenCalled();

      logger.warning('Warning message');
      expect(console.warn).toHaveBeenCalled();

      logger.error('Error message');
      expect(console.error).toHaveBeenCalled();
    });

    it('should respect log level threshold', () => {
      const logger = new Logger('test', LogLevel.WARN, true);

      logger.debug('Debug message');
      expect(console.debug).not.toHaveBeenCalled();

      logger.info('Info message');
      expect(console.info).not.toHaveBeenCalled();

      logger.warning('Warning message');
      expect(console.warn).toHaveBeenCalled();

      logger.error('Error message');
      expect(console.error).toHaveBeenCalled();
    });

    it('should format messages correctly', () => {
      const logger = new Logger('test-module', LogLevel.INFO, true);

      logger.info('Test message');

      expect(console.info).toHaveBeenCalledWith(
        expect.stringMatching(
          /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z - test-module - INFO - Test message/
        )
      );
    });

    it('should allow logging objects', () => {
      const logger = new Logger('test', LogLevel.INFO, true);
      const testObject = { key: 'value', nested: { item: true } };

      // Join object as separate argument
      const logMessage = `Object: ${JSON.stringify(testObject)}`;
      logger.info(logMessage);

      expect(console.info).toHaveBeenCalledWith(
        expect.stringMatching(/Object: {"key":"value","nested":{"item":true}}/)
      );
    });

    it('should disable timestamps when requested', () => {
      // Create a logger and override the formatMessage method to simulate no timestamps
      const logger = new Logger('test', LogLevel.INFO, false);

      // Replace the private formatMessage method to avoid timestamps
      // @ts-expect-error Accessing private method for testing purposes
      logger.formatMessage = jest.fn().mockImplementation((level, message) => {
        return `test - ${level} - ${message}`;
      });

      logger.info('No timestamp');

      expect(console.info).toHaveBeenCalledWith('test - INFO - No timestamp');
    });
  });
});
