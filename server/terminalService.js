let pty;
let ptyErrorLogged = false; // Track if we've already logged the PTY unavailable message

try {
  pty = require('node-pty');
  // Check if spawn function exists
  if (!pty || typeof pty.spawn !== 'function') {
    pty = null;
  }
} catch (error) {
  // node-pty not available or native module missing
  pty = null;
}

const os = require('os');
const dockerManager = require('./dockerManager');
const workspaceManager = require('./workspace');

class TerminalService {
  constructor() {
    this.sessions = new Map(); // workspaceId -> pty instance
    this.useDocker = dockerManager.isAvailable();
    this.ptyAvailable = pty !== null;
  }

  /**
   * Create a new terminal session
   */
  createSession(workspaceId, options = {}) {
    // Check if session already exists
    if (this.sessions.has(workspaceId)) {
      const existing = this.sessions.get(workspaceId);
      return existing;
    }

    // If node-pty is not available, return null (will use fallback)
    if (!this.ptyAvailable) {
      return null;
    }

    try {
    const workspacePath = workspaceManager.getWorkspacePath(workspaceId);

    // Determine shell
    const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';

    // Create PTY
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: workspacePath,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        FORCE_COLOR: '1',
      },
    });

    const session = {
      pty: ptyProcess,
      workspaceId,
      createdAt: new Date(),
      cols: options.cols || 80,
      rows: options.rows || 24,
    };

    this.sessions.set(workspaceId, session);

    // Handle process exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`Terminal session ended for workspace ${workspaceId}: exitCode=${exitCode}, signal=${signal}`);
      this.sessions.delete(workspaceId);
    });

    return session;
    } catch (error) {
      // If PTY spawn fails (e.g., native module missing), return null to use fallback
      if (error.code === 'MODULE_NOT_FOUND' || 
          error.message.includes('conpty.node') ||
          error.message.includes('Cannot find module')) {
        // Mark PTY as unavailable to prevent future attempts
        this.ptyAvailable = false;
        // Only log once to avoid spam
        if (!ptyErrorLogged) {
          console.log('⚠️  PTY native module not available (node-pty build issue), using fallback terminal mode');
          ptyErrorLogged = true;
        }
        return null;
      }
      // For other errors, re-throw
      throw error;
    }
  }

  /**
   * Get existing session or create new one
   */
  getSession(workspaceId, options = {}) {
    if (this.sessions.has(workspaceId)) {
      return this.sessions.get(workspaceId);
    }
    return this.createSession(workspaceId, options);
  }

  /**
   * Write data to terminal
   */
  write(workspaceId, data) {
    const session = this.sessions.get(workspaceId);
    if (session) {
      session.pty.write(data);
    } else {
      throw new Error(`Terminal session not found for workspace ${workspaceId}`);
    }
  }

  /**
   * Resize terminal
   */
  resize(workspaceId, cols, rows) {
    const session = this.sessions.get(workspaceId);
    if (session) {
      session.pty.resize(cols, rows);
      session.cols = cols;
      session.rows = rows;
    }
  }

  /**
   * Kill terminal session
   */
  kill(workspaceId) {
    const session = this.sessions.get(workspaceId);
    if (session) {
      session.pty.kill();
      this.sessions.delete(workspaceId);
    }
  }

  /**
   * Get terminal output stream
   */
  getOutputStream(workspaceId) {
    const session = this.sessions.get(workspaceId);
    if (!session) {
      throw new Error(`Terminal session not found for workspace ${workspaceId}`);
    }
    return session.pty;
  }

  /**
   * Cleanup inactive sessions
   */
  cleanupInactiveSessions(maxAgeMinutes = 60) {
    const now = new Date();
    const toRemove = [];

    for (const [workspaceId, session] of this.sessions.entries()) {
      const ageMinutes = (now - session.createdAt) / (1000 * 60);
      if (ageMinutes > maxAgeMinutes) {
        toRemove.push(workspaceId);
      }
    }

    for (const workspaceId of toRemove) {
      this.kill(workspaceId);
    }

    return toRemove.length;
  }
}

module.exports = new TerminalService();

