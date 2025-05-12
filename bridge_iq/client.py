"""
Main client implementation for the BridgeIQ API.

This module provides the main client classes for interacting with the
BridgeIQ API, including both synchronous and asynchronous implementations.
"""
import asyncio
import json
import logging
import os
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from urllib.parse import urljoin
from uuid import UUID

import httpx
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .environment import Environment
from .exceptions import (
    AuthenticationError,
    ConnectionError,
    InsufficientTokensError,
    ResourceNotFoundError,
    BridgeIQError,
    TimeoutError,
    ValidationError,
)
from .logger import get_logger
from .models import AnalysisRequest, AnalysisStatus, AnalysisResult
from .utils import get_file_content, get_user_agent, is_dicom_file, save_file


class BridgeIQClient:
    """Client for the BridgeIQ API.
    
    This client provides methods for interacting with the BridgeIQ API,
    including sending images for analysis and checking the status of
    analysis requests.
    """
    
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        device_path: str,
        base_url: str,
        environment: Union[Environment, str] = Environment.PRODUCTION,
        timeout: int = 120,
        max_retries: int = 3,
        logger: Optional[logging.Logger] = None,
    ):
        """Initialize the BridgeIQ client.
        
        Args:
            client_id: Client ID for authentication
            client_secret: Client secret for authentication
            device_path: Device path for API routes
            base_url: Base URL for API requests
            environment: API environment to use
            timeout: Request timeout in seconds
            max_retries: Maximum number of retries for failed requests
            logger: Optional custom logger instance
        """
        # API credentials and settings
        self.client_id = client_id
        self.client_secret = client_secret
        self.device_path = device_path
        self.base_url = base_url
        
        # Convert string to Environment enum if needed
        if isinstance(environment, str):
            self.environment = Environment.from_string(environment)
        else:
            self.environment = environment
            
        self.timeout = timeout
        
        # Configure logging
        self.logger = logger or get_logger()
        
        # Configure session with retries
        self.session = requests.Session()
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST"],
        )
        self.session.mount("http://", HTTPAdapter(max_retries=retry_strategy))
        self.session.mount("https://", HTTPAdapter(max_retries=retry_strategy))
        
        # Set default headers
        self.user_agent = get_user_agent()
        
        # Log initialization
        self.logger.info(
            f"BridgeIQ client initialized for device {device_path} "
            f"in {self.environment.value} environment using {base_url}"
        )
        
    def __enter__(self):
        """Support context manager interface."""
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Cleanup when exiting context manager."""
        self.close()
        
    def close(self) -> None:
        """Close the client session."""
        self.session.close()
        self.logger.debug("BridgeIQ client session closed")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for API requests.
        
        Returns:
            Headers dictionary with authentication and user agent
        """
        return {
            "User-Agent": self.user_agent,
            "client-id": self.client_id,
            "client-secret": self.client_secret,
        }
    
    def _handle_error_response(
        self, response: requests.Response, context: str = ""
    ) -> None:
        """Handle error responses from the API.
        
        Args:
            response: Response object from failed request
            context: Context string for logging
            
        Raises:
            Appropriate exception based on response status and content
        """
        try:
            data = response.json()
            message = data.get("message", "Unknown error")
        except (ValueError, KeyError):
            message = response.text or "Unknown error"
            data = {"message": message}
            
        # Log the error response
        self.logger.error(
            f"API error ({response.status_code}) during {context}: {message}"
        )
        
        # Raise appropriate exception based on status code
        if response.status_code == 401:
            raise AuthenticationError(
                f"Authentication failed: {message}", data, response.status_code
            )
        elif response.status_code == 402:
            raise InsufficientTokensError(
                f"Insufficient tokens: {message}", data, response.status_code
            )
        elif response.status_code == 404:
            raise ResourceNotFoundError(
                f"Resource not found: {message}", data, response.status_code
            )
        elif response.status_code == 400:
            raise ValidationError(
                f"Validation error: {message}", 
                field=None, 
                response=data, 
                status_code=response.status_code
            )
        elif response.status_code in (408, 504):
            raise TimeoutError(
                f"Request timed out: {message}", data, response.status_code
            )
        elif response.status_code in range(500, 600):
            # Server errors
            raise BridgeIQError(
                f"Server error ({response.status_code}): {message}", 
                data, 
                response.status_code
            )
        else:
            # General error catch-all
            raise BridgeIQError(
                f"API error ({response.status_code}): {message}", 
                data, 
                response.status_code
            )
    
    def health_check(self) -> bool:
        """Check if the API is available and functioning.
        
        Returns:
            True if the API is healthy, False otherwise
            
        Raises:
            ConnectionError: If the API request fails due to connection issues
        """
        self.logger.info("Checking API health")
        
        # Prepare request
        url = urljoin(self.base_url, "/api/v1/utils/health-check/")
        headers = self._get_headers()
        
        try:
            # Send request
            response = self.session.get(
                url=url,
                headers=headers,
                timeout=self.timeout,
            )
            
            # Parse response
            if response.ok:
                try:
                    data = response.json()
                    # Check if the response has a 'status' field
                    if isinstance(data, dict) and 'status' in data:
                        is_healthy = bool(data.get("status", False))
                    else:
                        # If no status field or data is not a dict, check if data itself is a boolean
                        is_healthy = bool(data) if data is not None else False
                    
                    self.logger.info(f"API health check result: {is_healthy}")
                    return is_healthy
                except (ValueError, KeyError, TypeError):
                    self.logger.warning(
                        f"API health check returned unexpected response format: {response.text}"
                    )
                    return False
            else:
                # In case of 404, the endpoint might not be implemented yet
                if response.status_code == 404:
                    self.logger.warning(
                        "Health check endpoint not found. API might still be functional."
                    )
                    # Return True as this is an expected response
                    return True
                    
                self.logger.warning(
                    f"API health check failed with status code {response.status_code}"
                )
                return False
                
        except requests.RequestException as e:
            message = f"Connection error during health check: {str(e)}"
            self.logger.error(message)
            raise ConnectionError(message) from e
    
    def send_analysis(
        self,
        image_path: Union[str, Path, bytes],
        patient_id: Optional[str] = None,
        patient_name: Optional[str] = None,
        patient_gender: Optional[str] = None,
        patient_dob: Optional[str] = None,
        radiography_type: Optional[str] = None,
        callback_url: Optional[str] = None,
        report_type: str = "standard",
    ) -> AnalysisRequest:
        """Send an image for analysis.
        
        Args:
            image_path: Path to the image file or raw image bytes
            patient_id: Optional patient identifier
            patient_name: Optional patient name
            patient_gender: Optional patient gender ('M' or 'F')
            patient_dob: Optional patient date of birth (YYYY-MM-DD)
            radiography_type: Optional radiography type override
            callback_url: Optional URL to notify when analysis is complete
            report_type: Type of report to generate (default: standard)
            
        Returns:
            AnalysisRequest object with request information
            
        Raises:
            FileNotFoundError: If the image file doesn't exist
            ConnectionError: If the API request fails due to connection issues
            ValidationError: If the request parameters are invalid
            AuthenticationError: If authentication fails
            InsufficientTokensError: If account doesn't have enough tokens
            BridgeIQError: For other API errors
        """
        # Prepare and validate image data
        if isinstance(image_path, (str, Path)):
            self.logger.info(f"Reading image from {image_path}")
            image_data = get_file_content(image_path)
            image_filename = os.path.basename(str(image_path))
        else:
            self.logger.info("Using provided image data")
            image_data = image_path
            image_filename = "image.dcm"
        
        # Prepare form data
        form_data = {
            "image": (image_filename, image_data),
            "report_type": (None, report_type),
        }
        
        # Add optional parameters if provided
        if radiography_type:
            form_data["radiography_type"] = (None, radiography_type)
        if patient_id:
            form_data["patient_id"] = (None, patient_id)
        if patient_name:
            form_data["patient_name"] = (None, patient_name)
        if patient_gender:
            form_data["patient_gender"] = (None, patient_gender)
        if patient_dob:
            form_data["patient_dob"] = (None, patient_dob)
        if callback_url:
            form_data["callback_url"] = (None, callback_url)
        
        # Prepare request
        url = urljoin(
            self.base_url, f"/api/v1/webhooks/devices/{self.device_path}/requests"
        )
        
        # Set headers with authentication credentials
        headers = {
            "User-Agent": self.user_agent,
            "client-id": self.client_id,
            "client-secret": self.client_secret,
        }
        
        self.logger.info(
            f"Sending analysis request for {image_filename}"
            + (f" (type: {radiography_type})" if radiography_type else "")
        )
        
        try:
            # Send request
            response = self.session.post(
                url=url,
                files=form_data,
                headers=headers,
                timeout=self.timeout,
            )
            
            # Handle successful response
            if response.status_code == 200:
                data = response.json()
                
                # Check for success status in JSON response
                if data.get("status") == "success":
                    self.logger.info(
                        f"Analysis request submitted successfully: "
                        f"{data.get('data', {}).get('request_id')}"
                    )
                    return AnalysisRequest(**data.get("data", {}))
                else:
                    # Handle API-level error in 200 response
                    message = data.get("message", "Unknown error")
                    self.logger.error(f"API returned error: {message}")
                    raise BridgeIQError(message, data)
            
            # Handle error responses
            self._handle_error_response(response, "analysis request")
            
        except requests.RequestException as e:
            message = f"Connection error during analysis request: {str(e)}"
            self.logger.error(message)
            raise ConnectionError(message) from e
    
    def check_status(self, request_id: Union[str, UUID]) -> AnalysisStatus:
        """Check the status of an analysis request.
        
        Args:
            request_id: The analysis request ID
            
        Returns:
            AnalysisStatus object with status information
            
        Raises:
            ConnectionError: If the API request fails due to connection issues
            ValidationError: If the request parameters are invalid
            AuthenticationError: If authentication fails
            ResourceNotFoundError: If the analysis request doesn't exist
            BridgeIQError: For other API errors
        """
        # Normalize request_id
        if isinstance(request_id, UUID):
            request_id = str(request_id)
        
        # Prepare request
        url = urljoin(
            self.base_url, 
            f"/api/v1/webhooks/devices/{self.device_path}/requests/{request_id}"
        )
        headers = self._get_headers()
        
        self.logger.info(f"Checking status for analysis request {request_id}")
        
        try:
            # Send request
            response = self.session.get(
                url=url,
                headers=headers,
                timeout=self.timeout,
            )
            
            # Handle successful response
            if response.status_code == 200:
                data = response.json()
                
                # Check for success status in JSON response
                if data.get("status") == "success":
                    self.logger.info(
                        f"Analysis status: {data.get('data', {}).get('analysis_status')}"
                    )
                    return AnalysisStatus(**data.get("data", {}))
                else:
                    # Handle API-level error in 200 response
                    message = data.get("message", "Unknown error")
                    self.logger.error(f"API returned error: {message}")
                    raise BridgeIQError(message, data)
            
            # Handle error responses
            self._handle_error_response(response, "status check")
            
        except requests.RequestException as e:
            message = f"Connection error during status check: {str(e)}"
            self.logger.error(message)
            raise ConnectionError(message) from e
    
    def wait_for_completion(
        self, 
        request_id: Union[str, UUID],
        timeout: int = 300,
        poll_interval: int = 5,
    ) -> AnalysisStatus:
        """Wait for an analysis to complete.
        
        Args:
            request_id: The analysis request ID
            timeout: Maximum time to wait in seconds
            poll_interval: Time between status checks in seconds
            
        Returns:
            Final AnalysisStatus object
            
        Raises:
            TimeoutError: If the analysis doesn't complete within the timeout
            Same exceptions as check_status()
        """
        start_time = time.time()
        end_time = start_time + timeout
        
        self.logger.info(
            f"Waiting for analysis {request_id} to complete "
            f"(timeout: {timeout}s, poll interval: {poll_interval}s)"
        )
        
        while time.time() < end_time:
            # Check status
            status = self.check_status(request_id)
            
            # If completed or failed, return status
            if status.is_completed or status.is_failed:
                self.logger.info(
                    f"Analysis {request_id} finished with status: {status.analysis_status}"
                )
                return status
            
            # If still processing, wait and try again
            self.logger.debug(
                f"Analysis {request_id} still processing. "
                f"Waiting {poll_interval} seconds..."
            )
            time.sleep(poll_interval)
        
        # If we get here, the timeout was reached
        elapsed = time.time() - start_time
        message = f"Timeout waiting for analysis to complete ({elapsed:.1f}s elapsed)"
        self.logger.error(message)
        raise TimeoutError(message)
    
    def download_report(
        self, 
        report_url: str,
        output_path: Union[str, Path],
    ) -> Path:
        """Download a PDF report.
        
        Args:
            report_url: URL to the PDF report
            output_path: Path where the PDF should be saved
            
        Returns:
            Path to the saved PDF file
            
        Raises:
            ConnectionError: If the download fails due to connection issues
            ResourceNotFoundError: If the report doesn't exist
            BridgeIQError: For other API errors
        """
        self.logger.info(f"Downloading report from {report_url}")
        
        # Determine if we need to use a full URL or just the path
        if report_url.startswith("http"):
            url = report_url
        else:
            # If it's a path, join with base URL
            url = urljoin(self.base_url, report_url.lstrip("/"))
        
        try:
            # Send request
            response = self.session.get(
                url=url,
                timeout=self.timeout,
            )
            
            # Handle successful response
            if response.status_code == 200:
                # Save the PDF
                output_file = save_file(response.content, output_path)
                self.logger.info(f"Report saved to {output_file}")
                return output_file
            
            # Handle error responses
            self._handle_error_response(response, "report download")
            
        except requests.RequestException as e:
            message = f"Connection error during report download: {str(e)}"
            self.logger.error(message)
            raise ConnectionError(message) from e


