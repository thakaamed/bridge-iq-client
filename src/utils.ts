/**
 * Utility functions for the BridgeIQ client.
 * 
 * This module provides helper functions, including device ID generation,
 * file handling, and user agent construction.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// Import version from package.json
import { version as VERSION } from '../package.json';

/**
 * Get a unique, persistent ID for the current machine.
 * 
 * @returns Unique machine identifier string
 */
export function getMachineId(): string {
  const configDir = path.join(os.homedir(), '.bridge_iq');
  const idFilePath = path.join(configDir, 'machine_id');
  
  // Create config directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  // Check if we already have a machine ID
  if (fs.existsSync(idFilePath)) {
    const machineId = fs.readFileSync(idFilePath, 'utf8').trim();
    if (machineId) {
      return machineId;
    }
  }
  
  // Generate a new machine ID
  const machineId = uuidv4();
  
  // Save the machine ID
  fs.writeFileSync(idFilePath, machineId);
  
  return machineId;
}

/**
 * Generate a detailed User-Agent string.
 * 
 * Format: BridgeIQ-Client/VERSION (OS/VERSION; NODE/VERSION; MACHINE/ID)
 * 
 * @returns User-Agent string
 */
export function getUserAgent(): string {
  const osInfo = `${os.platform()}/${os.release()}`;
  const machineId = getMachineId();
  
  return `BridgeIQ-Client/${VERSION} (${osInfo}; Machine/${machineId.substring(0, 8)})`;
}

/**
 * Check if a file is in DICOM format.
 * 
 * @param fileContent - Binary file content
 * @returns True if the file appears to be a DICOM file, False otherwise
 */
export function isDicomFile(fileContent: Buffer): boolean {
  // DICOM files should begin with a 128-byte preamble
  // followed by the string 'DICM'
  if (fileContent.length < 132) {
    return false;
  }
  
  // Check if the file has the DICOM magic bytes
  if (fileContent.slice(128, 132).toString() === 'DICM') {
    return true;
  }
  
  // Check for Kodak/Carestream RVG file signatures
  // Kodak/Carestream RVG files often have specific signatures
  const contentStart = fileContent.slice(0, 100).toString();
  if (contentStart.includes('RVGIMG') || 
      contentStart.includes('CSDRAY') || 
      contentStart.includes('Carestream')) {
    return true;
  }
  
  // Check for file extensions in the filename (if included in the binary data)
  const contentEnd = fileContent.toString();
  if (contentEnd.endsWith('.dcm') || contentEnd.endsWith('.rvg')) {
    return true;
  }
  
  return false;
}

/**
 * Read file content as Buffer.
 * 
 * @param filePath - Path to the file
 * @returns File content as Buffer
 * @throws Error if the file doesn't exist or can't be read
 */
export function getFileContent(filePath: string): Buffer {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  return fs.readFileSync(filePath);
}

/**
 * Save content to a file.
 * 
 * @param content - Binary content to save
 * @param filePath - Path where the file should be saved
 * @returns Path to the saved file
 * @throws Error if the file can't be written
 */
export function saveFile(content: Buffer, filePath: string): string {
  // Create directory if it doesn't exist
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(filePath, content);
  
  return filePath;
} 