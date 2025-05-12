"""
BridgeIQ Client - Python client for ThakaaMed's imaging AI service.

This library provides a simple, Pythonic interface to ThakaaMed's
radiography analysis API, allowing easy submission of images for AI analysis
and retrieval of reports.
"""

__version__ = "0.1.0"

from .client import BridgeIQClient, AsyncBridgeIQClient
from .environment import Environment
from .models import (
    AnalysisRequest,
    AnalysisStatus,
    AnalysisStatusEnum,
    ReportStatusEnum,
    PDFStatusEnum,
)
from .exceptions import (
    BridgeIQError,
    AuthenticationError,
    ConnectionError,
    TimeoutError,
    ResourceNotFoundError,
    ValidationError,
    InsufficientTokensError,
)

__all__ = [
    "BridgeIQClient",
    "AsyncBridgeIQClient",
    "Environment",
    "AnalysisRequest",
    "AnalysisStatus",
    "AnalysisStatusEnum",
    "ReportStatusEnum",
    "PDFStatusEnum",
    "BridgeIQError",
    "AuthenticationError",
    "ConnectionError",
    "TimeoutError",
    "ResourceNotFoundError",
    "ValidationError",
    "InsufficientTokensError",
] 