/**
 * Unit tests for the BridgeIQ client.
 */
import axios from 'axios';
import { BridgeIQClient, Environment } from '../src';

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
      
      // Mock fs module for image reading
      jest.mock('fs', () => ({
        existsSync: jest.fn().mockReturnValue(true),
        readFileSync: jest.fn().mockReturnValue(Buffer.from('fake image data')),
      }));
      
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
  });
}); 