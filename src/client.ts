/**
 * Main client implementation for the BridgeIQ API.
 *
 * This module provides the main client classes for interacting with the
 * BridgeIQ API, including both synchronous and asynchronous implementations.
 */
import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import path from 'path';
import { URL } from 'url';

import { Environment, fromString } from './environment';
import {
  AuthenticationError,
  BridgeIQError,
  ConnectionError,
  InsufficientTokensError,
  ResourceNotFoundError,
  TimeoutError,
  ValidationError,
} from './exceptions';
import { Logger, getLogger } from './logger';
import { AnalysisRequest, AnalysisStatus } from './models';
import { getFileContent, getUserAgent, saveFile } from './utils';

/**
 * Client for the BridgeIQ API.
 *
 * This client provides methods for interacting with the BridgeIQ API,
 * including sending images for analysis and checking the status of
 * analysis requests.
 */
export class BridgeIQClient {
  /**
   * Client ID for authentication
   */
  public readonly clientId: string;

  /**
   * Client secret for authentication
   */
  public readonly clientSecret: string;

  /**
   * Device path for API routes
   */
  public readonly devicePath: string;

  /**
   * Base URL for API requests
   */
  public readonly baseUrl: string;

  /**
   * API environment
   */
  public readonly environment: Environment;

  /**
   * Request timeout in milliseconds
   */
  public readonly timeout: number;

  /**
   * Logger instance
   */
  private readonly logger: Logger;

  /**
   * HTTP client instance
   */
  private readonly axiosInstance: AxiosInstance;

  /**
   * User agent string
   */
  public readonly userAgent: string;

  /**
   * Initialize the BridgeIQ client.
   *
   * @param clientId - Client ID for authentication
   * @param clientSecret - Client secret for authentication
   * @param devicePath - Device path for API routes
   * @param baseUrl - Base URL for API requests
   * @param environment - API environment to use
   * @param timeout - Request timeout in milliseconds
   * @param maxRetries - Maximum number of retries for failed requests
   * @param logger - Optional custom logger instance
   */
  constructor(
    clientId: string,
    clientSecret: string,
    devicePath: string,
    baseUrl: string,
    environment: Environment | string = Environment.PRODUCTION,
    timeout = 120000,
    maxRetries = 3,
    logger?: Logger
  ) {
    // API credentials and settings
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.devicePath = devicePath;
    this.baseUrl = baseUrl;

    // Convert string to Environment enum if needed
    if (typeof environment === 'string') {
      this.environment = fromString(environment);
    } else {
      this.environment = environment;
    }

    this.timeout = timeout;

    // Configure logging
    this.logger = logger || getLogger();

    // Set default headers
    this.userAgent = getUserAgent();

    // Create axios instance with retry logic
    this.axiosInstance = axios.create({
      timeout: this.timeout,
      headers: {
        'User-Agent': this.userAgent,
      },
    });

    // Add request interceptor for authentication
    this.axiosInstance.interceptors.request.use(config => {
      config.headers = config.headers || {};
      config.headers['client-id'] = this.clientId;
      config.headers['client-secret'] = this.clientSecret;
      return config;
    });

    // Add response interceptor for basic retry logic
    this.axiosInstance.interceptors.response.use(
      response => response,
      async error => {
        // Only retry on network errors and 5xx responses
        if (!error.response || (error.response.status >= 500 && error.response.status < 600)) {
          const config = error.config;

          // Initialize retry count if not present
          config.__retryCount = config.__retryCount || 0;

          // Check if we've maxed out the total number of retries
          if (config.__retryCount < maxRetries) {
            // Increase retry count
            config.__retryCount += 1;

            // Calculate delay with exponential backoff
            const delay = Math.pow(2, config.__retryCount) * 100;

            this.logger.debug(
              `Retrying request to ${config.url} (attempt ${config.__retryCount}/${maxRetries}) after ${delay}ms`
            );

            // Delay using setTimeout
            await new Promise(resolve => setTimeout(resolve, delay));

            // Return the axios instance to retry the request
            return this.axiosInstance(config);
          }
        }

        // If retrying is not possible or we've maxed out retries, reject the promise
        return Promise.reject(error);
      }
    );

    // Log initialization
    this.logger.info(
      `BridgeIQ client initialized for device ${devicePath} ` +
        `in ${this.environment} environment using ${baseUrl}`
    );
  }

  /**
   * Get headers for API requests.
   *
   * @returns Headers dictionary with authentication and user agent
   */
  private getHeaders(): Record<string, string> {
    return {
      'User-Agent': this.userAgent,
      'client-id': this.clientId,
      'client-secret': this.clientSecret,
    };
  }

