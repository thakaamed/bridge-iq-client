/**
 * Example script demonstrating how to use the AsyncBridgeIQClient.
 * 
 * This script shows how to use the asynchronous client for
 * submitting multiple images in parallel and handling retries.
 */
const fs = require('fs');
const path = require('path');
const { AsyncBridgeIQClient, LogLevel, getLogger, PDFStatusEnum } = require('../dist');

// Configure logging
const logger = getLogger('async-example', LogLevel.INFO);

/**
 * Wait for PDF generation to complete with retries
 * 
 * @param {AsyncBridgeIQClient} client - The BridgeIQ client
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

    // Initialize the client
    logger.info('Initializing AsyncBridgeIQClient');
    const client = new AsyncBridgeIQClient(
      clientId,
      clientSecret,
      devicePath,
      baseUrl,
      'production',
      180000,  // 3 minutes timeout
      3        // Max retries for HTTP requests
    );

    // Check API health
    logger.info('Checking API health');
    const isHealthy = await client.healthCheck();
    logger.info(`API health check result: ${isHealthy ? 'healthy' : 'unhealthy'}`);

    if (!isHealthy) {
      logger.error('API health check failed. Exiting.');
      process.exit(1);
    }

    // Find all DICOM files in the sample-images directory
    const sampleImagesDir = 'sample-images';
    
    if (!fs.existsSync(sampleImagesDir)) {
      logger.error(`Sample images directory not found: ${sampleImagesDir}`);
      process.exit(1);
    }

    const dicomFiles = fs.readdirSync(sampleImagesDir)
      .filter(file => file.endsWith('.dcm'))
      .map(file => path.join(sampleImagesDir, file));

    if (dicomFiles.length === 0) {
      logger.error('No DICOM files found in the sample-images directory');
      process.exit(1);
    }

    logger.info(`Found ${dicomFiles.length} DICOM files`);

    // Process ALL available images
    const imagesToProcess = dicomFiles;
    logger.info(`Processing ALL ${imagesToProcess.length} images in parallel`);

    // Create output directory for reports (use sample-pdf directory)
    const outputDir = 'sample-pdf';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    // Process each image in parallel
    const processingPromises = imagesToProcess.map(async (imagePath, index) => {
      const imageFilename = path.basename(imagePath);
      logger.info(`[${index + 1}/${imagesToProcess.length}] Processing ${imageFilename}`);
      
      try {
        // Submit the image for analysis
        const analysis = await client.sendAnalysis(
          imagePath,
          `TEST-ASYNC-${index + 1}`,
          `Test Patient ${index + 1}`,
          index % 2 === 0 ? 'M' : 'F',
          '1990-01-01',
          'panoramic_adult'
        );
        
        logger.info(`[${index + 1}] Analysis submitted, request ID: ${analysis.request_id}`);
        
        // Wait for the analysis to complete with retry mechanism
        const status = await client.waitForCompletion(
          analysis.request_id,
          300000,  // 5 minutes
          5000     // Poll every 5 seconds
        );
        
        logger.info(`[${index + 1}] Analysis completed with status: ${status.analysis_status}`);
        
        // If analysis completed, wait for PDF with retry mechanism
        if (status.isCompleted) {
          try {
            logger.info(`[${index + 1}] Analysis completed successfully, now waiting for PDF generation...`);
            
            // Wait for PDF to be generated with retry
            const pdfStatus = await waitForPdfWithRetry(
              client,
              analysis.request_id,
              300000,  // 5 minutes timeout for PDF generation
              10000,   // Check every 10 seconds
              2        // Max 2 retries
            );
            
            const outputPath = path.join(outputDir, `report_${index + 1}_${analysis.request_id}.pdf`);
            
            await client.downloadReport(
              pdfStatus.report_pdf_link,
              outputPath
            );
            
            logger.info(`[${index + 1}] Report downloaded to ${outputPath}`);
            return {
              imagePath,
              requestId: analysis.request_id,
              status: 'success',
              pdfPath: outputPath
            };
          } catch (pdfError) {
            logger.error(`[${index + 1}] Error waiting for PDF: ${pdfError.message}`);
            return {
              imagePath,
              requestId: analysis.request_id,
              status: 'pdf_error',
              error: pdfError.message
            };
          }
        } else if (status.isFailed) {
          logger.error(`[${index + 1}] Analysis failed: ${status.error_message || 'Unknown error'}`);
          return {
            imagePath,
            requestId: analysis.request_id,
            status: 'failed',
            error: status.error_message
          };
        } else {
          logger.info(`[${index + 1}] Analysis has unexpected status: ${status.analysis_status}`);
          return {
            imagePath,
            requestId: analysis.request_id,
            status: 'unexpected',
            statusValue: status.analysis_status
          };
        }
      } catch (error) {
        logger.error(`[${index + 1}] Error processing ${imageFilename}: ${error.message}`);
        return {
          imagePath,
          status: 'error',
          error: error.message
        };
      }
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
    
    logger.info(`All processing completed! Successes: ${successes}, Failures: ${failures}`);
  } catch (error) {
    logger.error(`Unhandled error: ${error.message}`);
    if (error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
  }
}

// Run the example
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 