"""
Diagnostic test script for the BridgeIQ client library.

This script performs detailed diagnostics to identify and resolve
the 422 Unprocessable Entity errors when submitting DICOM images.
"""
import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

import requests

from bridge_iq import BridgeIQClient, AsyncBridgeIQClient, Environment
from bridge_iq.logger import setup_logger
from bridge_iq.exceptions import BridgeIQError

# Configure logging - more verbose for diagnostics
logger = setup_logger(level=logging.DEBUG, log_to_file=False)

# Ensure sample-pdf directory exists
sample_pdf_dir = Path("sample-pdf")
sample_pdf_dir.mkdir(exist_ok=True)

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
base_url = credentials.get("base_url"")

if not all([client_id, client_secret, device_path]):
    logger.error("Missing required credentials. Please check test_credentials.json")
    sys.exit(1)

# List all DICOM files in the sample-images directory
sample_images_dir = Path("sample-images")
sample_images = list(sample_images_dir.glob("*.dcm"))

if not sample_images:
    logger.error("No DICOM images found in the sample-images directory")
    sys.exit(1)

logger.info(f"Found {len(sample_images)} DICOM images for testing")
logger.info(f"Using credentials - Client ID: {client_id}, Device Path: {device_path}")
logger.info(f"Base URL: {base_url}")

def send_direct_request(image_path, additional_params=None):
    """
    Send a direct request to the API with explicit parameters to identify validation issues.
    """
    logger.info(f"Testing direct request with image: {image_path.name}")
    
    # Read image data
    with open(image_path, "rb") as f:
        image_data = f.read()
        logger.info(f"Image read successfully: {len(image_data)} bytes")
    
    # Prepare request URL
    url = urljoin(base_url, f"/api/v1/webhooks/devices/{device_path}/requests")
    logger.info(f"Request URL: {url}")
    
    # Prepare headers
    headers = {
        "User-Agent": "BridgeIQ-DiagnosticTest/1.0",
    }
    
    # Prepare form data with required fields
    form_data = {
        "image": (image_path.name, image_data),
        "client_id": (None, client_id),
        "client_secret": (None, client_secret),
        "report_type": (None, "standard"),
    }
    
    # Default radiography type
    if not additional_params or "radiography_type" not in additional_params:
        form_data["radiography_type"] = (None, "panoramic_adult")
    
    # Add additional parameters if provided
    if additional_params:
        for key, value in additional_params.items():
            form_data[key] = (None, str(value))
            
    logger.info(f"Form data keys: {list(form_data.keys())}")
    
    # Send request with detailed debugging
    try:
        logger.info("Sending direct API request...")
        response = requests.post(
            url=url,
            files=form_data,
            headers=headers,
            timeout=180,
        )
        
        logger.info(f"Response status: {response.status_code} {response.reason}")
        
        # Attempt to parse response as JSON
        try:
            data = response.json()
            logger.info(f"Response body: {json.dumps(data, indent=2)}")
            
            # Check for detailed error information
            if response.status_code == 422:
                logger.error("Validation error details:")
                if isinstance(data, dict):
                    if "detail" in data:
                        for error in data.get("detail", []):
                            logger.error(f"  - Field: {error.get('loc', ['unknown'])[0]}, Error: {error.get('msg', 'unknown')}")
                    elif "message" in data:
                        logger.error(f"  - Message: {data.get('message')}")
                else:
                    logger.error(f"  - Unexpected response format: {data}")
        except (ValueError, KeyError):
            logger.info(f"Response text: {response.text}")
        
        return response
    
    except Exception as e:
        logger.error(f"Error sending direct request: {e}")
        return None

def try_different_parameters():
    """Try sending the same image with different parameter combinations."""
    logger.info("===== Testing Different Parameter Combinations =====")
    
    test_image = sample_images[0]
    logger.info(f"Selected test image: {test_image}")
    
    # List of parameter combinations to try
    parameter_combinations = [
        # Default parameters
        {},
        
        # Explicitly set all params we think might be required
        {
            "radiography_type": "panoramic_adult",
            "patient_id": "TEST-123",
            "patient_name": "Test Patient",
            "patient_gender": "M",
            "patient_dob": "1990-01-01",
        },
        
        # Try different radiography types
        {"radiography_type": "bitewing"},
        {"radiography_type": "periapical"},
        
        # Try with minimal parameters
        {"radiography_type": "panoramic_adult"},
        
        # Try changing structure type of params
        {"structure_type": "2d"},
        {"report_format": "pdf"},
        
        # Try with all uppercase values
        {"radiography_type": "PANORAMIC_ADULT"},
    ]
    
    results = []
    
    for i, params in enumerate(parameter_combinations):
        logger.info(f"Test {i+1}: Trying parameters: {params}")
        response = send_direct_request(test_image, params)
        
        if response:
            results.append({
                "params": params,
                "status_code": response.status_code,
                "success": response.status_code == 200
            })
            
            # If successful, break and use these parameters
            if response.status_code == 200:
                logger.info(f"Success! Found working parameters: {params}")
                return params
    
    # Summarize results
    logger.info("===== Parameter Testing Results =====")
    for i, result in enumerate(results):
        status = "✅ Success" if result["success"] else f"❌ Failed ({result['status_code']})"
        logger.info(f"Test {i+1}: {status} - Params: {result['params']}")
    
    logger.warning("No parameter combination was successful.")
    return None

def test_sync_client_with_all_images(params=None):
    """Test the synchronous BridgeIQ client with all sample images."""
    logger.info("===== Testing Synchronous Client With All Images =====")
    
    # Initialize the client
    client = BridgeIQClient(
        client_id=client_id,
        client_secret=client_secret,
        device_path=device_path,
        base_url=base_url,
        environment=Environment.PRODUCTION,
        timeout=180,
    )
    
    results = []
    
    try:
        # Verify API is available
        is_healthy = client.health_check()
        logger.info(f"API health check result: {'Healthy' if is_healthy else 'Unhealthy'}")
        
        if not is_healthy:
            logger.warning("API health check failed. Skipping tests.")
            return results
        
        # Process each image
        for i, image_path in enumerate(sample_images):
            logger.info(f"Processing image {i+1}/{len(sample_images)}: {image_path.name}")
            
            try:
                # Prepare parameters for this image
                image_params = {
                    "patient_id": f"TEST-SYNC-{i+1}",
                    "patient_name": f"Test Patient {i+1}",
                    "radiography_type": "panoramic_adult",
                    "report_type": "standard",
                }
                
                # Update with custom params if provided
                if params:
                    image_params.update(params)
                
                # Send the image for analysis
                analysis = client.send_analysis(
                    image_path=image_path,
                    **image_params
                )
                
                logger.info(f"Analysis submitted successfully! Request ID: {analysis.request_id}")
                
                # Wait for analysis to complete
                status = client.wait_for_completion(
                    request_id=analysis.request_id,
                    timeout=600,  # 10 minutes
                    poll_interval=10,  # Check every 10 seconds
                )
                
                logger.info(f"Analysis status: {status.analysis_status}")
                
                # Download report if available
                if status.is_completed and status.has_pdf:
                    pdf_path = sample_pdf_dir / f"report_{i+1}_{analysis.request_id}.pdf"
                    
                    client.download_report(
                        report_url=status.report_pdf_link,
                        output_path=pdf_path,
                    )
                    
                    logger.info(f"Report downloaded to {pdf_path}")
                    results.append({
                        "image": image_path.name,
                        "status": "success",
                        "pdf_path": str(pdf_path),
                        "request_id": analysis.request_id
                    })
                else:
                    logger.warning(f"No PDF available for {image_path.name}")
                    results.append({
                        "image": image_path.name,
                        "status": "no_pdf" if status.is_completed else status.analysis_status,
                        "request_id": analysis.request_id
                    })
            
            except Exception as e:
                logger.error(f"Error processing {image_path.name}: {e}")
                results.append({
                    "image": image_path.name,
                    "status": "error",
                    "error": str(e)
                })
    
    except Exception as e:
        logger.error(f"Error in synchronous client test: {e}")
    
    finally:
        client.close()
        logger.info("Synchronous client test completed")
        
    return results

async def test_async_client_with_all_images(params=None):
    """Test the asynchronous BridgeIQ client with all sample images."""
    logger.info("===== Testing Asynchronous Client With All Images =====")
    
    # Initialize the client
    client = AsyncBridgeIQClient(
        client_id=client_id,
        client_secret=client_secret,
        device_path=device_path,
        base_url=base_url,
        environment=Environment.PRODUCTION,
        timeout=180,
    )
    
    results = []
    
    try:
        # Create client session
        await client.__aenter__()
        
        # Verify API is available
        is_healthy = await client.health_check()
        logger.info(f"API health check result: {'Healthy' if is_healthy else 'Unhealthy'}")
        
        if not is_healthy:
            logger.warning("API health check failed. Skipping tests.")
            return results
        
        # Process each image
        for i, image_path in enumerate(sample_images):
            logger.info(f"Processing image {i+1}/{len(sample_images)}: {image_path.name}")
            
            try:
                # Prepare parameters for this image
                image_params = {
                    "patient_id": f"TEST-ASYNC-{i+1}",
                    "patient_name": f"Test Patient {i+1}",
                    "radiography_type": "panoramic_adult",
                    "report_type": "standard",
                }
                
                # Update with custom params if provided
                if params:
                    image_params.update(params)
                
                # Send the image for analysis
                analysis = await client.send_analysis(
                    image_path=image_path,
                    **image_params
                )
                
                logger.info(f"Analysis submitted successfully! Request ID: {analysis.request_id}")
                
                # Wait for analysis to complete
                status = await client.wait_for_completion(
                    request_id=analysis.request_id,
                    timeout=600,  # 10 minutes
                    poll_interval=10,  # Check every 10 seconds
                )
                
                logger.info(f"Analysis status: {status.analysis_status}")
                
                # Download report if available
                if status.is_completed and status.has_pdf:
                    pdf_path = sample_pdf_dir / f"async_report_{i+1}_{analysis.request_id}.pdf"
                    
                    await client.download_report(
                        report_url=status.report_pdf_link,
                        output_path=pdf_path,
                    )
                    
                    logger.info(f"Report downloaded to {pdf_path}")
                    results.append({
                        "image": image_path.name,
                        "status": "success",
                        "pdf_path": str(pdf_path),
                        "request_id": analysis.request_id
                    })
                else:
                    logger.warning(f"No PDF available for {image_path.name}")
                    results.append({
                        "image": image_path.name,
                        "status": "no_pdf" if status.is_completed else status.analysis_status,
                        "request_id": analysis.request_id
                    })
            
            except Exception as e:
                logger.error(f"Error processing {image_path.name}: {e}")
                results.append({
                    "image": image_path.name,
                    "status": "error",
                    "error": str(e)
                })
    
    except Exception as e:
        logger.error(f"Error in asynchronous client test: {e}")
    
    finally:
        await client.close()
        logger.info("Asynchronous client test completed")
        
    return results

async def main():
    """Run diagnostic tests to fix the validation errors."""
    try:
        # Check API health first
        logger.info("===== Checking API Availability =====")
        client = BridgeIQClient(
            client_id=client_id,
            client_secret=client_secret,
            device_path=device_path,
            base_url=base_url,
        )
        
        is_healthy = client.health_check()
        logger.info(f"API health check result: {'Healthy' if is_healthy else 'Unhealthy'}")
        client.close()
        
        if not is_healthy:
            logger.error("API is not available. Cannot proceed with tests.")
            return
        
        # First, test different parameter combinations to find working parameters
        logger.info("Trying to find working parameters...")
        working_params = try_different_parameters()
        
        if working_params:
            logger.info(f"Will use working parameters: {working_params}")
        else:
            logger.warning("Could not find working parameters. Will try with default parameters.")
            working_params = {
                "radiography_type": "panoramic_adult",
                "patient_id": "TEST-123",
                "patient_name": "Test Patient",
            }
        
        # Run tests with synchronous client
        sync_results = test_sync_client_with_all_images(working_params)
        
        # Run tests with asynchronous client
        async_results = await test_async_client_with_all_images(working_params)
        
        # Generate summary report
        logger.info("===== Test Results Summary =====")
        logger.info(f"Synchronous test results: {len(sync_results)} images processed")
        logger.info(f"Asynchronous test results: {len(async_results)} images processed")
        
        # Count successes
        sync_success = sum(1 for r in sync_results if r.get("status") == "success")
        async_success = sum(1 for r in async_results if r.get("status") == "success")
        
        logger.info(f"Synchronous successes: {sync_success}/{len(sync_results)}")
        logger.info(f"Asynchronous successes: {async_success}/{len(async_results)}")
        
        # Check PDF files
        pdf_files = list(sample_pdf_dir.glob("*.pdf"))
        if pdf_files:
            logger.info(f"Generated {len(pdf_files)} PDF reports:")
            for pdf in pdf_files:
                logger.info(f"  - {pdf.name} ({pdf.stat().st_size} bytes)")
        else:
            logger.warning("No PDF files were generated during testing")
        
        # Save test results to file
        results_path = sample_pdf_dir / "test_results.json"
        with open(results_path, "w") as f:
            json.dump({
                "sync_results": sync_results,
                "async_results": async_results,
                "pdf_count": len(pdf_files),
                "parameters_used": working_params
            }, f, indent=2)
        
        logger.info(f"Test results saved to {results_path}")
    
    except Exception as e:
        logger.error(f"Unhandled exception during testing: {e}")


if __name__ == "__main__":
    asyncio.run(main()) 