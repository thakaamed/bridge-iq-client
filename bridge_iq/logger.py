"""
Logging configuration for the BridgeIQ client.

This module provides a customized logger for the client library that
supports different log levels and formats.
"""
import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional, Union

import platformdirs


def setup_logger(
    name: str = "bridge_iq",
    level: Union[int, str] = logging.INFO,
    log_to_file: bool = False,
    log_file: Optional[Union[str, Path]] = None,
    max_file_size: int = 10 * 1024 * 1024,  # 10 MB
    backup_count: int = 3,
    format_string: Optional[str] = None,
) -> logging.Logger:
    """Set up a logger with console and optional file handlers.
    
    Args:
        name: Logger name
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_to_file: Whether to log to a file
        log_file: Path to log file. If None, uses default location
        max_file_size: Maximum size of log file before rotation (bytes)
        backup_count: Number of backup log files to keep
        format_string: Custom format string for log messages
        
    Returns:
        Configured logger instance
    """
    # Create logger
    logger = logging.getLogger(name)
    
    # Only set up handlers if none exist
    if not logger.handlers:
        # Set level
        if isinstance(level, str):
            level = getattr(logging, level.upper())
        logger.setLevel(level)
        
        # Create formatter
        if format_string is None:
            format_string = (
                "%(asctime)s - %(name)s - %(levelname)s - "
                "%(filename)s:%(lineno)d - %(message)s"
            )
        formatter = logging.Formatter(format_string)
        
        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
        
        # File handler (optional)
        if log_to_file:
            if log_file is None:
                # Use default location
                app_name = "bridge_iq"
                app_author = "thakaamed"
                log_dir = platformdirs.user_log_dir(app_name, app_author)
                os.makedirs(log_dir, exist_ok=True)
                log_file = Path(log_dir) / "bridge_iq.log"
            else:
                log_file = Path(log_file)
                os.makedirs(log_file.parent, exist_ok=True)
            
            file_handler = RotatingFileHandler(
                log_file,
                maxBytes=max_file_size,
                backupCount=backup_count,
            )
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
    
    return logger


# Default logger
logger = setup_logger()


def get_logger(
    name: Optional[str] = None,
    level: Optional[Union[int, str]] = None,
    log_to_file: bool = False,
) -> logging.Logger:
    """Get a configured logger.
    
    Args:
        name: Logger name. If None, returns the default logger
        level: Logging level. If None, uses the default level
        log_to_file: Whether to log to a file
        
    Returns:
        Configured logger instance
    """
    if name is None:
        # Return the default logger
        if level is not None:
            if isinstance(level, str):
                level = getattr(logging, level.upper())
            logger.setLevel(level)
        
        return logger
    
    # Create a new logger
    return setup_logger(
        name=name,
        level=level or logging.INFO,
        log_to_file=log_to_file,
    ) 