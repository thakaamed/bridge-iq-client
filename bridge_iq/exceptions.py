"""
Custom exceptions for the BridgeIQ client.

This module provides a hierarchy of exceptions for handling various
error conditions when interacting with the ThakaaMed API.
"""
from typing import Any, Dict, Optional


class BridgeIQError(Exception):
    """Base exception for all BridgeIQ client errors."""
    
    def __init__(
        self, 
        message: str, 
        response: Optional[Dict[str, Any]] = None,
        status_code: Optional[int] = None
    ):
        """Initialize the exception.
        
        Args:
            message: Error message
            response: Optional API response data
            status_code: Optional HTTP status code
        """
        self.message = message
        self.response = response
        self.status_code = status_code
        super().__init__(self.message)


class AuthenticationError(BridgeIQError):
    """Exception raised for authentication failures."""
    pass


class ConnectionError(BridgeIQError):
    """Exception raised for network connection failures."""
    pass


class TimeoutError(BridgeIQError):
    """Exception raised when a request times out."""
    pass


class ResourceNotFoundError(BridgeIQError):
    """Exception raised when a requested resource is not found."""
    pass


class ValidationError(BridgeIQError):
    """Exception raised for invalid input parameters."""
    
    def __init__(
        self, 
        message: str, 
        field: Optional[str] = None,
        response: Optional[Dict[str, Any]] = None,
        status_code: Optional[int] = None
    ):
        """Initialize the validation error.
        
        Args:
            message: Error message
            field: Optional field name that failed validation
            response: Optional API response data
            status_code: Optional HTTP status code
        """
        self.field = field
        super().__init__(message, response, status_code)


class InsufficientTokensError(BridgeIQError):
    """Exception raised when the account doesn't have enough tokens."""
    pass


class ServerError(BridgeIQError):
    """Exception raised for server-side errors."""
    pass


class RateLimitError(BridgeIQError):
    """Exception raised when API rate limits are exceeded."""
    
    def __init__(
        self, 
        message: str, 
        retry_after: Optional[int] = None,
        response: Optional[Dict[str, Any]] = None,
        status_code: Optional[int] = None
    ):
        """Initialize the rate limit error.
        
        Args:
            message: Error message
            retry_after: Seconds to wait before retrying
            response: Optional API response data
            status_code: Optional HTTP status code
        """
        self.retry_after = retry_after
        super().__init__(message, response, status_code) 