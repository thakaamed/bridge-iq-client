/**
 * BridgeIQ Client - Complete Demo Script
 * 
 * This comprehensive example demonstrates the key features of the BridgeIQ client:
 * 1. Initialization with proper credentials
 * 2. Checking API health
 * 3. Sending single DICOM images for analysis
 * 4. Processing multiple images in parallel with AsyncBridgeIQClient
 * 5. Waiting for analysis to complete
 * 6. Handling PDF generation with retry mechanism
 * 7. Downloading reports
 * 
 * To use this script:
 * 1. Create a test_credentials.json file with your API credentials
 * 2. Place DICOM (.dcm) files in the sample-images directory
 * 3. Run with: node examples/bridge-iq-demo.js
 */
const fs = require('fs');
const path = require('path');
const { 
  BridgeIQClient, 
  AsyncBridgeIQClient, 
  LogLevel, 
  getLogger, 
  PDFStatusEnum 
} = require('../dist/src/index');

// Configure logging
const logger = getLogger('bridge-iq-demo', LogLevel.INFO);

/**
 * Wait for PDF generation to complete with retries
 * 
 * @param {BridgeIQClient} client - The BridgeIQ client
 * @param {string} requestId - The analysis request ID
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @param {number} pollInterval - Time between status checks in milliseconds
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<object>} - The analysis status with PDF link
 */
async function waitForPdfWithRetry(client, requestId, timeout = 300000, pollInterval = 5000, maxRetries = 2) {
  const startTime = Date.now();
  const endTime = startTime + timeout;
  let retryCount = 0;
  
  logger.info(`Waiting for PDF generation for analysis ${requestId} to complete ` +
              `(timeout: ${timeout / 1000}s, poll interval: ${pollInterval / 1000}s, max retries: ${maxRetries})`);
  
  while (Date.now() < endTime) {
    try {
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
    } catch (error) {
      // Handle retry logic for errors
      retryCount++;
      if (retryCount <= maxRetries) {
        logger.warn(`Error checking PDF status (attempt ${retryCount}/${maxRetries}): ${error.message}. Retrying...`);
        // Wait before retrying (using exponential backoff)
        const backoffTime = Math.min(pollInterval * Math.pow(2, retryCount), 30000);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      } else {
        logger.error(`Max retries (${maxRetries}) exceeded while waiting for PDF: ${error.message}`);
        throw error;
      }
    }
  }
  
  // If we get here, the timeout was reached
  const elapsed = (Date.now() - startTime) / 1000;
  throw new Error(`Timeout waiting for PDF generation to complete (${elapsed.toFixed(1)}s elapsed)`);
}

/**
 * Process a single DICOM image
 * 
 * @param {BridgeIQClient} client - Client instance
 * @param {string} imagePath - Path to DICOM image
 * @param {string} patientId - Patient ID
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Processing result
 */
