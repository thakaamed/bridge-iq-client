# BridgeIQ Client Examples

This directory contains example scripts that demonstrate how to use the BridgeIQ client library for dental radiography analysis.

## Setup

Before running any examples, you need to:

1. Create a `test_credentials.json` file in the client_app_npm directory with your API credentials:

```json
{
  "client_id": "your_client_id",
  "client_secret": "your_client_secret", 
  "api_device_path": "your_device_path",
  "base_url": "https://api.domain.com/api/v1"
}
```

2. Create a `sample-images` directory and place your DICOM (.dcm) files there:

```
client_app_npm/
├── sample-images/
│   ├── image1.dcm
│   ├── image2.dcm
│   └── ...
```

3. Install dependencies if you haven't already:

```bash
npm install
```

4. Build the package:

```bash
npm run build
```

## Demo Script

The comprehensive demo script demonstrates all key features of the BridgeIQ client:

```bash
node examples/demo.js
```

This script showcases:
- Client initialization and API health checks
- Processing single images
- Processing multiple images in parallel with AsyncBridgeIQClient
- PDF generation with automatic waiting
- Downloading reports with retry mechanism
- Error handling and recovery

## Output

The example script saves generated PDF reports to the `sample-pdf` directory.

## Key Features Demonstrated

The demo script illustrates several important features:

1. **Authentication and API Health Check**
   - Proper initialization with credentials
   - Health check to verify API availability

2. **Single Image Processing**
   - Loading and sending DICOM images
   - Waiting for analysis completion
   - Handling analysis results

3. **Parallel Processing with AsyncBridgeIQClient**
   - Processing multiple images simultaneously
   - Tracking all processes with Promise.all

4. **PDF Generation and Retry Mechanism**
   - Waiting for PDF reports to become available
   - Implementing exponential backoff for retries
   - Handling PDF generation failures

5. **Error Handling**
   - API connection errors
   - Authentication failures
   - PDF generation timeouts
   - Comprehensive error reporting

## Further Reading

For more details on the BridgeIQ client API, see the main README.md file in the root directory.

## Support

For issues with these examples, please contact ThakaaMed support. 