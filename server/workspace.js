const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Base directory for all workspaces
const WORKSPACES_DIR = path.join(__dirname, '../workspaces');

// Ensure workspaces directory exists
async function ensureWorkspacesDir() {
  try {
    await fs.mkdir(WORKSPACES_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating workspaces directory:', error);
  }
}

// Initialize workspace directory structure
async function initializeWorkspace(workspaceId, project) {
  await ensureWorkspacesDir();
  const workspacePath = path.join(WORKSPACES_DIR, workspaceId);
  
  try {
    // Create workspace directory
    await fs.mkdir(workspacePath, { recursive: true });
    
    // Write all files from project template
    await writeFileStructure(workspacePath, project.files);
    
    return workspacePath;
  } catch (error) {
    console.error('Error initializing workspace:', error);
    throw error;
  }
}

// Recursively write file structure
async function writeFileStructure(basePath, structure) {
  for (const [name, content] of Object.entries(structure)) {
    const filePath = path.join(basePath, name);
    
    if (typeof content === 'string') {
      // It's a file
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content, 'utf8');
    } else {
      // It's a directory
      await fs.mkdir(filePath, { recursive: true });
      await writeFileStructure(filePath, content);
    }
  }
}

// Get workspace path
function getWorkspacePath(workspaceId) {
  return path.join(WORKSPACES_DIR, workspaceId);
}

// Read file
async function readFile(workspaceId, filePath) {
  const workspacePath = getWorkspacePath(workspaceId);
  const fullPath = path.join(workspacePath, filePath);
  
  try {
    const content = await fs.readFile(fullPath, 'utf8');
    return content;
  } catch (error) {
    throw new Error(`File not found: ${filePath}`);
  }
}

// Write file
async function writeFile(workspaceId, filePath, content) {
  const workspacePath = getWorkspacePath(workspaceId);
  const fullPath = path.join(workspacePath, filePath);
  const dir = path.dirname(fullPath);
  
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
    return true;
  } catch (error) {
    throw new Error(`Failed to write file: ${filePath}`);
  }
}

// List directory
async function listDirectory(workspaceId, dirPath = '.') {
  const workspacePath = getWorkspacePath(workspaceId);
  const fullPath = path.join(workspacePath, dirPath);
  
  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const result = [];
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        result.push({ name: entry.name, type: 'directory', path: entryPath });
      } else {
        result.push({ name: entry.name, type: 'file', path: entryPath });
      }
    }
    
    return result;
  } catch (error) {
    throw new Error(`Failed to list directory: ${dirPath}`);
  }
}

// Execute command in workspace
async function executeCommand(workspaceId, command, args = [], options = {}) {
  const workspacePath = getWorkspacePath(workspaceId);
  const { cwd = workspacePath, env = process.env } = options;
  
  return new Promise((resolve, reject) => {
    // On Windows, npm and npx need .cmd extension
    let fullCommand = command;
    if (process.platform === 'win32') {
      if (command === 'npm' || command === 'npx') {
        fullCommand = `${command}.cmd`;
      }
    }
    const child = spawn(fullCommand, args, {
      cwd: cwd || workspacePath, // Use provided cwd
      env: env, // Use provided env (should already include FORCE_COLOR and ports)
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr,
        success: code === 0,
      });
    });
    
    child.on('error', (error) => {
      reject(error);
    });
    
    // Return child process for streaming
    resolve({
      process: child,
      stdout,
      stderr,
    });
  });
}

// Port management - assign unique ports to workspaces (starting from 1000)
const usedPorts = new Set();
const BASE_PORT = 1000;
const MAX_PORT = 9999;

function getAvailablePort() {
  // Start from 1000 and find next available port
  for (let port = BASE_PORT; port < MAX_PORT; port++) {
    if (!usedPorts.has(port)) {
      usedPorts.add(port);
      return port;
    }
  }
  // Fallback to random port if all are used
  const randomPort = BASE_PORT + Math.floor(Math.random() * 1000);
  usedPorts.add(randomPort);
  return randomPort;
}

function releasePort(port) {
  usedPorts.delete(port);
}

// Export getAvailablePort for use in other modules
module.exports.getAvailablePort = getAvailablePort;
module.exports.releasePort = releasePort;

// Start dev server for preview
async function startDevServer(workspaceId, project) {
  const workspacePath = getWorkspacePath(workspaceId);
  // Use project port if specified, otherwise get an available port
  const port = project.port || getAvailablePort();
  
  // Check if package.json exists
  const packageJsonPath = path.join(workspacePath, 'package.json');
  let packageJson;
  
  try {
    const content = await fs.readFile(packageJsonPath, 'utf8');
    packageJson = JSON.parse(content);
  } catch (error) {
    // No package.json, might be a static HTML project
    return null;
  }
  
  // Determine start command
  const startCommand = project.startCommand || 'npm run dev';
  const [cmd, ...args] = startCommand.split(' ');
  
  // Start the server
  const child = spawn(cmd === 'npm' ? 'npm.cmd' : cmd, args, {
    cwd: workspacePath,
    env: { ...process.env, PORT: port, VITE_PORT: port, FORCE_COLOR: '1' },
    shell: true,
    stdio: 'pipe',
  });
  
  // Store process for later cleanup
  return {
    process: child,
    port,
    workspaceId,
  };
}

// Cleanup workspace
async function cleanupWorkspace(workspaceId) {
  const workspacePath = getWorkspacePath(workspaceId);
  try {
    await fs.rm(workspacePath, { recursive: true, force: true });
  } catch (error) {
    console.error('Error cleaning up workspace:', error);
  }
}

module.exports = {
  initializeWorkspace,
  getWorkspacePath,
  readFile,
  writeFile,
  listDirectory,
  executeCommand,
  startDevServer,
  cleanupWorkspace,
  ensureWorkspacesDir,
  getAvailablePort,
  releasePort,
};

