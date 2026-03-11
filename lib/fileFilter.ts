/**
 * File Filter Utility
 * Filters out binary files and keeps only text-based code files
 */

// Text-based file extensions that should be included
const TEXT_FILE_EXTENSIONS = [
  // Code files
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py', 'pyw', 'pyi',
  'java', 'kt', 'scala',
  'cpp', 'c', 'h', 'hpp', 'cc', 'cxx',
  'cs', 'vb',
  'go', 'rs', 'swift', 'dart',
  'php', 'rb', 'pl', 'pm',
  'sh', 'bash', 'zsh', 'fish',
  'ps1', 'bat', 'cmd',
  'sql', 'r', 'm', 'matlab',
  'lua', 'vim', 'el',
  // Config files
  'json', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf',
  'xml', 'html', 'htm', 'xhtml',
  'css', 'scss', 'sass', 'less', 'styl',
  // Markup/Documentation
  'md', 'markdown', 'txt', 'rst',
  'vue', 'svelte',
  // Data formats
  'csv', 'tsv',
  // Config
  'env', 'gitignore', 'gitattributes', 'editorconfig',
  'dockerfile', 'makefile',
  // Other text formats
  'log', 'lock',
];

// Binary file extensions that should be excluded
const BINARY_FILE_EXTENSIONS = [
  // Images
  'ico', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'tiff', 'tif',
  // Fonts
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  // Archives
  'zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar',
  // Compiled
  'exe', 'dll', 'so', 'dylib', 'bin',
  // Media
  'mp3', 'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm',
  'pdf',
  // Other
  'db', 'sqlite', 'sqlite3',
];

/**
 * Check if a file path represents a binary file
 */
function isBinaryFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  
  // Check binary extensions
  if (BINARY_FILE_EXTENSIONS.includes(ext)) {
    return true;
  }
  
  // Check if it's a text file
  if (TEXT_FILE_EXTENSIONS.includes(ext)) {
    return false;
  }
  
  // For unknown extensions, check if content looks binary
  // This will be handled by content check
  return false;
}

/**
 * Check if file content appears to be binary
 */
function isBinaryContent(content: string): boolean {
  // Check for null bytes or high percentage of non-printable characters
  if (content.includes('\0')) {
    return true;
  }
  
  // Check for high percentage of non-ASCII characters
  const nonPrintableCount = (content.match(/[^\x20-\x7E\s]/g) || []).length;
  const totalChars = content.length;
  
  // If more than 30% are non-printable, likely binary
  if (totalChars > 0 && nonPrintableCount / totalChars > 0.3) {
    return true;
  }
  
  return false;
}

/**
 * Filter file structure to remove binary files
 */
export function filterTextFiles(files: any): any {
  if (!files || typeof files !== 'object') {
    return files;
  }

  const filtered: any = {};

  for (const [key, value] of Object.entries(files)) {
    if (typeof value === 'string') {
      // It's a file
      // Check extension first
      if (!isBinaryFile(key)) {
        // Check content if it's a suspicious file
        if (value.length > 0 && !isBinaryContent(value)) {
          filtered[key] = value;
        } else if (value.length === 0) {
          // Empty files are fine
          filtered[key] = value;
        }
        // Skip binary content files
      }
    } else if (typeof value === 'object' && value !== null) {
      // It's a directory, recurse
      const filteredDir = filterTextFiles(value);
      if (Object.keys(filteredDir).length > 0) {
        filtered[key] = filteredDir;
      }
    }
  }

  return filtered;
}

/**
 * Get file extension from path
 */
export function getFileExtension(filePath: string): string {
  const parts = filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

