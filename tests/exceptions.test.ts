/// <reference types="jest" />

/**
 * Tests for the exceptions module.
 */
import {
  BridgeIQError,
  AuthenticationError,
  ConnectionError,
  TimeoutError,
  ResourceNotFoundError,
  ValidationError,
  InsufficientTokensError,
  ServerError,
  RateLimitError,
} from '../src/exceptions';

describe('BridgeIQ Exceptions', () => {
  describe('BridgeIQError', () => {
    it('should create a basic error with message', () => {
      const error = new BridgeIQError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('BridgeIQError');
      expect(error.response).toBeUndefined();
      expect(error.statusCode).toBeUndefined();
    });

    it('should create an error with response data and status code', () => {
      const responseData = { error: 'test_error', details: 'Test details' };
      const error = new BridgeIQError('Test error', responseData, 500);

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('BridgeIQError');
      expect(error.response).toEqual(responseData);
      expect(error.statusCode).toBe(500);
    });
  });

  describe('AuthenticationError', () => {
    it('should create an authentication error', () => {
      const error = new AuthenticationError('Authentication failed');

      expect(error.message).toBe('Authentication failed');
      expect(error.name).toBe('AuthenticationError');
      expect(error instanceof BridgeIQError).toBe(true);
    });
  });

  describe('ConnectionError', () => {
    it('should create a connection error', () => {
      const error = new ConnectionError('Connection failed');

      expect(error.message).toBe('Connection failed');
      expect(error.name).toBe('ConnectionError');
      expect(error instanceof BridgeIQError).toBe(true);
    });
  });

  describe('TimeoutError', () => {
    it('should create a timeout error', () => {
      const error = new TimeoutError('Request timed out');

      expect(error.message).toBe('Request timed out');
      expect(error.name).toBe('TimeoutError');
      expect(error instanceof BridgeIQError).toBe(true);
    });
  });

  describe('ResourceNotFoundError', () => {
    it('should create a resource not found error', () => {
      const error = new ResourceNotFoundError('Resource not found');

      expect(error.message).toBe('Resource not found');
      expect(error.name).toBe('ResourceNotFoundError');
      expect(error instanceof BridgeIQError).toBe(true);
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error with field', () => {
      const error = new ValidationError('Validation failed', 'patient_id');

      expect(error.message).toBe('Validation failed');
      expect(error.name).toBe('ValidationError');
      expect(error.field).toBe('patient_id');
      expect(error instanceof BridgeIQError).toBe(true);
    });
  });

  describe('InsufficientTokensError', () => {
    it('should create an insufficient tokens error', () => {
      const error = new InsufficientTokensError('Not enough tokens');

      expect(error.message).toBe('Not enough tokens');
      expect(error.name).toBe('InsufficientTokensError');
      expect(error instanceof BridgeIQError).toBe(true);
    });
  });

  describe('ServerError', () => {
    it('should create a server error', () => {
      const error = new ServerError('Internal server error');

      expect(error.message).toBe('Internal server error');
      expect(error.name).toBe('ServerError');
      expect(error instanceof BridgeIQError).toBe(true);
    });
  });

  describe('RateLimitError', () => {
    it('should create a rate limit error with retry after', () => {
      const error = new RateLimitError('Rate limit exceeded', 30);

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.name).toBe('RateLimitError');
      expect(error.retryAfter).toBe(30);
      expect(error instanceof BridgeIQError).toBe(true);
    });
  });
});
