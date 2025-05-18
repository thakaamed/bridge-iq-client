# BridgeIQ Client for Node.js

![npm](https://img.shields.io/npm/v/bridge-iq-client)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)

A Node.js client library for ThakaaMed's Bridge IQ imaging AI analysis service. This library provides a seamless interface to ThakaaMed's radiography analysis API.

## About ThakaaMed

ThakaaMed is a pioneering Saudi Arabian healthcare technology company founded in February 2023, dedicated to transforming healthcare through artificial intelligence. As Saudi Arabia's first homegrown medical AI company, ThakaaMed focuses on developing comprehensive artificial intelligence solutions for the healthcare sector, with primary emphasis on medical imaging diagnostics.

## Installation

```bash
npm install bridge-iq-client
# or
yarn add bridge-iq-client
# or
pnpm add bridge-iq-client
```

## Quick Start

```javascript
// Using CommonJS
const { BridgeIQClient } = require('bridge-iq-client');

// Using ES Modules
import { BridgeIQClient } from 'bridge-iq-client';

// Initialize client with your credentials
const client = new BridgeIQClient(
  'your_client_id',
  'your_client_secret',
  'your_device_path',
  'base_url'
);

// Check if the API is available
async function checkApiHealth() {
  const isHealthy = await client.healthCheck();
  console.log(`API is ${isHealthy ? 'healthy' : 'unhealthy'}`);
}

// Send an image for analysis
async function analyzeImage() {
  try {
    // Send the image
    const analysis = await client.sendAnalysis(
      'path/to/radiograph.dcm',
      'P12345',          // Optional patient ID
      'John Doe',        // Optional patient name
      'M',               // Optional patient gender
      '1990-01-01',      // Optional patient date of birth
      'panoramic_adult'  // Optional radiography type
    );
    
    console.log(`Analysis submitted with request ID: ${analysis.request_id}`);
    
    // Wait for the analysis to complete
    const status = await client.waitForCompletion(
      analysis.request_id,
      300000,  // 5 minutes timeout
      5000     // Check every 5 seconds
    );
    
    console.log(`Analysis status: ${status.analysis_status}`);
    
    // If completed, download the PDF report
    if (status.isCompleted && status.hasPdf) {
      const pdfPath = await client.downloadReport(
        status.report_pdf_link,
        './patient_report.pdf'
      );
      console.log(`Report downloaded to ${pdfPath}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}
```

## Examples

The package includes comprehensive examples in the `examples` directory:

```bash
# Run the full demo script
node examples/demo.js
```

The demo script showcases:
- Client initialization and API health checks
- Processing single images
- Processing multiple images in parallel with AsyncBridgeIQClient
- PDF generation with automated waiting and retry mechanisms
- Error handling and reporting

For more details, see the README.md file in the examples directory.

## Features

- Simple API for radiography analysis
- Automatic handling of authentication
- Progress tracking for analysis requests
- PDF report download
- Comprehensive error handling
- Detailed logging
- TypeScript support with full type definitions
- Cross-platform compatibility

## Supported Radiography Types

- `panoramic_adult` - Panoramic radiograph for adults
- `panoramic_kid` - Panoramic radiograph for children
- `bitewing` - Bitewing radiograph
- `periapical` - Periapical radiograph
- `cbct` - *Coming soon*
- `ceph` - *Coming soon*

## Advanced Usage

### Custom Environment Configuration

```javascript
import { BridgeIQClient, Environment } from 'bridge-iq-client';

// For development or testing
const client = new BridgeIQClient(
  'your_client_id',
  'your_client_secret',
  'your_device_path',
  'base_url',
  Environment.TESTING
);
```

### Using the AsyncBridgeIQClient

```javascript
import { AsyncBridgeIQClient } from 'bridge-iq-client';

// Though the regular client is already Promise-based in Node.js,
// this class is provided for API compatibility with the Python version.
const client = new AsyncBridgeIQClient(
  'your_client_id',
  'your_client_secret',
  'your_device_path',
  'base_url'
);

// The API is the same as the regular client
const analysis = await client.sendAnalysis('path/to/image.dcm');
```

### Custom Logging

```javascript
import { BridgeIQClient, Logger, LogLevel } from 'bridge-iq-client';

// Configure a custom logger with debug level
const logger = new Logger('my-app', LogLevel.DEBUG, true, './logs/bridge-iq.log');

// Pass logger to client
const client = new BridgeIQClient(
  'your_client_id',
  'your_client_secret',
  'your_device_path',
  'base_url',
  'production',
  120000,   // 2 minutes timeout
  3,        // Max retries
  logger
);
```

### Error Handling

```javascript
import { 
  BridgeIQClient, 
  BridgeIQError,
  AuthenticationError,
  ConnectionError,
  ValidationError
} from 'bridge-iq-client';

async function safeAnalysis() {
  try {
    const analysis = await client.sendAnalysis('path/to/image.dcm');
    return analysis;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.error('Authentication failed. Check your credentials.');
    } else if (error instanceof ConnectionError) {
      console.error('Could not connect to the API. Check your internet connection.');
    } else if (error instanceof ValidationError) {
      console.error('Invalid parameters:', error.message);
    } else if (error instanceof BridgeIQError) {
      console.error('API error:', error.message);
      console.error('Response:', error.response);
    } else {
      console.error('Unexpected error:', error);
    }
    throw error;
  }
}
```

## API Reference

The library provides the following main classes:

### BridgeIQClient

Main client for interacting with the BridgeIQ API.

#### Methods

- `healthCheck()`: Check if the API is available
- `sendAnalysis(imagePath, patientId?, patientName?, patientGender?, patientDob?, radiographyType?, callbackUrl?, reportType?)`: Send an image for analysis
- `checkStatus(requestId)`: Check the status of an analysis
- `waitForCompletion(requestId, timeout?, pollInterval?)`: Wait for an analysis to complete
- `downloadReport(reportUrl, outputPath)`: Download a PDF report

### AsyncBridgeIQClient

Asynchronous client with the same interface as BridgeIQClient. In Node.js, this is provided for API compatibility with the Python library, as the regular client is already Promise-based.

## Development

### Building the Library

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Lint the code
npm run lint

# Format the code
npm run format
```

### Publishing to NPM

```bash
# Using the publish script (recommended)
./scripts/publish.sh --test      # Publish with 'next' tag
./scripts/publish.sh --production # Publish with 'latest' tag

# Or manually
npm run build
npm publish
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please contact contact@thakaamed.com or visit [our website](https://thakaamed.ai). 