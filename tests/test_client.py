"""
Tests for the BridgeIQ client.

These tests verify the functionality of the BridgeIQ client library.
To run these tests, you need valid API credentials in test_credentials.json.
"""
import json
import os
import sys
import unittest
from pathlib import Path
from unittest import mock

# Add parent directory to path for importing the library
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from bridge_iq import BridgeIQClient, Environment
from bridge_iq.exceptions import ValidationError, AuthenticationError


class TestBridgeIQClient(unittest.TestCase):
    """Tests for the BridgeIQClient class."""
    
    def setUp(self):
        """Set up test fixtures."""
        # Load credentials from the JSON file
        try:
            with open("test_credentials.json", "r") as f:
                self.credentials = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            self.credentials = {
                "client_id": "test_client_id",
                "client_secret": "test_client_secret",
                "api_device_path": "test_device_path",
                "base_url": "https://test.api.example.com/api/v1"
            }
        
        # Create a client instance with test credentials
        self.client = BridgeIQClient(
            client_id=self.credentials.get("client_id"),
            client_secret=self.credentials.get("client_secret"),
            device_path=self.credentials.get("api_device_path"),
            base_url=self.credentials.get("base_url"),
            environment=Environment.TESTING,  # Use testing for tests
        )
    
    def tearDown(self):
        """Clean up after tests."""
        self.client.close()
    
    def test_initialization(self):
        """Test client initialization."""
        self.assertEqual(self.client.client_id, self.credentials.get("client_id"))
        self.assertEqual(self.client.client_secret, self.credentials.get("client_secret"))
        self.assertEqual(self.client.device_path, self.credentials.get("api_device_path"))
        self.assertEqual(self.client.base_url, self.credentials.get("base_url"))
        self.assertEqual(self.client.environment, Environment.TESTING)
    
    def test_environment_from_string(self):
        """Test environment initialization from string."""
        client = BridgeIQClient(
            client_id="test",
            client_secret="test",
            device_path="test",
            base_url="https://api.example.com/api/v1",
            environment="production",
        )
        self.assertEqual(client.environment, Environment.PRODUCTION)
        client.close()
    
    def test_invalid_environment(self):
        """Test invalid environment handling."""
        with self.assertRaises(ValueError):
            BridgeIQClient(
                client_id="test",
                client_secret="test",
                device_path="test",
                base_url="https://api.example.com/api/v1",
                environment="invalid",
            )
    
    @mock.patch("requests.Session.get")
    def test_health_check(self, mock_get):
        """Test the health check functionality."""
        # Mock the response for healthy API
        mock_response = mock.Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "healthy",
            "message": "Service is running normally",
        }
        mock_get.return_value = mock_response
        
        # Test the health check method
        is_healthy = self.client.health_check()
        
        # Verify the result
        self.assertTrue(is_healthy)
        
        # Verify the API was called correctly
        mock_get.assert_called_once()
        args, kwargs = mock_get.call_args
        self.assertIn("/health", kwargs.get("url", ""))
        
        # Verify headers
        headers = kwargs.get("headers", {})
        self.assertIn("client-id", headers)
        self.assertIn("client-secret", headers)
        self.assertEqual(headers["client-id"], self.credentials.get("client_id"))
        self.assertEqual(headers["client-secret"], self.credentials.get("client_secret"))
    
    @mock.patch("requests.Session.get")
    def test_health_check_unhealthy(self, mock_get):
        """Test the health check with unhealthy API response."""
        # Mock the response for unhealthy API
        mock_response = mock.Mock()
        mock_response.status_code = 500
        mock_response.json.return_value = {
            "status": "error",
            "message": "Service is experiencing issues",
        }
        mock_get.return_value = mock_response
        
        # Test the health check method
        is_healthy = self.client.health_check()
        
        # Verify the result
        self.assertFalse(is_healthy)
    
    @mock.patch("requests.Session.post")
    def test_send_analysis(self, mock_post):
        """Test sending an analysis request."""
        # Mock the response
        mock_response = mock.Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "success",
            "message": "Analysis request submitted successfully",
            "data": {
                "analysis_id": "test_analysis_id",
                "request_id": "550e8400-e29b-41d4-a716-446655440000",
                "radiography_type": "panoramic_adult",
                "token_cost": 10,
                "patient_id": "TEST-123",
                "check_analysis_url": "https://api.example.com/api/v1/check/550e8400-e29b-41d4-a716-446655440000",
            },
        }
        mock_post.return_value = mock_response
        
        # Create a mock image
        mock_image_data = b"fake image data"
        
        # Test the send_analysis method
        result = self.client.send_analysis(
            image_path=mock_image_data,
            patient_id="TEST-123",
            radiography_type="panoramic_adult",
        )
        
        # Verify the result
        self.assertEqual(result.request_id, "550e8400-e29b-41d4-a716-446655440000")
        self.assertEqual(result.radiography_type, "panoramic_adult")
        self.assertEqual(result.token_cost, 10)
        
        # Verify the API was called correctly
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertIn(f"/webhooks/devices/{self.credentials.get('api_device_path')}/requests", kwargs.get("url", ""))
        
        # Verify headers
        headers = kwargs.get("headers", {})
        self.assertIn("client-id", headers)
        self.assertIn("client-secret", headers)
        self.assertEqual(headers["client-id"], self.credentials.get("client_id"))
        self.assertEqual(headers["client-secret"], self.credentials.get("client_secret"))
    
    @mock.patch("requests.Session.post")
    def test_send_analysis_error(self, mock_post):
        """Test error handling in send_analysis."""
        # Mock the error response
        mock_response = mock.Mock()
        mock_response.status_code = 400
        mock_response.json.return_value = {
            "status": "error",
            "message": "Validation error: Invalid radiography type",
        }
        mock_post.return_value = mock_response
        
        # Create a mock image
        mock_image_data = b"fake image data"
        
        # Test the send_analysis method with invalid data
        with self.assertRaises(ValidationError):
            self.client.send_analysis(
                image_path=mock_image_data,
                radiography_type="invalid_type",
            )
    
    @mock.patch("requests.Session.get")
    def test_check_analysis(self, mock_get):
        """Test checking analysis status."""
        # Mock the response
        mock_response = mock.Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "success",
            "message": "Analysis status retrieved successfully",
            "data": {
                "analysis_status": "completed",
                "report_status": "completed",
                "pdf_status": "completed",
                "report_pdf_link": "https://example.com/report.pdf",
            },
        }
        mock_get.return_value = mock_response
        
        # Test the check_analysis method
        result = self.client.check_analysis(request_id="test_request_id")
        
        # Verify the result
        self.assertTrue(result.is_completed)
        self.assertTrue(result.has_pdf)
        self.assertEqual(result.report_pdf_link, "https://example.com/report.pdf")
        
        # Verify the API was called correctly
        mock_get.assert_called_once()
        args, kwargs = mock_get.call_args
        self.assertIn("/check/test_request_id", kwargs.get("url", ""))
        
        # Verify headers
        headers = kwargs.get("headers", {})
        self.assertIn("client-id", headers)
        self.assertIn("client-secret", headers)
        self.assertEqual(headers["client-id"], self.credentials.get("client_id"))
        self.assertEqual(headers["client-secret"], self.credentials.get("client_secret"))


if __name__ == "__main__":
    unittest.main() 