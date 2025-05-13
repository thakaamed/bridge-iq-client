/**
 * Real DICOM test script for the BridgeIQ client library.
 * 
 * This script demonstrates sending actual DICOM images for analysis.
 */
const fs = require('fs');
const path = require('path');
const { BridgeIQClient, LogLevel, getLogger } = require('../dist');

// Configure logging
const logger = getLogger('real-dicom-test', LogLevel.DEBUG, true, 'bridge-iq-test.log');

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

    // Get the DICOM files from the sample-images directory
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

    logger.info(`Found ${dicomFiles.length} DICOM files for testing`);

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

    // Ensure sample-pdf directory exists
    const samplePdfDir = 'sample-pdf';
    if (!fs.existsSync(samplePdfDir)) {
      fs.mkdirSync(samplePdfDir, { recursive: true });
    }

    // Process the first two DICOM files
    const imagesToProcess = dicomFiles.slice(0, 2);
    
    for (let i = 0; i < imagesToProcess.length; i++) {
      const imagePath = imagesToProcess[i];
      const fileName = path.basename(imagePath);
      
      logger.info(`\n[${i+1}/${imagesToProcess.length}] Processing ${fileName}`);
      
      try {
        // Get file details
        const stats = fs.statSync(imagePath);
        logger.info(`Image size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
        
        // Send image for analysis
        logger.info(`Sending image ${fileName} for analysis...`);
        const analysis = await client.sendAnalysis(
          imagePath,
          `TEST-REAL-${i+1}`,
          `Test Patient ${i+1}`,
          i % 2 === 0 ? 'M' : 'F',
          '1990-01-01',
          'panoramic_adult'
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
            300000,   // 5 minute timeout
            10000     // Check every 10 seconds
          );

          logger.info(`Analysis status: ${status.analysis_status}`);

          // Download report if available
          if (status.isCompleted && status.hasPdf) {
            const outputPath = path.join(samplePdfDir, `report_${i+1}_${path.basename(fileName, '.dcm')}.pdf`);
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
      } catch (error) {
        logger.error(`Error processing ${fileName}: ${error.message}`);
      }
    }

    logger.info('\nTest completed');
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