# BridgeIQ Client

![PyPI - Python Version](https://img.shields.io/pypi/pyversions/bridge-iq-client)
![PyPI](https://img.shields.io/pypi/v/bridge-iq-client)
![License](https://img.shields.io/github/license/thakaamed/bridge-iq-client)

A Python client library for ThakaaMed's Bridge IQ imaging AI analysis service. This library provides a seamless interface to ThakaaMed's radiography analysis API.

## About ThakaaMed

ThakaaMed is a pioneering Saudi Arabian healthcare technology company founded in February 2023, dedicated to transforming healthcare through artificial intelligence. As Saudi Arabia's first homegrown medical AI company, ThakaaMed focuses on developing comprehensive artificial intelligence solutions for the healthcare sector, with primary emphasis on medical imaging diagnostics.

## Installation

```bash
pip install bridge-iq-client
```

## Quick Start

```python
from bridge_iq import BridgeIQClient
from pathlib import Path

# Initialize client with your credentials
client = BridgeIQClient(
    client_id="your_client_id",
    client_secret="your_client_secret",
    device_path="your_device_path"
)

# Send an image for analysis
image_path = Path("path/to/radiograph.dcm")
analysis = client.send_analysis(
    image_path=image_path,
    patient_id="P12345",  # Optional
    patient_name="John Doe",  # Optional
    radiography_type="panoramic_adult"  # Optional, will be auto-detected if not provided
)

# Get the request ID for future reference
request_id = analysis.request_id
print(f"Analysis submitted with request ID: {request_id}")

# Check the status of an analysis
status = client.check_status(request_id)
print(f"Analysis status: {status.analysis_status}")

# If completed, download the PDF report
if status.is_completed and status.report_pdf_link:
    pdf_path = Path("./patient_report.pdf")
    client.download_report(status.report_pdf_link, pdf_path)
    print(f"Report downloaded to {pdf_path}")
```

## Features

- Simple, Pythonic API for radiography analysis
- Automatic handling of authentication
- Progress tracking for analysis requests
- PDF report download
- Comprehensive error handling
- Detailed logging
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

```python
from bridge_iq import BridgeIQClient, Environment

# For development or testing
client = BridgeIQClient(
    client_id="your_client_id",
    client_secret="your_client_secret",
    device_path="your_device_path",
    environment=Environment.DEVELOPMENT
)
```

### Asynchronous Analysis

```python
import asyncio
from bridge_iq import AsyncBridgeIQClient

async def analyze_image():
    client = AsyncBridgeIQClient(
        client_id="your_client_id",
        client_secret="your_client_secret",
        device_path="your_device_path"
    )
    
    # Send image for analysis
    analysis = await client.send_analysis(
        image_path="path/to/radiograph.dcm",
        patient_id="P12345"
    )
    
    # Poll for results
    status = await client.wait_for_completion(
        analysis.request_id,
        timeout=300  # 5 minutes
    )
    
    # Download report if completed
    if status.is_completed and status.report_pdf_link:
        await client.download_report(
            status.report_pdf_link,
            "patient_report.pdf"
        )

# Run the async function
asyncio.run(analyze_image())
```

### Custom Logging

```python
import logging
from bridge_iq import BridgeIQClient

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("bridge_iq")
logger.setLevel(logging.DEBUG)

# Pass logger to client
client = BridgeIQClient(
    client_id="your_client_id",
    client_secret="your_client_secret",
    device_path="your_device_path",
    logger=logger
)
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please contact support@thakaamed.com or visit [our website](https://thakaamed.com). 