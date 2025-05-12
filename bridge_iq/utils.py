"""
Utility functions for the BridgeIQ client.

This module provides helper functions, including device ID generation,
file handling, and user agent construction.
"""
import os
import platform
import socket
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Union

import platformdirs


def get_machine_id() -> str:
    """Get a unique, persistent ID for the current machine.
    
    Returns:
        Unique machine identifier string
    """
    app_name = "bridge_iq"
    app_author = "thakaamed"
    config_dir = platformdirs.user_config_dir(app_name, app_author)
    id_file_path = Path(config_dir) / "machine_id"
    
    # Create config directory if it doesn't exist
    os.makedirs(config_dir, exist_ok=True)
    
    # Check if we already have a machine ID
    if id_file_path.exists():
        with open(id_file_path, "r") as f:
            machine_id = f.read().strip()
            if machine_id:
                return machine_id
    
    # Generate a new machine ID
    machine_id = str(uuid.uuid4())
    
    # Save the machine ID
    with open(id_file_path, "w") as f:
        f.write(machine_id)
    
    return machine_id


def get_user_agent() -> str:
    """Generate a detailed User-Agent string.
    
    Format: BridgeIQ-Client/VERSION (OS/VERSION; PYTHON/VERSION; MACHINE/ID)
    
    Returns:
        User-Agent string
    """
    from bridge_iq import __version__
    
    os_info = f"{platform.system()}/{platform.release()}"
    python_info = f"Python/{platform.python_version()}"
    machine_id = get_machine_id()
    
    return f"BridgeIQ-Client/{__version__} ({os_info}; {python_info}; Machine/{machine_id[:8]})"


def is_dicom_file(file_content: bytes) -> bool:
    """Check if a file is in DICOM format.
    
    Args:
        file_content: Binary file content
        
    Returns:
        True if the file appears to be a DICOM file, False otherwise
    """
    # DICOM files should begin with a 128-byte preamble
    # followed by the string 'DICM'
    if len(file_content) < 132:
        return False
    
    # Check if the file has the DICOM magic bytes
    if file_content[128:132] == b'DICM':
        return True
    
    # Check for Kodak/Carestream RVG file signatures
    # Kodak/Carestream RVG files often have specific signatures
    if any(signature in file_content[:100] for signature in [b'RVGIMG', b'CSDRAY', b'Carestream']):
        return True
    
    # Check if the file has a .dcm extension
    if file_content.endswith(b'.dcm'):
        return True
    
    # Check for .rvg extension which is used by Kodak/Carestream
    if file_content.endswith(b'.rvg'):
        return True
        
    return False


def get_file_content(file_path: Union[str, Path]) -> bytes:
    """Read file content as bytes.
    
    Args:
        file_path: Path to the file
        
    Returns:
        File content as bytes
        
    Raises:
        FileNotFoundError: If the file doesn't exist
        IOError: If the file can't be read
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    
    with open(path, "rb") as f:
        return f.read()


def save_file(content: bytes, file_path: Union[str, Path]) -> Path:
    """Save content to a file.
    
    Args:
        content: Binary content to save
        file_path: Path where the file should be saved
        
    Returns:
        Path to the saved file
        
    Raises:
        IOError: If the file can't be written
    """
    path = Path(file_path)
    
    # Create directory if it doesn't exist
    path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(path, "wb") as f:
        f.write(content)
    
    return path 