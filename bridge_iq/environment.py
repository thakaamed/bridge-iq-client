"""
Environment configuration for the BridgeIQ client.

This module provides environment-specific configuration for different 
deployment scenarios (production, testing).
"""
from enum import Enum
from typing import Dict, Optional

class Environment(str, Enum):
    """Environment configuration for the BridgeIQ client."""
    
    PRODUCTION = "production"
    TESTING = "testing"
    
    @classmethod
    def from_string(cls, env_string: str) -> "Environment":
        """Create an Environment from a string value.
        
        Args:
            env_string: String representation of environment
            
        Returns:
            Environment instance
            
        Raises:
            ValueError: If the string doesn't match a valid environment
        """
        try:
            return cls(env_string.lower())
        except ValueError:
            valid_values = ", ".join([e.value for e in cls])
            raise ValueError(
                f"Invalid environment: {env_string}. "
                f"Valid values are: {valid_values}"
            ) 