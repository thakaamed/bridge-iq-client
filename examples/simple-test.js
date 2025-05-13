/**
 * Simple test script for the BridgeIQ client library.
 * 
 * This script tests the basic functionality:
 * 1. Initializing the client with credentials
 * 2. Sending a single DICOM image for analysis
 */
const fs = require('fs');
const path = require('path');
const { BridgeIQClient, LogLevel, getLogger } = require('../dist');

// Configure logging
const logger = getLogger('simple-test', LogLevel.DEBUG);

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

    // Wait for analysis to complete (with shorter timeout for testing)
    logger.info('Waiting for analysis to complete...');
    try {
      const status = await client.waitForCompletion(
        analysis.request_id,
        60000,   // 1 minute timeout for quick testing
        5000     // Check every 5 seconds
      );

      logger.info(`Analysis status: ${status.analysis_status}`);

      // Download report if available
      if (status.isCompleted && status.hasPdf) {
        const outputPath = `report_${analysis.request_id}.pdf`;
        logger.info(`Downloading report to ${outputPath}`);
        
        const pdfPath = await client.downloadReport(
          status.report_pdf_link,
          outputPath
        );
        
        logger.info(`Report downloaded to ${pdfPath}`);
      } else if (status.isFailed) {
        logger.error(`Analysis failed: ${status.error_message || 'Unknown error'}`);
      } else {
        logger.info('Analysis completed but PDF is not yet available');
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