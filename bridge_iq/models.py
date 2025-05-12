"""
Data models for the BridgeIQ client.

This module provides Pydantic models for the BridgeIQ API responses
and request data.
"""
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Union, Any
from uuid import UUID

from pydantic import BaseModel, Field


class AnalysisStatusEnum(str, Enum):
    """Enum for analysis status values."""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    MANUAL_COMPLETED = "MANUAL_COMPLETED"
    FAILED = "FAILED"


class ReportStatusEnum(str, Enum):
    """Enum for report status values."""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class PDFStatusEnum(str, Enum):
    """Enum for PDF status values."""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class AnalysisRequest(BaseModel):
    """Model for an analysis request response."""
    analysis_id: str = Field(..., description="Unique identifier for the analysis (UUID)")
    request_id: str = Field(..., description="Unique identifier for the request (UUID)")
    radiography_type: str = Field(..., description="Type of radiography that was analyzed")
    token_cost: int = Field(..., description="Number of tokens consumed by this analysis")
    patient_id: Optional[str] = Field(None, description="Your provided patient identifier")
    check_analysis_url: str = Field(..., description="URL to check the status of the analysis")
    
    @property
    def uuid(self) -> UUID:
        """Get the analysis request ID as a UUID object."""
        return UUID(self.request_id)


class AnalysisStatus(BaseModel):
    """Model for an analysis status response."""
    analysis_id: str = Field(..., description="Unique identifier for the analysis (UUID)")
    request_id: str = Field(..., description="Unique identifier for the request (UUID)")
    radiography_type: str = Field(..., description="Type of radiography that was analyzed")
    patient_id: Optional[str] = Field(None, description="Your provided patient identifier")
    created_at: str = Field(..., description="ISO-8601 timestamp when the analysis request was created")
    updated_at: str = Field(..., description="ISO-8601 timestamp when the analysis was last updated")
    analysis_status: str = Field(..., description="Current status of the analysis")
    error_message: Optional[str] = Field(None, description="Error message if analysis failed")
    report_id: Optional[str] = Field(None, description="Unique identifier for the generated report (UUID)")
    report_status: Optional[str] = Field(None, description="Status of the report generation")
    pdf_status: Optional[str] = Field(None, description="Status of the PDF generation")
    report_pdf_link: Optional[str] = Field(None, description="URL to download the PDF report")
    report_error: Optional[str] = Field(None, description="Error message if report generation failed")
    
    @property
    def is_completed(self) -> bool:
        """Check if the analysis is complete and successful."""
        return self.analysis_status in (AnalysisStatusEnum.COMPLETED.value, AnalysisStatusEnum.MANUAL_COMPLETED.value)
    
    @property
    def is_failed(self) -> bool:
        """Check if the analysis has failed."""
        return self.analysis_status == AnalysisStatusEnum.FAILED.value
    
    @property
    def is_processing(self) -> bool:
        """Check if the analysis is still processing."""
        return self.analysis_status in (
            AnalysisStatusEnum.PENDING.value, 
            AnalysisStatusEnum.PROCESSING.value
        )
    
    @property
    def has_report(self) -> bool:
        """Check if the analysis has a report."""
        return self.report_id is not None
    
    @property
    def has_pdf(self) -> bool:
        """Check if the analysis has a PDF report available for download."""
        return (
            self.report_pdf_link is not None and 
            self.pdf_status == PDFStatusEnum.COMPLETED.value
        )
    
    @property
    def created_datetime(self) -> datetime:
        """Get the created_at timestamp as a datetime object."""
        return datetime.fromisoformat(self.created_at)
    
    @property
    def updated_datetime(self) -> datetime:
        """Get the updated_at timestamp as a datetime object."""
        return datetime.fromisoformat(self.updated_at)


class AnalysisResult(BaseModel):
    """Model for a complete analysis result."""
    analysis_id: str = Field(..., description="Unique identifier for the analysis (UUID)")
    result_data: Dict[str, Any] = Field(..., description="Complete analysis result data")
    created_at: str = Field(..., description="ISO-8601 timestamp when the analysis result was created")
    
    @property
    def created_datetime(self) -> datetime:
        """Get the created_at timestamp as a datetime object."""
        return datetime.fromisoformat(self.created_at) 