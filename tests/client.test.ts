/// <reference types="jest" />

/**
 * Unit tests for the BridgeIQ client.
 */
import axios from 'axios';
import { BridgeIQClient, Environment, AsyncBridgeIQClient } from '../src';
import { AnalysisStatusEnum, PDFStatusEnum, ReportStatusEnum } from '../src/models';
import { TimeoutError } from '../src/exceptions';

// Mock axios
jest.mock('axios', () => {
  return {
    create: jest.fn().mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    }),
    isAxiosError: jest.fn().mockReturnValue(true),
  };
});

// Mock utils
jest.mock('../src/utils', () => {
  return {
    getUserAgent: jest.fn().mockReturnValue('BridgeIQ-Client/1.0.0'),
    getFileContent: jest.fn().mockReturnValue(Buffer.from('test image')),
    saveFile: jest.fn().mockImplementation((content, path) => path),
  };
});

describe('BridgeIQClient', () => {
  let client: BridgeIQClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize the client
    client = new BridgeIQClient(
      'test_client_id',
      'test_client_secret',
      'test_device_path',
      'https://api.example.com/api/v1',
      Environment.TESTING
    );

    // Get the mock axios instance
    mockAxiosInstance = (axios.create as jest.Mock).mock.results[0].value;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct parameters', () => {
      expect(client.clientId).toBe('test_client_id');
      expect(client.clientSecret).toBe('test_client_secret');
      expect(client.devicePath).toBe('test_device_path');
      expect(client.baseUrl).toBe('https://api.example.com/api/v1');
      expect(client.environment).toBe(Environment.TESTING);
    });

    it('should convert string environment to enum', () => {
      const clientWithStringEnv = new BridgeIQClient(
        'test_client_id',
        'test_client_secret',
        'test_device_path',
        'https://api.example.com/api/v1',
        'production'
      );

      expect(clientWithStringEnv.environment).toBe(Environment.PRODUCTION);
    });
  });

  describe('healthCheck', () => {
    it('should return true when API is healthy', async () => {
      // Mock successful response
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: { status: true },
      });

      const result = await client.healthCheck();

      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/utils/health-check/')
      );
    });

    it('should return false when API response is unhealthy', async () => {
      // Mock unhealthy response
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: { status: false },
      });

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });

    it('should return true when endpoint not found (404)', async () => {
      // Mock 404 response (endpoint not implemented)
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: { status: 404 },
      });

      const result = await client.healthCheck();

      expect(result).toBe(true);
    });

    it('should handle non-standard response format', async () => {
      // Mock response with non-standard format
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: true, // Direct boolean instead of object
      });

      const result = await client.healthCheck();

      expect(result).toBe(true);
    });
  });

  describe('sendAnalysis', () => {
    it('should send an image for analysis', async () => {
      // Mock successful response
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 200,
        data: {
          status: 'success',
          data: {
            analysis_id: 'test_analysis_id',
            request_id: 'test_request_id',
            radiography_type: 'panoramic_adult',
            token_cost: 10,
            patient_id: 'TEST-123',
            check_analysis_url: 'https://api.example.com/check/test_request_id',
          },
        },
      });

      const result = await client.sendAnalysis(
        Buffer.from('fake image data'),
        'TEST-123',
        'Test Patient',
        'M',
        '1990-01-01',
        'panoramic_adult'
      );

      expect(result).toBeDefined();
      expect(result.request_id).toBe('test_request_id');
      expect(result.radiography_type).toBe('panoramic_adult');
      expect(result.token_cost).toBe(10);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/webhooks/devices/test_device_path/requests`),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle API errors in success response', async () => {
      // Mock successful HTTP but error in JSON response
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 200,
        data: {
          status: 'error',
          message: 'Invalid image format',
        },
      });

      await expect(
        client.sendAnalysis(Buffer.from('invalid image data'), 'TEST-123')
      ).rejects.toThrow('Invalid image format');
    });

    it('should send analysis using file path', async () => {
      // Mock successful response
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 200,
        data: {
          status: 'success',
          data: {
            request_id: 'test_request_id',
            radiography_type: 'panoramic_adult',
          },
        },
      });

      const result = await client.sendAnalysis('/path/to/image.dcm', 'TEST-123');

      expect(result).toBeDefined();
      expect(result.request_id).toBe('test_request_id');
    });
  });

  describe('checkStatus', () => {
    it('should get analysis status', async () => {
      // Mock successful response
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: {
          status: 'success',
          data: {
            analysis_id: 'test_analysis_id',
            request_id: 'test_request_id',
            analysis_status: AnalysisStatusEnum.COMPLETED,
            report_status: ReportStatusEnum.COMPLETED,
            pdf_status: PDFStatusEnum.COMPLETED,
            report_pdf_link: 'https://api.example.com/report.pdf',
          },
        },
      });

      const result = await client.checkStatus('test_request_id');

      expect(result).toBeDefined();
      expect(result.analysis_status).toBe(AnalysisStatusEnum.COMPLETED);
      expect(result.isCompleted).toBe(true);
      expect(result.hasPdf).toBe(true);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining(
          `/api/v1/webhooks/devices/test_device_path/requests/test_request_id`
        ),
        expect.any(Object)
      );
    });

    it('should handle API errors in response', async () => {
      // Mock error response
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: {
          status: 'error',
          message: 'Request not found',
        },
      });

      await expect(client.checkStatus('invalid_id')).rejects.toThrow('Request not found');
    });
  });

  describe('waitForCompletion', () => {
    // Use jest.spyOn to mock Date.now more safely
    let dateNowSpy: jest.SpyInstance;

    beforeEach(() => {
      dateNowSpy = jest.spyOn(Date, 'now');
      // Use fake timers for consistent setTimeout behavior
      jest.useFakeTimers();
    });

    afterEach(() => {
      dateNowSpy.mockRestore();
    });

    it.skip('should wait for analysis to complete', async () => {
      // First call - processing
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: {
          status: 'success',
          data: {
            request_id: 'test_request_id',
            analysis_status: AnalysisStatusEnum.PROCESSING,
          },
        },
      });

      // Second call - completed
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: {
          status: 'success',
          data: {
            request_id: 'test_request_id',
            analysis_status: AnalysisStatusEnum.COMPLETED,
            report_status: ReportStatusEnum.COMPLETED,
            pdf_status: PDFStatusEnum.COMPLETED,
            report_pdf_link: 'https://api.example.com/report.pdf',
          },
        },
      });

      // Fix the starting time
      const startTime = 10000;
      dateNowSpy.mockReturnValue(startTime);

      // Start the completion promise but don't await it yet
      const completionPromise = client.waitForCompletion('test_request_id', 30000, 1000);

      // First check should show processing status
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);

      // Move time forward to trigger the setTimeout callback
      jest.advanceTimersByTime(1000);

      // Resolve the promise - we need a tick in the event loop after advancing timers
      const result = await completionPromise;

      expect(result).toBeDefined();
      expect(result.analysis_status).toBe(AnalysisStatusEnum.COMPLETED);
      expect(result.isCompleted).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it.skip('should handle failed analysis', async () => {
      // Mock a failed analysis response
      const failedResponse = {
        status: 200,
        data: {
          status: 'success',
          data: {
            request_id: 'test_request_id',
            analysis_status: AnalysisStatusEnum.FAILED,
            error_message: 'Analysis failed',
          },
        },
      };

      // Always return the failed response
      mockAxiosInstance.get.mockResolvedValue(failedResponse);

      // We don't need to advance timers since the first check should immediately return FAILED
      const result = await client.waitForCompletion('test_request_id');

      expect(result).toBeDefined();
      expect(result.analysis_status).toBe(AnalysisStatusEnum.FAILED);
      expect(result.isFailed).toBe(true);
      expect(result.error_message).toBe('Analysis failed');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    it.skip('should timeout if analysis takes too long', async () => {
      // Always return PROCESSING status
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: {
          status: 'success',
          data: {
            request_id: 'test_request_id',
            analysis_status: AnalysisStatusEnum.PROCESSING,
          },
        },
      });

      // Set initial time
      const startTime = 100000;
      dateNowSpy
        .mockReturnValueOnce(startTime) // First check for the while condition
        .mockReturnValueOnce(startTime) // When checking before the first API call
        .mockReturnValueOnce(startTime + 1000) // Before the second while loop check
        .mockReturnValueOnce(startTime + 6000); // The second check, now exceeding the timeout

      // Set a short timeout (5 seconds) for the test
      const completionPromise = client.waitForCompletion('test_request_id', 5000, 1000);

      // Run the first timer callback
      jest.advanceTimersByTime(1000);

      // The promise should now reject with a timeout error
      await expect(completionPromise).rejects.toThrow(TimeoutError);
    });
  });

  describe('downloadReport', () => {
    it('should download a report', async () => {
      const pdfData = Buffer.from('PDF content');

      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: pdfData,
      });

      const result = await client.downloadReport(
        'https://api.example.com/report.pdf',
        'report.pdf'
      );

      expect(result).toBe('report.pdf');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('https://api.example.com/report.pdf', {
        responseType: 'arraybuffer',
      });
    });

    it.skip('should handle relative URLs', async () => {
      // Mock the URL class to make the test predictable
      const originalURL = global.URL;

      // Create a custom implementation of URL.toString
      class MockURL {
        constructor(public path: string, public base: string) {}

        toString() {
          return `${this.base}/reports/report.pdf`;
        }
      }

      // Replace global URL with our mock
      global.URL = MockURL as any;

      // Mock the axios response
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: Buffer.from('PDF content'),
      });

      try {
        await client.downloadReport('/reports/report.pdf', 'report.pdf');

        expect(mockAxiosInstance.get).toHaveBeenCalledWith(
          'https://api.example.com/api/v1/reports/report.pdf',
          { responseType: 'arraybuffer' }
        );
      } finally {
        // Restore the original URL constructor
        global.URL = originalURL;
      }
    });
  });

  describe('AsyncBridgeIQClient', () => {
    it('should extend BridgeIQClient', () => {
      const asyncClient = new AsyncBridgeIQClient(
        'test_client_id',
        'test_client_secret',
        'test_device_path',
        'https://api.example.com/api/v1'
      );

      expect(asyncClient).toBeInstanceOf(BridgeIQClient);
      expect(asyncClient.clientId).toBe('test_client_id');
      expect(asyncClient.environment).toBe(Environment.PRODUCTION);
    });
  });
});
