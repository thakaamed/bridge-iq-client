/**
 * PDF wait test script for the BridgeIQ client library.
 * 
 * This script demonstrates how to wait for PDF generation after analysis
 * is completed.
 */
const fs = require('fs');
const path = require('path');
const { BridgeIQClient, LogLevel, getLogger, PDFStatusEnum } = require('../dist');

// Configure logging
const logger = getLogger('pdf-wait-test', LogLevel.DEBUG);

/**
 * Wait for PDF generation to complete
 * 
 * @param {BridgeIQClient} client - The BridgeIQ client
 * @param {string} requestId - The analysis request ID
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @param {number} pollInterval - Time between status checks in milliseconds
 * @returns {Promise<object>} - The analysis status with PDF link
 */
async function waitForPdf(client, requestId, timeout = 300000, pollInterval = 5000) {
  const startTime = Date.now();
  const endTime = startTime + timeout;
  
  logger.info(`Waiting for PDF generation for analysis ${requestId} to complete ` +
              `(timeout: ${timeout / 1000}s, poll interval: ${pollInterval / 1000}s)`);
  
  while (Date.now() < endTime) {
    // Check status
    const status = await client.checkStatus(requestId);
    
    logger.info(`PDF status: ${status.pdf_status || 'Not started'}, ` +
                `Report status: ${status.report_status || 'Not started'}`);
    
    // If PDF is completed, return the status
    if (status.pdf_status === PDFStatusEnum.COMPLETED && status.report_pdf_link) {
      logger.info(`PDF generation for ${requestId} completed with URL: ${status.report_pdf_link}`);
      return status;
    }
    
    // If PDF generation failed, throw an error
    if (status.pdf_status === PDFStatusEnum.FAILED) {
      throw new Error(`PDF generation failed: ${status.report_error || 'Unknown error'}`);
    }
    
    // If still processing, wait and try again
    logger.debug(`PDF generation for ${requestId} still in progress. ` +
                 `Status: ${status.pdf_status || 'Not started'}. ` +
                 `Waiting ${pollInterval / 1000} seconds...`);
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  // If we get here, the timeout was reached
  const elapsed = (Date.now() - startTime) / 1000;
  throw new Error(`Timeout waiting for PDF generation to complete (${elapsed.toFixed(1)}s elapsed)`);
}

// Main test function
async function runTest() {
  try {
    // Load credentials from the JSON file
    let credentials;
    try {
      credentials = JSON.parse(fs.readFileSync('test_credentials.json', 'utf8'));
    } catch (error) {
      logger.error(`Error loading credentials: ${error.message}`);
      process.exit(1);
    }

    // Extract required credentials
    const clientId = credentials.client_id;
    const clientSecret = credentials.client_secret;
    const devicePath = credentials.api_device_path;
    const baseUrl = credentials.base_url;

    if (!clientId || !clientSecret || !devicePath || !baseUrl) {
      logger.error('Missing required credentials. Please check test_credentials.json');
      process.exit(1);
    }

    logger.info(`Using credentials - Client ID: ${clientId}, Device Path: ${devicePath}`);
    logger.info(`Base URL: ${baseUrl}`);

    // Get the first DICOM file from the sample-images directory
    const sampleImagesDir = 'sample-images';
    if (!fs.existsSync(sampleImagesDir)) {
      logger.error(`Sample images directory not found: ${sampleImagesDir}`);
      process.exit(1);
    }

    const dicomFiles = fs.readdirSync(sampleImagesDir)
      .filter(file => file.endsWith('.dcm'))
      .map(file => path.join(sampleImagesDir, file));

    if (dicomFiles.length === 0) {
      logger.error('No DICOM images found in the sample-images directory');
      process.exit(1);
    }

    const testImage = dicomFiles[0];
    const stats = fs.statSync(testImage);
    logger.info(`Testing with image: ${testImage} (Size: ${stats.size} bytes)`);

    // Initialize client
    logger.info('Initializing BridgeIQ client');
    const client = new BridgeIQClient(
      clientId,
      clientSecret,
      devicePath,
      baseUrl,
      'production',
      180000,  // 3 minutes timeout
      3,        // Max retries
      logger
    );

    // Check API health
    logger.info('Checking API health...');
    const isHealthy = await client.healthCheck();
    logger.info(`API health check result: ${isHealthy}`);

    if (!isHealthy) {
      logger.error('API is not healthy. Cannot proceed with analysis.');
      process.exit(1);
    }

    // Send image for analysis
    logger.info(`Sending image ${path.basename(testImage)} for analysis`);
    const analysis = await client.sendAnalysis(
      testImage,
      'TEST-CLIENT-123',
      'Test Patient',
      'M',
      '1990-01-01',
      'panoramic_adult',
      null,
      'standard'
    );

    logger.info(`Analysis submitted successfully!`);
    logger.info(`Request ID: ${analysis.request_id}`);
    logger.info(`Radiography type: ${analysis.radiography_type}`);
    logger.info(`Token cost: ${analysis.token_cost}`);

    // Wait for analysis to complete
    logger.info('Waiting for analysis to complete...');
    try {
      const status = await client.waitForCompletion(
        analysis.request_id,
        180000,   // 3 minutes timeout
        5000     // Check every 5 seconds
      );

      logger.info(`Analysis status: ${status.analysis_status}`);

      if (status.isCompleted) {
        logger.info('Analysis completed successfully, now waiting for PDF generation...');
        
        // Wait for PDF to be generated
        try {
          const pdfStatus = await waitForPdf(
            client,
            analysis.request_id,
            300000,  // 5 minutes timeout for PDF generation
            10000    // Check every 10 seconds
          );

          // Download report
          const outputPath = path.join('sample-pdf', `report_${analysis.request_id}.pdf`);
          logger.info(`Downloading report to ${outputPath}`);
          
          const pdfPath = await client.downloadReport(
            pdfStatus.report_pdf_link,
            outputPath
          );
          
          logger.info(`Report downloaded to ${pdfPath}`);
        } catch (pdfError) {
          logger.error(`Error waiting for PDF: ${pdfError.message}`);
        }
      } else if (status.isFailed) {
        logger.error(`Analysis failed: ${status.error_message || 'Unknown error'}`);
      } else {
        logger.info(`Analysis has unexpected status: ${status.analysis_status}`);
      }
    } catch (error) {
      logger.error(`Error waiting for analysis: ${error.message}`);
    }

    logger.info('Test completed');
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    if (error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
  }
}

// Run the test
runTest().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 