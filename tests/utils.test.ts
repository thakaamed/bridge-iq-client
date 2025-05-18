/// <reference types="jest" />

/**
 * Tests for the utility functions.
 */
import fs from 'fs';
import { getUserAgent, getFileContent, saveFile } from '../src/utils';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

describe('Utility Functions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserAgent', () => {
    it('should return a valid user agent string', () => {
      const userAgent = getUserAgent();

      expect(typeof userAgent).toBe('string');
      expect(userAgent).toContain('BridgeIQ-Client');
      expect(userAgent).toContain('Machine/');
    });
  });

  describe('getFileContent', () => {
    it('should read file content successfully', () => {
      const testFilePath = '/path/to/test.dcm';
      const mockContent = Buffer.from('test file content');

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockContent);

      const result = getFileContent(testFilePath);

      expect(fs.existsSync).toHaveBeenCalledWith(testFilePath);
      expect(fs.readFileSync).toHaveBeenCalledWith(testFilePath);
      expect(result).toBe(mockContent);
    });

    it('should throw error if file does not exist', () => {
      const testFilePath = '/path/to/nonexistent.dcm';

      (fs.existsSync as jest.Mock).mockReturnValue(false);

      expect(() => {
        getFileContent(testFilePath);
      }).toThrow(`File not found: ${testFilePath}`);

      expect(fs.existsSync).toHaveBeenCalledWith(testFilePath);
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });
  });

  describe('saveFile', () => {
    it('should save file with content', () => {
      const testContent = Buffer.from('test content');
      const outputPath = '/path/to/output/test.pdf';
      const outputDir = '/path/to/output';

      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = saveFile(testContent, outputPath);

      expect(fs.existsSync).toHaveBeenCalledWith(outputDir);
      expect(fs.mkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalledWith(outputPath, testContent);
      expect(result).toBe(outputPath);
    });

    it('should not create directory if it already exists', () => {
      const testContent = Buffer.from('test content');
      const outputPath = '/path/to/existing/test.pdf';
      const outputDir = '/path/to/existing';

      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = saveFile(testContent, outputPath);

      expect(fs.existsSync).toHaveBeenCalledWith(outputDir);
      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledWith(outputPath, testContent);
      expect(result).toBe(outputPath);
    });
  });
});
