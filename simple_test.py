"""
Simple test script for the BridgeIQ client library.

This script tests the basic functionality:
1. Initializing the client with credentials
2. Sending a single DICOM image for analysis
"""
import json
import logging
import sys
from pathlib import Path
from urllib.parse import urljoin

import requests

from bridge_iq import BridgeIQClient
from bridge_iq.logger import setup_logger

# Configure logging
logger = setup_logger(level=logging.DEBUG, log_to_file=False)

# Load credentials from the JSON file
try:
    with open("test_credentials.json", "r") as f:
        credentials = json.load(f)
except (FileNotFoundError, json.JSONDecodeError) as e:
    logger.error(f"Error loading credentials: {e}")
    sys.exit(1)

# Extract required credentials
client_id = credentials.get("client_id")
client_secret = credentials.get("client_secret")
device_path = credentials.get("api_device_path")
base_url = credentials.get("base_url")

if not all([client_id, client_secret, device_path, base_url]):
    logger.error("Missing required credentials. Please check test_credentials.json")
    sys.exit(1)

logger.info(f"Using credentials - Client ID: {client_id}, Device Path: {device_path}")
logger.info(f"Base URL: {base_url}")

# Get the first DICOM file from the sample-images directory
sample_images_dir = Path("sample-images")
sample_images = list(sample_images_dir.glob("*.dcm"))

if not sample_images:
    logger.error("No DICOM images found in the sample-images directory")
    sys.exit(1)

test_image = sample_images[0]
logger.info(f"Testing with image: {test_image} (Size: {test_image.stat().st_size} bytes)")

# First, check if the API is accessible with a simple GET request
try:
    # Construct a test URL to check API availability
    test_url = urljoin(base_url, "health")
    logger.info(f"Testing API connectivity: {test_url}")
    
    response = requests.get(test_url, timeout=10)
    logger.info(f"API response: {response.status_code} {response.reason}")
    
    if response.ok:
        logger.info("API is accessible")
        logger.info(f"Response: {response.text}")
    else:
        logger.warning(f"API returned non-OK status: {response.status_code}")
        logger.warning(f"Response text: {response.text}")
        
except Exception as e:
    logger.error(f"Error connecting to API: {e}")
    logger.error(f"This may indicate connectivity issues or an incorrect base URL")

# Test with the actual client
logger.info("\n===== Testing BridgeIQ Client =====")
logger.info("Initializing BridgeIQ client")

try:
    client = BridgeIQClient(
        client_id=client_id,
        client_secret=client_secret,
        device_path=device_path,
        base_url=base_url,
        timeout=180,  # 3 minutes
    )
    
    logger.info("Client initialized successfully")
    
    # Test sending the image
    logger.info(f"Sending image {test_image.name} for analysis")
    
    with open(test_image, "rb") as f:
        image_data = f.read()
        logger.info(f"Image read successfully: {len(image_data)} bytes")
    
    # Prepare request data manually to debug
    url = urljoin(base_url, f"/webhooks/devices/{device_path}/requests")
    logger.info(f"Request URL: {url}")
    
    headers = {"User-Agent": client.user_agent}
    logger.info(f"Headers: {headers}")
    
    form_data = {
        "image": (test_image.name, image_data),
        "client_id": (None, client_id),
        "client_secret": (None, client_secret),
        "report_type": (None, "standard"),
        "radiography_type": (None, "panoramic_adult"),
        "patient_id": (None, "TEST-DEBUG-123"),
    }
    
    logger.info("Sending direct request to debug API interaction")
    response = requests.post(
        url=url,
        files=form_data,
        headers=headers,
        timeout=180,
    )
    
    logger.info(f"Direct API response: {response.status_code} {response.reason}")
    
    if response.ok:
        logger.info(f"Response: {response.text}")
        data = response.json()
        if data.get("status") == "success":
            logger.info("Request submitted successfully!")
            request_id = data.get("data", {}).get("request_id")
            logger.info(f"Request ID: {request_id}")
        else:
            logger.error(f"API returned success status code but with error in body: {data}")
    else:
        logger.error(f"API returned error status: {response.status_code}")
        logger.error(f"Response text: {response.text}")
    
    # Now try using the actual client API
    logger.info("\nNow trying with the actual client API")
    
    analysis = client.send_analysis(
        image_path=test_image,
        patient_id="TEST-CLIENT-123",
        patient_name="Test Patient",
        radiography_type="panoramic_adult",
    )
    
    logger.info(f"Analysis submitted successfully using client API!")
    logger.info(f"Request ID: {analysis.request_id}")
    logger.info(f"Radiography type: {analysis.radiography_type}")
    logger.info(f"Token cost: {analysis.token_cost}")
    
    # Close the client
    client.close()
    logger.info("Test completed successfully")
    
except Exception as e:
    logger.error(f"Error during test: {e}")
    logger.error(f"Exception type: {type(e).__name__}")
    
    import traceback
    logger.error(f"Traceback: {traceback.format_exc()}")

logger.info("Simple test completed") 