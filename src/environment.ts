/**
 * Environment configuration for the BridgeIQ client.
 * 
 * This module provides environment-specific configuration for different 
 * deployment scenarios (production, testing).
 */

/**
 * Environment types for the BridgeIQ client.
 */
export enum Environment {
  PRODUCTION = 'production',
  TESTING = 'testing',
}

/**
 * Create an Environment from a string value.
 * 
 * @param envString - String representation of environment
 * @returns Environment enum value
 * @throws Error if the string doesn't match a valid environment
 */
export function fromString(envString: string): Environment {
  const lowerEnv = envString.toLowerCase();
  
  if (Object.values(Environment).includes(lowerEnv as Environment)) {
    return lowerEnv as Environment;
  }
  
  const validValues = Object.values(Environment).join(', ');
  throw new Error(`Invalid environment: ${envString}. Valid values are: ${validValues}`);
} 