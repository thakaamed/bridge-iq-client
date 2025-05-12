"""
Example script demonstrating how to use the BridgeIQ client library.

This script shows how to:
1. Initialize the client with API credentials
2. Check API availability
3. Send an image for analysis
4. Wait for the analysis to complete
5. Download the PDF report
"""
import json
import logging
import sys
import time
from pathlib import Path

# Import the library
from bridge_iq import BridgeIQClient, Environment
from bridge_iq.logger import setup_logger

# Configure logging
logger = setup_logger(level=logging.INFO, log_to_file=True)

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
base_url = credentials.get("base_url", "https://api.example.com/api/v1")

if not all([client_id, client_secret, device_path]):
    logger.error("Missing required credentials. Please check test_credentials.json")
    sys.exit(1)

# Path to the image file for analysis
# Replace with your actual file path
image_path = Path("sample-images/01f8def5-12c6-4810-bab8-9dae77924b4f.dcm")

# Main function
def main():
    # Initialize the client with credentials
    logger.info("Initializing BridgeIQ client")
    client = BridgeIQClient(
        client_id=client_id,
        client_secret=client_secret,
        device_path=device_path,
        base_url=base_url,
        environment=Environment.PRODUCTION,
        timeout=180,  # 3 minutes
    )
    
    try:
        # Check if the API is available
        logger.info("Checking API availability...")
        is_healthy = client.health_check()
        
        if not is_healthy:
            logger.error("API health check failed. Exiting.")
            return
        
        logger.info("API health check successful! Service is available.")
        
        # Send the image for analysis
        logger.info(f"Sending {image_path} for analysis")
        analysis = client.send_analysis(
            image_path=image_path,
            patient_id="SAMPLE-123",
            patient_name="John Doe",
            radiography_type="panoramic_adult",
        )
        
        # Display the request information
        logger.info(f"Analysis submitted successfully!")
        logger.info(f"Request ID: {analysis.request_id}")
        logger.info(f"Radiography type: {analysis.radiography_type}")
        logger.info(f"Token cost: {analysis.token_cost}")
        
        # Wait for the analysis to complete
        # This will poll the API in intervals to check the status
        logger.info("Waiting for analysis to complete...")
        
        try:
            status = client.wait_for_completion(
                request_id=analysis.request_id,
                timeout=600,  # 10 minutes
                poll_interval=10,  # Check every 10 seconds
            )
            
            logger.info(f"Analysis status: {status.analysis_status}")
            
            # Check if it completed successfully and has a PDF report
            if status.is_completed and status.has_pdf:
                # Download the PDF report
                pdf_path = Path(f"report_{analysis.request_id}.pdf")
                logger.info(f"Downloading PDF report to {pdf_path}")
                
                client.download_report(
                    report_url=status.report_pdf_link,
                    output_path=pdf_path,
                )
                
                logger.info(f"Report downloaded successfully to {pdf_path}")
            else:
                # Handle other statuses
                if status.is_failed:
                    logger.error(f"Analysis failed: {status.error_message}")
                elif not status.has_pdf:
                    logger.warning("Analysis completed but PDF is not yet available")
                    logger.info(f"Report status: {status.report_status}")
                    logger.info(f"PDF status: {status.pdf_status}")
        
        except Exception as e:
            logger.error(f"Error waiting for analysis: {e}")
    
    except Exception as e:
        logger.error(f"Error: {e}")
    
    finally:
        # Close the client when done
        client.close()


# Run the main function if the script is executed directly
if __name__ == "__main__":
    main() 