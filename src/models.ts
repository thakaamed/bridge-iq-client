/**
 * Data models for the BridgeIQ client.
 *
 * This module provides interfaces and classes for the BridgeIQ API responses
 * and request data.
 */

/**
 * Enum for analysis status values.
 */
export enum AnalysisStatusEnum {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  MANUAL_COMPLETED = 'MANUAL_COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Enum for report status values.
 */
export enum ReportStatusEnum {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Enum for PDF status values.
 */
export enum PDFStatusEnum {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Interface for an analysis request response.
 */
export interface IAnalysisRequest {
  /** Unique identifier for the analysis (UUID) */
  analysis_id: string;

  /** Unique identifier for the request (UUID) */
  request_id: string;

  /** Type of radiography that was analyzed */
  radiography_type: string;

  /** Number of tokens consumed by this analysis */
  token_cost: number;

  /** Your provided patient identifier */
  patient_id?: string;

  /** URL to check the status of the analysis */
  check_analysis_url: string;
}

/**
 * Model for an analysis request response.
 */
export class AnalysisRequest implements IAnalysisRequest {
  analysis_id: string;
  request_id: string;
  radiography_type: string;
  token_cost: number;
  patient_id?: string;
  check_analysis_url: string;

  /**
   * Create a new AnalysisRequest instance.
   *
   * @param data - Analysis request data from API
   */
  constructor(data: IAnalysisRequest) {
    this.analysis_id = data.analysis_id;
    this.request_id = data.request_id;
    this.radiography_type = data.radiography_type;
    this.token_cost = data.token_cost;
    this.patient_id = data.patient_id;
    this.check_analysis_url = data.check_analysis_url;
  }

  /**
   * Get the UUID representation of the request ID.
   */
  get uuid(): string {
    return this.request_id;
  }
}

/**
 * Interface for an analysis status response.
 */
export interface IAnalysisStatus {
  /** Unique identifier for the analysis (UUID) */
  analysis_id: string;

  /** Unique identifier for the request (UUID) */
  request_id: string;

  /** Type of radiography that was analyzed */
  radiography_type: string;

  /** Your provided patient identifier */
  patient_id?: string;

  /** ISO-8601 timestamp when the analysis request was created */
  created_at: string;

  /** ISO-8601 timestamp when the analysis was last updated */
  updated_at: string;

  /** Current status of the analysis */
  analysis_status: string;

  /** Error message if analysis failed */
  error_message?: string;

  /** Unique identifier for the generated report (UUID) */
  report_id?: string;

  /** Status of the report generation */
  report_status?: string;

  /** Status of the PDF generation */
  pdf_status?: string;

  /** URL to download the PDF report */
  report_pdf_link?: string;

  /** Error message if report generation failed */
  report_error?: string;
}

/**
 * Model for an analysis status response.
 */
export class AnalysisStatus implements IAnalysisStatus {
  analysis_id: string;
  request_id: string;
  radiography_type: string;
  patient_id?: string;
  created_at: string;
  updated_at: string;
  analysis_status: string;
  error_message?: string;
  report_id?: string;
  report_status?: string;
  pdf_status?: string;
  report_pdf_link?: string;
  report_error?: string;

  /**
   * Create a new AnalysisStatus instance.
   *
   * @param data - Analysis status data from API
   */
  constructor(data: IAnalysisStatus) {
    this.analysis_id = data.analysis_id;
    this.request_id = data.request_id;
    this.radiography_type = data.radiography_type;
    this.patient_id = data.patient_id;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.analysis_status = data.analysis_status;
    this.error_message = data.error_message;
    this.report_id = data.report_id;
    this.report_status = data.report_status;
    this.pdf_status = data.pdf_status;
    this.report_pdf_link = data.report_pdf_link;
    this.report_error = data.report_error;
  }

  /**
   * Check if the analysis is complete and successful.
   */
  get isCompleted(): boolean {
    return (
      this.analysis_status === AnalysisStatusEnum.COMPLETED ||
      this.analysis_status === AnalysisStatusEnum.MANUAL_COMPLETED
    );
  }

  /**
   * Check if the analysis has failed.
   */
  get isFailed(): boolean {
    return this.analysis_status === AnalysisStatusEnum.FAILED;
  }

  /**
   * Check if the analysis is still processing.
   */
  get isProcessing(): boolean {
    return (
      this.analysis_status === AnalysisStatusEnum.PENDING ||
      this.analysis_status === AnalysisStatusEnum.PROCESSING
    );
  }

  /**
   * Check if the analysis has a report.
   */
  get hasReport(): boolean {
    return this.report_id !== undefined && this.report_id !== null;
  }

  /**
   * Check if the analysis has a PDF report available for download.
   *
   * Note: PDF generation happens asynchronously after the analysis completes.
   * The analysis might be complete (isCompleted returns true), but the PDF
   * might still be pending or processing. You may need to poll for status
   * changes until pdf_status === PDFStatusEnum.COMPLETED.
   */
  get hasPdf(): boolean {
    return (
      this.report_pdf_link !== undefined &&
      this.report_pdf_link !== null &&
      this.pdf_status === PDFStatusEnum.COMPLETED
    );
  }

  /**
   * Check if a PDF report generation is in progress.
   *
   * @returns true if a PDF is being generated but not yet completed
   */
  get isPdfProcessing(): boolean {
    return (
      this.pdf_status === PDFStatusEnum.PENDING || this.pdf_status === PDFStatusEnum.PROCESSING
    );
  }

  /**
   * Get the created_at timestamp as a Date object.
   */
  get createdDateTime(): Date {
    return new Date(this.created_at);
  }

  /**
   * Get the updated_at timestamp as a Date object.
   */
  get updatedDateTime(): Date {
    return new Date(this.updated_at);
  }
}

/**
 * Interface for a complete analysis result.
 */
export interface IAnalysisResult {
  /** Unique identifier for the analysis (UUID) */
  analysis_id: string;

  /** Complete analysis result data */
  result_data: Record<string, any>;

  /** ISO-8601 timestamp when the analysis result was created */
  created_at: string;
}

/**
 * Model for a complete analysis result.
 */
export class AnalysisResult implements IAnalysisResult {
  analysis_id: string;
  result_data: Record<string, any>;
  created_at: string;

  /**
   * Create a new AnalysisResult instance.
   *
   * @param data - Analysis result data from API
   */
  constructor(data: IAnalysisResult) {
    this.analysis_id = data.analysis_id;
    this.result_data = data.result_data;
    this.created_at = data.created_at;
  }

  /**
   * Get the created_at timestamp as a Date object.
   */
  get createdDateTime(): Date {
    return new Date(this.created_at);
  }
}