async function processSingleImage(client, imagePath, patientId, options = {}) {
  const imageFilename = path.basename(imagePath);
  logger.info(`Processing ${imageFilename}`);
  
  try {
    // Submit the image for analysis
    const analysis = await client.sendAnalysis(
      imagePath,
      patientId,
      options.patientName || 'Test Patient',
      options.patientGender || 'M',
      options.patientDob || '1990-01-01',
      options.radiographyType || 'panoramic_adult'
    );
    
    logger.info(`Analysis submitted, request ID: ${analysis.request_id}`);
    
    // Wait for the analysis to complete
    const status = await client.waitForCompletion(
      analysis.request_id,
      options.timeout || 300000,  // 5 minutes
      options.pollInterval || 5000  // Poll every 5 seconds
    );
    
    logger.info(`Analysis completed with status: ${status.analysis_status}`);
    
    // If analysis completed, wait for and download PDF
    if (status.isCompleted) {
      try {
        logger.info(`Analysis completed successfully, now waiting for PDF generation...`);
        
        // Wait for PDF to be generated with retry
        const pdfStatus = await waitForPdfWithRetry(
          client,
          analysis.request_id,
          300000,  // 5 minutes timeout for PDF generation
          10000,   // Check every 10 seconds
          2        // Max 2 retries
        );
        
        const outputPath = path.join(options.outputDir || 'sample-pdf', 
                                    `report_${analysis.request_id}.pdf`);
        
        await client.downloadReport(
          pdfStatus.report_pdf_link,
          outputPath
        );
        
        logger.info(`Report downloaded to ${outputPath}`);
        return {
          imagePath,
          requestId: analysis.request_id,
          status: 'success',
          pdfPath: outputPath
        };
      } catch (pdfError) {
        logger.error(`Error waiting for PDF: ${pdfError.message}`);
        return {
          imagePath,
          requestId: analysis.request_id,
          status: 'pdf_error',
          error: pdfError.message
        };
      }
    } else if (status.isFailed) {
      logger.error(`Analysis failed: ${status.error_message || 'Unknown error'}`);
      return {
        imagePath,
        requestId: analysis.request_id,
        status: 'failed',
        error: status.error_message
      };
    } else {
      logger.info(`Analysis has unexpected status: ${status.analysis_status}`);
      return {
        imagePath,
        requestId: analysis.request_id,
        status: 'unexpected',
        statusValue: status.analysis_status
      };
    }
  } catch (error) {
    logger.error(`Error processing ${imageFilename}: ${error.message}`);
    return {
      imagePath,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Process multiple images in parallel using AsyncBridgeIQClient
 * 
 * @param {AsyncBridgeIQClient} client - Async client instance
 * @param {string[]} imagePaths - Array of image paths
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} - Processing results
 */
async function processImagesInParallel(client, imagePaths, options = {}) {
  const outputDir = options.outputDir || 'sample-pdf';
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  logger.info(`Processing ${imagePaths.length} images in parallel`);
  
  // Process each image in parallel
  const processingPromises = imagePaths.map(async (imagePath, index) => {
    const imageFilename = path.basename(imagePath);
    const patientId = `TEST-PARALLEL-${index + 1}`;
    
    logger.info(`[${index + 1}/${imagePaths.length}] Submitting ${imageFilename}`);
    
    return processSingleImage(client, imagePath, patientId, {
      ...options,
      patientName: `Parallel Patient ${index + 1}`,
      patientGender: index % 2 === 0 ? 'M' : 'F',
      outputDir
    });
  });
  
  // Wait for all images to be processed
  const results = await Promise.all(processingPromises);
  
  // Print summary
  logger.info('\n===== Processing Summary =====');
  results.forEach((result, index) => {
    logger.info(`[${index + 1}] ${path.basename(result.imagePath)}: ${result.status}`);
    if (result.pdfPath) {
      logger.info(`    PDF: ${result.pdfPath}`);
    }
    if (result.error) {
      logger.error(`    Error: ${result.error}`);
    }
  });
  
  // Count successes and failures
  const successes = results.filter(r => r.status === 'success').length;
  const failures = results.length - successes;
  
  logger.info(`Parallel processing completed! Successes: ${successes}, Failures: ${failures}`);
  
  return results;
}

// Main function
async function main() {
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

    logger.info('-'.repeat(80));
    logger.info('BRIDGE IQ CLIENT DEMO');
    logger.info('-'.repeat(80));
    logger.info('Using credentials:');
    logger.info(`- Client ID: ${clientId}`);
    logger.info(`- Device Path: ${devicePath}`);
    logger.info(`- Base URL: ${baseUrl}`);

    // Initialize the regular client
    logger.info('\n1. Initializing BridgeIQClient');
    const client = new BridgeIQClient(
      clientId,
      clientSecret,
      devicePath,
      baseUrl,
      'production',
      120000,  // 2 minutes timeout
      3        // Max retries for HTTP requests
    );

    // Check API health
    logger.info('\n2. Checking API health');
    const isHealthy = await client.healthCheck();
    logger.info(`API health check result: ${isHealthy ? 'healthy' : 'unhealthy'}`);

    if (!isHealthy) {
      logger.error('API health check failed. Exiting.');
      process.exit(1);
    }

    // Find DICOM files in the sample-images directory
    const sampleImagesDir = 'sample-images';
    
    if (!fs.existsSync(sampleImagesDir)) {
      logger.error(`Sample images directory not found: ${sampleImagesDir}`);
      logger.info(`Creating ${sampleImagesDir} directory. Please add .dcm files there.`);
      fs.mkdirSync(sampleImagesDir, { recursive: true });
      process.exit(1);
    }

    const dicomFiles = fs.readdirSync(sampleImagesDir)
      .filter(file => file.endsWith('.dcm'))
      .map(file => path.join(sampleImagesDir, file));

    if (dicomFiles.length === 0) {
      logger.error('No DICOM files found in the sample-images directory');
      logger.info('Please add some .dcm files to the sample-images directory');
      process.exit(1);
    }

    logger.info(`Found ${dicomFiles.length} DICOM files for testing`);

    // Process a single image
    if (dicomFiles.length > 0) {
      logger.info('\n3. Processing a single image');
      const singleResult = await processSingleImage(
        client, 
        dicomFiles[0],
        'TEST-SINGLE-1',
        { outputDir: 'sample-pdf' }
      );
      logger.info(`Single image processing status: ${singleResult.status}`);
    }

    // Use AsyncBridgeIQClient for parallel processing
    // Limit to max 2 images for demo purposes
    if (dicomFiles.length >= 2) {
      logger.info('\n4. Processing multiple images in parallel using AsyncBridgeIQClient');
      
      // Initialize the async client
      const asyncClient = new AsyncBridgeIQClient(
        clientId,
        clientSecret,
        devicePath,
        baseUrl,
        'production',
        120000,  // 2 minutes timeout
        3        // Max retries
      );
      
      // Process up to 2 images in parallel
      const imagesToProcess = dicomFiles.slice(0, 2);
      await processImagesInParallel(asyncClient, imagesToProcess, { 
        outputDir: 'sample-pdf',
        timeout: 300000,
        pollInterval: 5000
      });
    }

    logger.info('\nDemo completed successfully!');
    logger.info('-'.repeat(80));

  } catch (error) {
    logger.error(`Unhandled error: ${error.message}`);
    if (error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
  }
}

// Run the demo
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

// Export the functions for testing or reuse
module.exports = {
  waitForPdfWithRetry,
  processSingleImage,
  processImagesInParallel
}; 