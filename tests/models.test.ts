/// <reference types="jest" />

/**
 * Tests for the models module.
 */
import {
  AnalysisStatusEnum,
  ReportStatusEnum,
  PDFStatusEnum,
  AnalysisRequest,
  AnalysisStatus,
  AnalysisResult,
} from '../src/models';

describe('BridgeIQ Models', () => {
  describe('AnalysisRequest', () => {
    it('should create an AnalysisRequest instance', () => {
      const data = {
        analysis_id: 'test-analysis-id',
        request_id: '550e8400-e29b-41d4-a716-446655440000',
        radiography_type: 'panoramic_adult',
        token_cost: 10,
        patient_id: 'TEST-123',
        check_analysis_url: 'https://api.example.com/check/status',
      };

      const request = new AnalysisRequest(data);

      expect(request.analysis_id).toBe(data.analysis_id);
      expect(request.request_id).toBe(data.request_id);
      expect(request.radiography_type).toBe(data.radiography_type);
      expect(request.token_cost).toBe(data.token_cost);
      expect(request.patient_id).toBe(data.patient_id);
      expect(request.check_analysis_url).toBe(data.check_analysis_url);
      expect(request.uuid).toBe(data.request_id);
    });
  });

  describe('AnalysisStatus', () => {
    it('should determine status correctly', () => {
      const completedData = {
        analysis_id: 'test-analysis-id',
        request_id: 'test-request-id',
        radiography_type: 'panoramic_adult',
        created_at: '2023-01-01T12:00:00Z',
        updated_at: '2023-01-01T12:15:00Z',
        analysis_status: AnalysisStatusEnum.COMPLETED,
        report_id: 'test-report-id',
        report_status: ReportStatusEnum.COMPLETED,
        pdf_status: PDFStatusEnum.COMPLETED,
        report_pdf_link: 'https://api.example.com/report.pdf',
      };

      const status = new AnalysisStatus(completedData);

      expect(status.isCompleted).toBe(true);
      expect(status.isFailed).toBe(false);
      expect(status.isProcessing).toBe(false);
      expect(status.hasReport).toBe(true);
      expect(status.hasPdf).toBe(true);

      // Test Date conversion
      expect(status.createdDateTime instanceof Date).toBe(true);
      expect(status.updatedDateTime instanceof Date).toBe(true);
    });

    it('should handle failed status', () => {
      const failedData = {
        analysis_id: 'test-analysis-id',
        request_id: 'test-request-id',
        radiography_type: 'panoramic_adult',
        created_at: '2023-01-01T12:00:00Z',
        updated_at: '2023-01-01T12:15:00Z',
        analysis_status: AnalysisStatusEnum.FAILED,
        error_message: 'Analysis failed',
      };

      const status = new AnalysisStatus(failedData);

      expect(status.isCompleted).toBe(false);
      expect(status.isFailed).toBe(true);
      expect(status.isProcessing).toBe(false);
      expect(status.hasReport).toBe(false);
      expect(status.hasPdf).toBe(false);
      expect(status.error_message).toBe('Analysis failed');
    });

    it('should handle processing status', () => {
      const processingData = {
        analysis_id: 'test-analysis-id',
        request_id: 'test-request-id',
        radiography_type: 'panoramic_adult',
        created_at: '2023-01-01T12:00:00Z',
        updated_at: '2023-01-01T12:15:00Z',
        analysis_status: AnalysisStatusEnum.PROCESSING,
      };

      const status = new AnalysisStatus(processingData);

      expect(status.isCompleted).toBe(false);
      expect(status.isFailed).toBe(false);
      expect(status.isProcessing).toBe(true);
      expect(status.hasReport).toBe(false);
      expect(status.hasPdf).toBe(false);
    });
  });

  describe('AnalysisResult', () => {
    it('should create an AnalysisResult instance', () => {
      const data = {
        analysis_id: 'test-analysis-id',
        result_data: {
          findings: ['Finding 1', 'Finding 2'],
          confidence: 0.95,
        },
        created_at: '2023-01-01T12:00:00Z',
      };

      const result = new AnalysisResult(data);

      expect(result.analysis_id).toBe(data.analysis_id);
      expect(result.result_data).toEqual(data.result_data);
      expect(result.created_at).toBe(data.created_at);
      expect(result.createdDateTime instanceof Date).toBe(true);
    });
  });
});
