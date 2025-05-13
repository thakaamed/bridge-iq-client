/**
 * Custom exceptions for the BridgeIQ client.
 * 
 * This module provides a hierarchy of exceptions for handling various
 * error conditions when interacting with the ThakaaMed API.
 */

// Define the type for Error constructor with captureStackTrace
interface ErrorConstructor {
  captureStackTrace?(error: Error, constructor: Function): void;
}

/**
 * Base exception for all BridgeIQ client errors.
 */
export class BridgeIQError extends Error {
  /** Original API response data */
  response?: Record<string, any>;
  
  /** HTTP status code if applicable */
  statusCode?: number;
  
  /**
   * Initialize the exception.
   * 
   * @param message - Error message
   * @param response - Optional API response data
   * @param statusCode - Optional HTTP status code
   */
  constructor(
    message: string, 
    response?: Record<string, any>,
    statusCode?: number
  ) {
    super(message);
    this.name = 'BridgeIQError';
    this.response = response;
    this.statusCode = statusCode;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    // Use type assertion to satisfy TypeScript
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, BridgeIQError);
    }
  }
}

/**
 * Exception raised for authentication failures.
 */
export class AuthenticationError extends BridgeIQError {
  constructor(
    message: string, 
    response?: Record<string, any>,
    statusCode?: number
  ) {
    super(message, response, statusCode);
    this.name = 'AuthenticationError';
  }
}

/**
 * Exception raised for network connection failures.
 */
export class ConnectionError extends BridgeIQError {
  constructor(
    message: string, 
    response?: Record<string, any>,
    statusCode?: number
  ) {
    super(message, response, statusCode);
    this.name = 'ConnectionError';
  }
}

/**
 * Exception raised when a request times out.
 */
export class TimeoutError extends BridgeIQError {
  constructor(
    message: string, 
    response?: Record<string, any>,
    statusCode?: number
  ) {
    super(message, response, statusCode);
    this.name = 'TimeoutError';
  }
}

/**
 * Exception raised when a requested resource is not found.
 */
export class ResourceNotFoundError extends BridgeIQError {
  constructor(
    message: string, 
    response?: Record<string, any>,
    statusCode?: number
  ) {
    super(message, response, statusCode);
    this.name = 'ResourceNotFoundError';
  }
}

/**
 * Exception raised for invalid input parameters.
 */
export class ValidationError extends BridgeIQError {
  /** Field that failed validation, if applicable */
  field?: string;
  
  /**
   * Initialize the validation error.
   * 
   * @param message - Error message
   * @param field - Optional field name that failed validation
   * @param response - Optional API response data
   * @param statusCode - Optional HTTP status code
   */
  constructor(
    message: string,
    field?: string, 
    response?: Record<string, any>,
    statusCode?: number
  ) {
    super(message, response, statusCode);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Exception raised when the account doesn't have enough tokens.
 */
export class InsufficientTokensError extends BridgeIQError {
  constructor(
    message: string, 
    response?: Record<string, any>,
    statusCode?: number
  ) {
    super(message, response, statusCode);
    this.name = 'InsufficientTokensError';
  }
}

/**
 * Exception raised for server-side errors.
 */
export class ServerError extends BridgeIQError {
  constructor(
    message: string, 
    response?: Record<string, any>,
    statusCode?: number
  ) {
    super(message, response, statusCode);
    this.name = 'ServerError';
  }
}

/**
 * Exception raised when API rate limits are exceeded.
 */
export class RateLimitError extends BridgeIQError {
  /** Seconds to wait before retrying */
  retryAfter?: number;
  
  /**
   * Initialize the rate limit error.
   * 
   * @param message - Error message
   * @param retryAfter - Seconds to wait before retrying
   * @param response - Optional API response data
   * @param statusCode - Optional HTTP status code
   */
  constructor(
    message: string,
    retryAfter?: number, 
    response?: Record<string, any>,
    statusCode?: number
  ) {
    super(message, response, statusCode);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
} 