/**
 * BridgeIQ Client - Node.js client for ThakaaMed's imaging AI service.
 *
 * This library provides a simple, JavaScript/TypeScript interface to ThakaaMed's
 * radiography analysis API, allowing easy submission of images for AI analysis
 * and retrieval of reports.
 */

export { BridgeIQClient, AsyncBridgeIQClient } from './client';
export { Environment } from './environment';
export {
  AnalysisRequest,
  AnalysisStatus,
  AnalysisStatusEnum,
  ReportStatusEnum,
  PDFStatusEnum,
  AnalysisResult,
} from './models';
export {
  BridgeIQError,
  AuthenticationError,
  ConnectionError,
  TimeoutError,
  ResourceNotFoundError,
  ValidationError,
  InsufficientTokensError,
  ServerError,
  RateLimitError,
} from './exceptions';
export { Logger, LogLevel, getLogger } from './logger';

// Export hardcoded version - same as in utils.ts
export const VERSION = '1.0.0';