  /**
   * Handle error responses from the API.
   *
   * @param error - Error object from failed request
   * @param context - Context string for logging
   * @throws Appropriate exception based on response status and content
   */
  private handleErrorResponse(error: any, context = ''): never {
    // Get response data if available
    let message = 'Unknown error';
    let data: Record<string, any> = { message };
    let statusCode: number | undefined;

    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      statusCode = error.response.status;

      try {
        data = error.response.data;
        message = data.message || `HTTP Error ${statusCode}`;
      } catch (e) {
        message = error.response.statusText || `HTTP Error ${statusCode}`;
        data = { message };
      }
    } else if (error.request) {
      // The request was made but no response was received
      message = 'No response received from server';
      data = { message };
    } else {
      // Something happened in setting up the request that triggered an Error
      message = error.message || 'Unknown error';
      data = { message };
    }

    // Log the error response
    this.logger.error(`API error (${statusCode || 'unknown'}) during ${context}: ${message}`);

    // Raise appropriate exception based on status code
    if (statusCode === 401) {
      throw new AuthenticationError(`Authentication failed: ${message}`, data, statusCode);
    } else if (statusCode === 402) {
      throw new InsufficientTokensError(`Insufficient tokens: ${message}`, data, statusCode);
    } else if (statusCode === 404) {
      throw new ResourceNotFoundError(`Resource not found: ${message}`, data, statusCode);
    } else if (statusCode === 400) {
      throw new ValidationError(`Validation error: ${message}`, undefined, data, statusCode);
    } else if (statusCode === 408 || statusCode === 504) {
      throw new TimeoutError(`Request timed out: ${message}`, data, statusCode);
    } else if (statusCode && statusCode >= 500 && statusCode < 600) {
      // Server errors
      throw new BridgeIQError(`Server error (${statusCode}): ${message}`, data, statusCode);
    } else {
      // General error catch-all
      throw new BridgeIQError(
        `API error (${statusCode || 'unknown'}): ${message}`,
        data,
        statusCode
      );
    }
  }

  /**
   * Check if the API is available and functioning.
   *
   * @returns True if the API is healthy, False otherwise
   * @throws ConnectionError if the API request fails due to connection issues
   */
  public healthCheck(): Promise<boolean> {
    this.logger.info('Checking API health');

    // Prepare request
    const url = new URL('/api/v1/utils/health-check/', this.baseUrl).toString();

    return this.axiosInstance
      .get(url)
      .then(response => {
        // Parse response
        if (response.status === 200) {
          try {
            const data = response.data;

            // Check if the response has a 'status' field
            if (typeof data === 'object' && data !== null && 'status' in data) {
              const isHealthy = Boolean(data.status);
              this.logger.info(`API health check result: ${isHealthy}`);
              return isHealthy;
            } else {
              // If no status field or data is not an object, check if data itself is a boolean
              const isHealthy = data !== null ? Boolean(data) : false;
              this.logger.info(`API health check result: ${isHealthy}`);
              return isHealthy;
            }
          } catch (error) {
            this.logger.warning(
              `API health check returned unexpected response format: ${response.data}`
            );
            return false;
          }
        } else {
          this.logger.warning(`API health check failed with status code ${response.status}`);
          return false;
        }
      })
      .catch(error => {
        if (error.response && error.response.status === 404) {
          this.logger.warning('Health check endpoint not found. API might still be functional.');
          // Return true as this is an expected response
          return true;
        }

        const message = `Connection error during health check: ${error.message}`;
        this.logger.error(message);

        // Only throw for connection errors, otherwise return false
        if (!error.response) {
          throw new ConnectionError(message);
        }

        return false;
      });
  }

  /**
   * Send an image for analysis.
   *
   * @param imagePath - Path to the image file or raw image bytes
   * @param patientId - Optional patient identifier
   * @param patientName - Optional patient name
   * @param patientGender - Optional patient gender ('M' or 'F')
   * @param patientDob - Optional patient date of birth (YYYY-MM-DD)
   * @param radiographyType - Optional radiography type override
   * @param callbackUrl - Optional URL to notify when analysis is complete
   * @param reportType - Type of report to generate (default: standard)
   * @returns AnalysisRequest object with request information
   * @throws ConnectionError if the API request fails due to connection issues
   * @throws ValidationError if the request parameters are invalid
   * @throws AuthenticationError if authentication fails
   * @throws InsufficientTokensError if account doesn't have enough tokens
   * @throws BridgeIQError for other API errors
   */
  public async sendAnalysis(
    imagePath: string | Buffer,
    patientId?: string,
    patientName?: string,
    patientGender?: string,
    patientDob?: string,
    radiographyType?: string,
    callbackUrl?: string,
    reportType = 'standard'
  ): Promise<AnalysisRequest> {
    // Prepare and validate image data
    let imageData: Buffer;
    let imageFilename: string;

    if (typeof imagePath === 'string') {
      this.logger.info(`Reading image from ${imagePath}`);
      imageData = getFileContent(imagePath);
      imageFilename = path.basename(imagePath);
    } else {
      this.logger.info('Using provided image data');
      imageData = imagePath;
      imageFilename = 'image.dcm';
    }

    // Prepare form data
    const formData = new FormData();
    formData.append('image', imageData, imageFilename);
    formData.append('report_type', reportType);

    // Add optional parameters if provided
    if (radiographyType) {
      formData.append('radiography_type', radiographyType);
    }
    if (patientId) {
      formData.append('patient_id', patientId);
    }
    if (patientName) {
      formData.append('patient_name', patientName);
    }
    if (patientGender) {
      formData.append('patient_gender', patientGender);
    }
    if (patientDob) {
      formData.append('patient_dob', patientDob);
    }
    if (callbackUrl) {
      formData.append('callback_url', callbackUrl);
    }

    // Prepare request
    const url = new URL(
      `/api/v1/webhooks/devices/${this.devicePath}/requests`,
      this.baseUrl
    ).toString();

    this.logger.info(
      `Sending analysis request for ${imageFilename}` +
        (radiographyType ? ` (type: ${radiographyType})` : '')
    );

    try {
      // Send request
      const response = await this.axiosInstance.post(url, formData, {
        headers: {
          ...this.getHeaders(),
          ...formData.getHeaders(),
        },
      });

      // Handle successful response
      if (response.status === 200) {
        const data = response.data;

        // Check for success status in JSON response
        if (data.status === 'success') {
          this.logger.info(`Analysis request submitted successfully: ${data.data?.request_id}`);
          return new AnalysisRequest(data.data);
        } else {
          // Handle API-level error in 200 response
          const message = data.message || 'Unknown error';
          this.logger.error(`API returned error: ${message}`);
          throw new BridgeIQError(message, data);
        }
      }

      // Handle unexpected success status codes
      this.logger.error(`Unexpected success status code: ${response.status}`);
      throw new BridgeIQError(`Unexpected status code: ${response.status}`, response.data);
    } catch (error) {
      if (error instanceof BridgeIQError) {
        // Re-throw BridgeIQError instances
        throw error;
      } else if (axios.isAxiosError(error)) {
        // Handle Axios errors
        this.handleErrorResponse(error, 'analysis request');
      } else {
        // Handle other errors
        const message = `Error during analysis request: ${
          error instanceof Error ? error.message : String(error)
        }`;
        this.logger.error(message);
        throw new BridgeIQError(message);
      }

      // This won't be reached due to the throw in handleErrorResponse,
      // but TypeScript needs it for type safety
      throw new BridgeIQError('Unreachable code');
    }
  }

  /**
   * Check the status of an analysis request.
   *
   * @param requestId - The analysis request ID
   * @returns AnalysisStatus object with status information
   * @throws ConnectionError if the API request fails due to connection issues
   * @throws ValidationError if the request parameters are invalid
   * @throws AuthenticationError if authentication fails
   * @throws ResourceNotFoundError if the analysis request doesn't exist
   * @throws BridgeIQError for other API errors
   */
  public async checkStatus(requestId: string): Promise<AnalysisStatus> {
    // Prepare request
    const url = new URL(
      `/api/v1/webhooks/devices/${this.devicePath}/requests/${requestId}`,
      this.baseUrl
    ).toString();

    this.logger.info(`Checking status for analysis request ${requestId}`);

    try {
      // Send request
      const response = await this.axiosInstance.get(url, {
        headers: this.getHeaders(),
      });

      // Handle successful response
      if (response.status === 200) {
        const data = response.data;

        // Check for success status in JSON response
        if (data.status === 'success') {
          this.logger.info(`Analysis status: ${data.data?.analysis_status}`);
          return new AnalysisStatus(data.data);
        } else {
          // Handle API-level error in 200 response
          const message = data.message || 'Unknown error';
          this.logger.error(`API returned error: ${message}`);
          throw new BridgeIQError(message, data);
        }
      }

      // Handle unexpected success status codes
      this.logger.error(`Unexpected success status code: ${response.status}`);
      throw new BridgeIQError(`Unexpected status code: ${response.status}`, response.data);
    } catch (error) {
      if (error instanceof BridgeIQError) {
        // Re-throw BridgeIQError instances
        throw error;
      } else if (axios.isAxiosError(error)) {
        // Handle Axios errors
        this.handleErrorResponse(error, 'status check');
      } else {
        // Handle other errors
        const message = `Error during status check: ${
          error instanceof Error ? error.message : String(error)
        }`;
        this.logger.error(message);
        throw new BridgeIQError(message);
      }

      // This won't be reached due to the throw in handleErrorResponse,
      // but TypeScript needs it for type safety
      throw new BridgeIQError('Unreachable code');
    }
  }

  /**
   * Wait for an analysis to complete.
   *
   * @param requestId - The analysis request ID
   * @param timeout - Maximum time to wait in milliseconds
   * @param pollInterval - Time between status checks in milliseconds
   * @returns Final AnalysisStatus object
   * @throws TimeoutError if the analysis doesn't complete within the timeout
   * @throws Same exceptions as checkStatus()
   */
  public async waitForCompletion(
    requestId: string,
    timeout = 300000,
    pollInterval = 5000
  ): Promise<AnalysisStatus> {
    const startTime = Date.now();
    const endTime = startTime + timeout;

    this.logger.info(
      `Waiting for analysis ${requestId} to complete ` +
        `(timeout: ${timeout / 1000}s, poll interval: ${pollInterval / 1000}s)`
    );

    while (Date.now() < endTime) {
      // Check status
      const status = await this.checkStatus(requestId);

      // If completed or failed, return status
      if (status.isCompleted || status.isFailed) {
        this.logger.info(`Analysis ${requestId} finished with status: ${status.analysis_status}`);
        return status;
      }

      // If still processing, wait and try again
      this.logger.debug(
        `Analysis ${requestId} still processing. ` + `Waiting ${pollInterval / 1000} seconds...`
      );
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // If we get here, the timeout was reached
    const elapsed = (Date.now() - startTime) / 1000;
    const message = `Timeout waiting for analysis to complete (${elapsed.toFixed(1)}s elapsed)`;
    this.logger.error(message);
    throw new TimeoutError(message);
  }

  /**
   * Download a PDF report.
   *
   * @param reportUrl - URL to the PDF report
   * @param outputPath - Path where the PDF should be saved
   * @returns Path to the saved PDF file
   * @throws ConnectionError if the download fails due to connection issues
   * @throws ResourceNotFoundError if the report doesn't exist
   * @throws BridgeIQError for other API errors
   */
  public async downloadReport(reportUrl: string, outputPath: string): Promise<string> {
    this.logger.info(`Downloading report from ${reportUrl}`);

    // Determine if we need to use a full URL or just the path
    const url = reportUrl.startsWith('http')
      ? reportUrl
      : new URL(reportUrl.replace(/^\//, ''), this.baseUrl).toString();

    try {
      // Send request
      const response = await this.axiosInstance.get(url, {
        responseType: 'arraybuffer',
      });

      // Handle successful response
      if (response.status === 200) {
        // Save the PDF
        const pdfPath = saveFile(Buffer.from(response.data), outputPath);
        this.logger.info(`Report saved to ${pdfPath}`);
        return pdfPath;
      }

      // Handle unexpected success status codes
      this.logger.error(`Unexpected success status code: ${response.status}`);
      throw new BridgeIQError(`Unexpected status code: ${response.status}`, response.data);
    } catch (error) {
      if (error instanceof BridgeIQError) {
        // Re-throw BridgeIQError instances
        throw error;
      } else if (axios.isAxiosError(error)) {
        // Handle Axios errors
        this.handleErrorResponse(error, 'report download');
      } else {
        // Handle other errors
        const message = `Error during report download: ${
          error instanceof Error ? error.message : String(error)
        }`;
        this.logger.error(message);
        throw new BridgeIQError(message);
      }

      // This won't be reached due to the throw in handleErrorResponse,
      // but TypeScript needs it for type safety
      throw new BridgeIQError('Unreachable code');
    }
  }
}

/**
 * Asynchronous client for the BridgeIQ API.
 *
 * This client provides asynchronous methods for interacting with the
 * BridgeIQ API, with the same interface as the regular client.
 *
 * Note: In most Node.js applications, the regular client already uses
 * promises and can be used with async/await. This specific async client
 * is provided for consistency with the Python library.
 */
export class AsyncBridgeIQClient extends BridgeIQClient {
  /**
   * Initialize the async BridgeIQ client.
   *
   * @param clientId - Client ID for authentication
   * @param clientSecret - Client secret for authentication
   * @param devicePath - Device path for API routes
   * @param baseUrl - Base URL for API requests
   * @param environment - API environment to use
   * @param timeout - Request timeout in milliseconds
   * @param maxRetries - Maximum number of retries for failed requests
   * @param logger - Optional custom logger instance
   */
  constructor(
    clientId: string,
    clientSecret: string,
    devicePath: string,
    baseUrl: string,
    environment: Environment | string = Environment.PRODUCTION,
    timeout = 120000,
    maxRetries = 3,
    logger?: Logger
  ) {
    super(clientId, clientSecret, devicePath, baseUrl, environment, timeout, maxRetries, logger);
  }

  // Note: Since the base client already uses Promises, we inherit all methods
  // and they are already async. We're providing this class for API compatibility
  // with the Python library.
}