class AsyncBridgeIQClient:
    """Asynchronous client for the BridgeIQ API.
    
    This client provides asynchronous methods for interacting with the BridgeIQ API,
    including sending images for analysis and checking the status of
    analysis requests.
    """
    
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        device_path: str,
        base_url: str,
        environment: Union[Environment, str] = Environment.PRODUCTION,
        timeout: int = 120,
        max_retries: int = 3,
        logger: Optional[logging.Logger] = None,
    ):
        """Initialize the async BridgeIQ client.
        
        Args:
            client_id: Client ID for authentication
            client_secret: Client secret for authentication
            device_path: Device path for API routes
            base_url: Base URL for API requests
            environment: API environment to use
            timeout: Request timeout in seconds
            max_retries: Maximum number of retries for failed requests
            logger: Optional custom logger instance
        """
        # API credentials and settings
        self.client_id = client_id
        self.client_secret = client_secret
        self.device_path = device_path
        self.base_url = base_url
        
        # Convert string to Environment enum if needed
        if isinstance(environment, str):
            self.environment = Environment.from_string(environment)
        else:
            self.environment = environment
            
        self.timeout = timeout
        self.max_retries = max_retries
        
        # Configure logging
        self.logger = logger or get_logger()
        
        # Set default headers
        self.user_agent = get_user_agent()
        
        # Client will be created in an async context
        self.client = None
        
        # Log initialization
        self.logger.info(
            f"Async BridgeIQ client initialized for device {device_path} "
            f"in {self.environment.value} environment using {base_url}"
        )
    
    async def __aenter__(self):
        """Support async context manager interface."""
        if self.client is None:
            self.client = httpx.AsyncClient(timeout=self.timeout)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Cleanup when exiting async context manager."""
        await self.close()
    
    async def close(self) -> None:
        """Close the async client session."""
        if self.client:
            await self.client.aclose()
            self.client = None
            self.logger.debug("Async BridgeIQ client session closed")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for API requests.
        
        Returns:
            Headers dictionary with authentication and user agent
        """
        return {
            "User-Agent": self.user_agent,
            "client-id": self.client_id,
            "client-secret": self.client_secret,
        }
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the async HTTP client.
        
        Returns:
            Async HTTP client
        """
        if self.client is None:
            self.client = httpx.AsyncClient(timeout=self.timeout)
        return self.client
    
    async def _handle_error_response(
        self, response: httpx.Response, context: str = ""
    ) -> None:
        """Handle error responses from the API.
        
        Args:
            response: Response object from failed request
            context: Context string for logging
            
        Raises:
            Appropriate exception based on response status and content
        """
        try:
            data = response.json()
            message = data.get("message", "Unknown error")
        except (ValueError, KeyError):
            message = response.text or "Unknown error"
            data = {"message": message}
            
        # Log the error response
        self.logger.error(
            f"API error ({response.status_code}) during {context}: {message}"
        )
        
        # Raise appropriate exception based on status code
        if response.status_code == 401:
            raise AuthenticationError(
                f"Authentication failed: {message}", data, response.status_code
            )
        elif response.status_code == 402:
            raise InsufficientTokensError(
                f"Insufficient tokens: {message}", data, response.status_code
            )
        elif response.status_code == 404:
            raise ResourceNotFoundError(
                f"Resource not found: {message}", data, response.status_code
            )
        elif response.status_code == 400:
            raise ValidationError(
                f"Validation error: {message}", 
                field=None, 
                response=data, 
                status_code=response.status_code
            )
        elif response.status_code in (408, 504):
            raise TimeoutError(
                f"Request timed out: {message}", data, response.status_code
            )
        elif response.status_code in range(500, 600):
            # Server errors
            raise BridgeIQError(
                f"Server error ({response.status_code}): {message}", 
                data, 
                response.status_code
            )
        else:
            # General error catch-all
            raise BridgeIQError(
                f"API error ({response.status_code}): {message}", 
                data, 
                response.status_code
            )
    
    async def health_check(self) -> bool:
        """Check if the API is available and functioning asynchronously.
        
        Returns:
            True if the API is healthy, False otherwise
            
        Raises:
            ConnectionError: If the API request fails due to connection issues
        """
        self.logger.info("Checking API health asynchronously")
        
        # Prepare request
        url = urljoin(self.base_url, "/api/v1/utils/health-check/")
        headers = self._get_headers()
        
        # Get client
        client = await self._get_client()
        
        try:
            # Send request
            response = await client.get(
                url=url,
                headers=headers,
                timeout=self.timeout,
            )
            
            # Parse response
            if response.status_code == 200:
                try:
                    data = response.json()
                    # Check if the response has a 'status' field
                    if isinstance(data, dict) and 'status' in data:
                        is_healthy = bool(data.get("status", False))
                    else:
                        # If no status field or data is not a dict, check if data itself is a boolean
                        is_healthy = bool(data) if data is not None else False
                    
                    self.logger.info(f"Async API health check result: {is_healthy}")
                    return is_healthy
                except (ValueError, KeyError, TypeError):
                    self.logger.warning(
                        f"Async API health check returned unexpected response format: {response.text}"
                    )
                    return False
            else:
                # In case of 404, the endpoint might not be implemented yet
                if response.status_code == 404:
                    self.logger.warning(
                        "Health check endpoint not found. API might still be functional."
                    )
                    # Return True as this is an expected response
                    return True
                    
                self.logger.warning(
                    f"Async API health check failed with status code {response.status_code}"
                )
                return False
                
        except httpx.RequestError as e:
            message = f"Connection error during async health check: {str(e)}"
            self.logger.error(message)
            raise ConnectionError(message) from e
    
    async def send_analysis(
        self,
        image_path: Union[str, Path, bytes],
        patient_id: Optional[str] = None,
        patient_name: Optional[str] = None,
        patient_gender: Optional[str] = None,
        patient_dob: Optional[str] = None,
        radiography_type: Optional[str] = None,
        callback_url: Optional[str] = None,
        report_type: str = "standard",
    ) -> AnalysisRequest:
        """Send an image for analysis asynchronously.
        
        Args:
            image_path: Path to the image file or raw image bytes
            patient_id: Optional patient identifier
            patient_name: Optional patient name
            patient_gender: Optional patient gender ('M' or 'F')
            patient_dob: Optional patient date of birth (YYYY-MM-DD)
            radiography_type: Optional radiography type override
            callback_url: Optional URL to notify when analysis is complete
            report_type: Type of report to generate (default: standard)
            
        Returns:
            AnalysisRequest object with request information
            
        Raises:
            FileNotFoundError: If the image file doesn't exist
            ConnectionError: If the API request fails due to connection issues
            ValidationError: If the request parameters are invalid
            AuthenticationError: If authentication fails
            InsufficientTokensError: If account doesn't have enough tokens
            BridgeIQError: For other API errors
        """
        # Prepare and validate image data
        if isinstance(image_path, (str, Path)):
            self.logger.info(f"Reading image from {image_path}")
            image_data = get_file_content(image_path)
            image_filename = os.path.basename(str(image_path))
        else:
            self.logger.info("Using provided image data")
            image_data = image_path
            image_filename = "image.dcm"
        
        # Prepare form data
        form_data = {
            "report_type": report_type,
        }
        
        # Add optional parameters if provided
        if radiography_type:
            form_data["radiography_type"] = radiography_type
        if patient_id:
            form_data["patient_id"] = patient_id
        if patient_name:
            form_data["patient_name"] = patient_name
        if patient_gender:
            form_data["patient_gender"] = patient_gender
        if patient_dob:
            form_data["patient_dob"] = patient_dob
        if callback_url:
            form_data["callback_url"] = callback_url
        
        # Prepare file data
        files = {"image": (image_filename, image_data)}
        
        # Prepare request
        url = urljoin(
            self.base_url, f"/api/v1/webhooks/devices/{self.device_path}/requests"
        )
        
        # Set headers with authentication credentials
        headers = {
            "User-Agent": self.user_agent,
            "client-id": self.client_id,
            "client-secret": self.client_secret,
        }
        
        self.logger.info(
            f"Sending analysis request for {image_filename}"
            + (f" (type: {radiography_type})" if radiography_type else "")
        )
        
        # Get client
        client = await self._get_client()
        
        try:
            # Send request
            response = await client.post(
                url=url,
                files=files,
                data=form_data,
                headers=headers,
                timeout=self.timeout,
            )
            
            # Handle successful response
            if response.status_code == 200:
                data = response.json()
                
                # Check for success status in JSON response
                if data.get("status") == "success":
                    self.logger.info(
                        f"Analysis request submitted successfully: "
                        f"{data.get('data', {}).get('request_id')}"
                    )
                    return AnalysisRequest(**data.get("data", {}))
                else:
                    # Handle API-level error in 200 response
                    message = data.get("message", "Unknown error")
                    self.logger.error(f"API returned error: {message}")
                    raise BridgeIQError(message, data)
            
            # Handle error responses
            await self._handle_error_response(response, "analysis request")
            
        except httpx.RequestError as e:
            message = f"Connection error during analysis request: {str(e)}"
            self.logger.error(message)
            raise ConnectionError(message) from e
    
    async def check_status(self, request_id: Union[str, UUID]) -> AnalysisStatus:
        """Check the status of an analysis request asynchronously.
        
        Args:
            request_id: The analysis request ID
            
        Returns:
            AnalysisStatus object with status information
            
        Raises:
            ConnectionError: If the API request fails due to connection issues
            ValidationError: If the request parameters are invalid
            AuthenticationError: If authentication fails
            ResourceNotFoundError: If the analysis request doesn't exist
            BridgeIQError: For other API errors
        """
        # Normalize request_id
        if isinstance(request_id, UUID):
            request_id = str(request_id)
        
        # Prepare request
        url = urljoin(
            self.base_url, 
            f"/api/v1/webhooks/devices/{self.device_path}/requests/{request_id}"
        )
        headers = self._get_headers()
        
        self.logger.info(f"Checking status for analysis request {request_id}")
        
        # Get client
        client = await self._get_client()
        
        try:
            # Send request
            response = await client.get(
                url=url,
                headers=headers,
                timeout=self.timeout,
            )
            
            # Handle successful response
            if response.status_code == 200:
                data = response.json()
                
                # Check for success status in JSON response
                if data.get("status") == "success":
                    self.logger.info(
                        f"Analysis status: {data.get('data', {}).get('analysis_status')}"
                    )
                    return AnalysisStatus(**data.get("data", {}))
                else:
                    # Handle API-level error in 200 response
                    message = data.get("message", "Unknown error")
                    self.logger.error(f"API returned error: {message}")
                    raise BridgeIQError(message, data)
            
            # Handle error responses
            await self._handle_error_response(response, "status check")
            
        except httpx.RequestError as e:
            message = f"Connection error during status check: {str(e)}"
            self.logger.error(message)
            raise ConnectionError(message) from e
    
    async def wait_for_completion(
        self, 
        request_id: Union[str, UUID],
        timeout: int = 300,
        poll_interval: int = 5,
    ) -> AnalysisStatus:
        """Wait for an analysis to complete asynchronously.
        
        Args:
            request_id: The analysis request ID
            timeout: Maximum time to wait in seconds
            poll_interval: Time between status checks in seconds
            
        Returns:
            Final AnalysisStatus object
            
        Raises:
            TimeoutError: If the analysis doesn't complete within the timeout
            Same exceptions as check_status()
        """
        start_time = time.time()
        end_time = start_time + timeout
        
        self.logger.info(
            f"Waiting for analysis {request_id} to complete "
            f"(timeout: {timeout}s, poll interval: {poll_interval}s)"
        )
        
        while time.time() < end_time:
            # Check status
            status = await self.check_status(request_id)
            
            # If completed or failed, return status
            if status.is_completed or status.is_failed:
                self.logger.info(
                    f"Analysis {request_id} finished with status: {status.analysis_status}"
                )
                return status
            
            # If still processing, wait and try again
            self.logger.debug(
                f"Analysis {request_id} still processing. "
                f"Waiting {poll_interval} seconds..."
            )
            await asyncio.sleep(poll_interval)
        
        # If we get here, the timeout was reached
        elapsed = time.time() - start_time
        message = f"Timeout waiting for analysis to complete ({elapsed:.1f}s elapsed)"
        self.logger.error(message)
        raise TimeoutError(message)
    
    async def download_report(
        self, 
        report_url: str,
        output_path: Union[str, Path],
    ) -> Path:
        """Download a PDF report asynchronously.
        
        Args:
            report_url: URL to the PDF report
            output_path: Path where the PDF should be saved
            
        Returns:
            Path to the saved PDF file
            
        Raises:
            ConnectionError: If the download fails due to connection issues
            ResourceNotFoundError: If the report doesn't exist
            BridgeIQError: For other API errors
        """
        self.logger.info(f"Downloading report from {report_url}")
        
        # Determine if we need to use a full URL or just the path
        if report_url.startswith("http"):
            url = report_url
        else:
            # If it's a path, join with base URL
            url = urljoin(self.base_url, report_url.lstrip("/"))
        
        # Get client
        client = await self._get_client()
        
        try:
            # Send request
            response = await client.get(
                url=url,
                timeout=self.timeout,
            )
            
            # Handle successful response
            if response.status_code == 200:
                # Save the PDF
                output_file = save_file(response.content, output_path)
                self.logger.info(f"Report saved to {output_file}")
                return output_file
            
            # Handle error responses
            await self._handle_error_response(response, "report download")
            
        except httpx.RequestError as e:
            message = f"Connection error during report download: {str(e)}"
            self.logger.error(message)
            raise ConnectionError(message) from e 