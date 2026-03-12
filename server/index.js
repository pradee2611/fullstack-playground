const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const workspaceManager = require('./workspace');
const dockerManager = require('./dockerManager');
const terminalService = require('./terminalService');
const githubService = require('./githubService');
const portProxy = require('./portProxy');
const database = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5175', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Setup port proxy routes
portProxy.setupRoutes(app);

// Serve workspace files for preview
app.use('/workspace/:workspaceId', express.static(path.join(__dirname, '../workspaces')));

// Store active workspaces
const workspaces = new Map();
const devServers = new Map();

// Store active sessions (in production, use Redis or JWT)
const sessions = new Map();

// ==================== Authentication ====================

// Helper function to hash password (simple hash for demo - use bcrypt in production)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Register user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    // Check if user already exists
    const existingUser = await database.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }

    const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const hashedPassword = hashPassword(password);
    
    const user = await database.createUser({
      id: userId,
      email,
      password: hashedPassword,
      name,
    });

    // Create session
    const sessionId = uuidv4();
    sessions.set(sessionId, { userId, email: user.email, name: user.name });

    res.json({ 
      success: true, 
      user: { id: user.id, email: user.email, name: user.name },
      sessionId 
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = await database.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const hashedPassword = hashPassword(password);
    if (user.password !== hashedPassword) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Create session
    const sessionId = uuidv4();
    sessions.set(sessionId, { userId: user.id, email: user.email, name: user.name });

    res.json({ 
      success: true, 
      user: { id: user.id, email: user.email, name: user.name },
      sessionId 
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current user (verify session)
app.get('/api/auth/me', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    
    if (!sessionId) {
      return res.status(401).json({ success: false, error: 'No session found' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const user = await database.getUser(session.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    res.json({ 
      success: true, 
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    if (sessionId) {
      sessions.delete(sessionId);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Database Project Management ====================

// Create custom project
app.post('/api/projects/create', async (req, res) => {
  try {
    const { name, description, problem_statement, tech_stack } = req.body;
    const sessionId = req.headers['x-session-id'];
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Project name is required' });
    }
    
    if (!problem_statement) {
      return res.status(400).json({ success: false, error: 'Problem statement is required' });
    }

    // Get user from session
    let userId = 'default';
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (session) {
        userId = session.userId;
      }
    }

    const projectId = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const workspacePath = path.join(__dirname, '../workspaces', projectId);
    
    // Create project in database
    const project = await database.createProject({
      id: projectId,
      name,
      description,
      problem_statement,
      tech_stack,
      user_id: userId,
      workspace_path: workspacePath,
    });

    // Create workspace directory
    await workspaceManager.ensureWorkspacesDir();
    await fs.mkdir(workspacePath, { recursive: true });

    res.json({ success: true, project });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all projects
app.get('/api/projects', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    
    // Get user from session
    let userId = 'default';
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (session) {
        userId = session.userId;
      }
    }
    
    const projects = await database.getAllProjects(userId);
    res.json({ success: true, projects });
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get project by ID
app.get('/api/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await database.getProject(projectId);
    
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Get files and dependencies
    const files = await database.getFilesByProject(projectId);
    const dependencies = await database.getDependencies(projectId);

    res.json({ success: true, project, files, dependencies });
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all project files as nested FileStructure (for AI endpoints)
app.get('/api/projects/:projectId/files-structure', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await database.getProject(projectId);
    
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Get all files from database
    const stmt = database.db.prepare('SELECT * FROM files WHERE project_id = ? AND is_directory = 0');
    const files = stmt.all(projectId);
    
    // Convert to nested FileStructure format
    const fileStructure = {};
    for (const file of files) {
      const parts = file.file_path.split('/').filter(p => p);
      let current = fileStructure;
      
      // Navigate/create nested structure
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
      
      // Set file content at the final path
      current[parts[parts.length - 1]] = file.content || '';
    }

    res.json({ success: true, files: fileStructure });
  } catch (error) {
    console.error('Error getting project files structure:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update project
app.put('/api/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const updates = req.body;
    
    // Convert is_completed boolean to integer if present
    if (updates.is_completed !== undefined) {
      updates.is_completed = updates.is_completed ? 1 : 0;
    }
    
    const project = await database.updateProject(projectId, updates);
    res.json({ success: true, project });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Feedback & Learning ====================

// Get feedback for project
app.get('/api/projects/:projectId/feedback', async (req, res) => {
  try {
    const { projectId } = req.params;
    const feedback = await database.getFeedbackByProject(projectId);
    res.json({ success: true, feedback });
  } catch (error) {
    console.error('Error getting feedback:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create feedback
app.post('/api/projects/:projectId/feedback', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { file_path, feedback_type, feedback_data } = req.body;
    
    const feedback = await database.createFeedback({
      project_id: projectId,
      file_path,
      feedback_type,
      feedback_data,
    });
    
    res.json({ success: true, feedback });
  } catch (error) {
    console.error('Error creating feedback:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Progress Tracking ====================

// Get progress tasks for project
app.get('/api/projects/:projectId/progress', async (req, res) => {
  try {
    const { projectId } = req.params;
    const tasks = await database.getProgressTasksByProject(projectId);
    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create progress task
app.post('/api/projects/:projectId/progress', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { task_name, task_description, status } = req.body;
    
    const task = await database.createProgressTask({
      project_id: projectId,
      task_name,
      task_description,
      status,
    });
    
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error creating progress task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update progress task
app.put('/api/projects/:projectId/progress/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;
    
    const task = await database.updateProgressTask(parseInt(taskId), updates);
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error updating progress task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Agent Preferences ====================

// Get agent preferences
app.get('/api/projects/:projectId/agent-preferences', async (req, res) => {
  try {
    const { projectId } = req.params;
    const sessionId = req.headers['x-session-id'];
    
    let userId = 'default';
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (session) {
        userId = session.userId;
      }
    }
    
    const preferences = await database.getAgentPreferencesByProject(projectId, userId);
    res.json({ success: true, preferences });
  } catch (error) {
    console.error('Error getting agent preferences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set agent preference
app.post('/api/projects/:projectId/agent-preferences', async (req, res) => {
  try {
    const { projectId } = req.params;
    const sessionId = req.headers['x-session-id'];
    const { agent_name, enabled, trigger_mode, preferences } = req.body;
    
    let userId = 'default';
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (session) {
        userId = session.userId;
      }
    }
    
    const preference = await database.setAgentPreference({
      project_id: projectId,
      user_id: userId,
      agent_name,
      enabled,
      trigger_mode,
      preferences,
    });
    
    res.json({ success: true, preference });
  } catch (error) {
    console.error('Error setting agent preference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete project and all associated data
app.delete('/api/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Get project first to get workspace path
    const project = await database.getProject(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    console.log(`[Delete Project] Starting deletion of project ${projectId}`);
    
    // 1. Delete all related data from database (CASCADE should handle this, but we'll be explicit)
    // Delete files
    const deleteFilesStmt = database.db.prepare('DELETE FROM files WHERE project_id = ?');
    const filesDeleted = deleteFilesStmt.run(projectId);
    console.log(`[Delete Project] Deleted ${filesDeleted.changes} files`);
    
    // Delete dependencies
    const deleteDepsStmt = database.db.prepare('DELETE FROM dependencies WHERE project_id = ?');
    const depsDeleted = deleteDepsStmt.run(projectId);
    console.log(`[Delete Project] Deleted ${depsDeleted.changes} dependencies`);
    
    // Delete feedback
    const deleteFeedbackStmt = database.db.prepare('DELETE FROM feedback WHERE project_id = ?');
    const feedbackDeleted = deleteFeedbackStmt.run(projectId);
    console.log(`[Delete Project] Deleted ${feedbackDeleted.changes} feedback items`);
    
    // Delete progress tasks
    const deleteProgressStmt = database.db.prepare('DELETE FROM progress_tasks WHERE project_id = ?');
    const progressDeleted = deleteProgressStmt.run(projectId);
    console.log(`[Delete Project] Deleted ${progressDeleted.changes} progress tasks`);
    
    // Delete agent preferences
    const deletePrefsStmt = database.db.prepare('DELETE FROM agent_preferences WHERE project_id = ?');
    const prefsDeleted = deletePrefsStmt.run(projectId);
    console.log(`[Delete Project] Deleted ${prefsDeleted.changes} agent preferences`);
    
    // 2. Delete the project itself
    const deleteResult = await database.deleteProject(projectId);
    console.log(`[Delete Project] Deleted project from database`);
    
    // 3. Delete workspace directory (use project's workspace_path if available, otherwise default)
    const workspacePath = project.workspace_path || path.join(__dirname, '../workspaces', projectId);
    try {
      await fs.access(workspacePath);
      await fs.rm(workspacePath, { recursive: true, force: true });
      console.log(`[Delete Project] Deleted workspace directory: ${workspacePath}`);
    } catch (err) {
      console.log(`[Delete Project] Workspace directory not found or already deleted: ${workspacePath}`);
    }
    
    // 4. Clean up any active workspaces/dev servers for this project
    if (workspaces.has(projectId)) {
      workspaces.delete(projectId);
      console.log(`[Delete Project] Removed from active workspaces`);
    }
    if (devServers.has(projectId)) {
      const devServer = devServers.get(projectId);
      if (devServer && devServer.process) {
        try {
          devServer.process.kill();
        } catch (e) {
          console.error('Error killing dev server:', e);
        }
      }
      devServers.delete(projectId);
      console.log(`[Delete Project] Stopped and removed dev server`);
    }
    
    // 5. Clean up Docker container if it exists
    if (dockerManager.isAvailable()) {
      try {
        await dockerManager.removeContainer(projectId);
        console.log(`[Delete Project] Removed Docker container`);
      } catch (e) {
        console.log(`[Delete Project] No Docker container to remove or error: ${e.message}`);
      }
    }
    
    // 6. Clean up terminal sessions for this workspace (workspaceId = projectId)
    try {
      terminalService.kill(projectId);
      console.log(`[Delete Project] Cleaned up terminal session`);
    } catch (e) {
      // Terminal session might not exist, which is fine
      console.log(`[Delete Project] No terminal session to clean up`);
    }
    
    console.log(`[Delete Project] Successfully deleted project ${projectId} and all associated data`);
    
    res.json({ 
      success: true,
      message: 'Project and all associated data deleted successfully',
      deleted: {
        files: filesDeleted.changes,
        dependencies: depsDeleted.changes,
        feedback: feedbackDeleted.changes,
        progressTasks: progressDeleted.changes,
        agentPreferences: prefsDeleted.changes,
      }
    });
  } catch (error) {
    console.error('[Delete Project] Error deleting project:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== File Management ====================

// Create file or folder
app.post('/api/projects/:projectId/files', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { file_path, content = '', is_directory = false } = req.body;
    
    if (!file_path) {
      return res.status(400).json({ success: false, error: 'File path is required' });
    }

    // Create in database
    const file = await database.createFile(projectId, file_path, content, is_directory);

    // Sync to file system
    const project = await database.getProject(projectId);
    if (project && project.workspace_path) {
      const fullPath = path.join(project.workspace_path, file_path);
      
      if (is_directory) {
        await fs.mkdir(fullPath, { recursive: true });
      } else {
        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(fullPath, content, 'utf8');
      }
    }

    res.json({ success: true, file });
  } catch (error) {
    console.error('Error creating file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get files in directory
app.get('/api/projects/:projectId/files', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { directory = null, file_path = null } = req.query;
    
    // If file_path is specified, return that specific file
    if (file_path) {
      const file = await database.getFile(projectId, file_path);
      if (file) {
        return res.json({ success: true, file });
      } else {
        return res.status(404).json({ success: false, error: 'File not found' });
      }
    }
    
    const files = await database.getFilesByProject(projectId, directory);
    res.json({ success: true, files });
  } catch (error) {
    console.error('Error getting files:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update file
app.put('/api/projects/:projectId/files', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { file_path, content } = req.body;
    
    if (!file_path) {
      return res.status(400).json({ success: false, error: 'File path is required' });
    }

    // Update in database
    const file = await database.updateFile(projectId, file_path, content);

    // Sync to file system
    const project = await database.getProject(projectId);
    if (project && project.workspace_path) {
      const fullPath = path.join(project.workspace_path, file_path);
      await fs.writeFile(fullPath, content, 'utf8');
    }

    res.json({ success: true, file });
  } catch (error) {
    console.error('Error updating file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete file or folder
app.delete('/api/projects/:projectId/files', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { file_path } = req.query;
    
    if (!file_path) {
      return res.status(400).json({ success: false, error: 'File path is required' });
    }

    // Delete from database
    await database.deleteFile(projectId, file_path);

    // Delete from file system
    const project = await database.getProject(projectId);
    if (project && project.workspace_path) {
      const fullPath = path.join(project.workspace_path, file_path);
      await fs.rm(fullPath, { recursive: true, force: true }).catch(() => {});
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Dependency Management ====================

// Add dependency
app.post('/api/projects/:projectId/dependencies', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { package_name, version = 'latest', type = 'dependency' } = req.body;
    
    if (!package_name) {
      return res.status(400).json({ success: false, error: 'Package name is required' });
    }

    const dependency = await database.addDependency(projectId, package_name, version, type);
    
    // Sync package.json to file system
    await database.syncProjectToFileSystem(projectId);
    
    res.json({ success: true, dependency });
  } catch (error) {
    console.error('Error adding dependency:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get dependencies
app.get('/api/projects/:projectId/dependencies', async (req, res) => {
  try {
    const { projectId } = req.params;
    const dependencies = await database.getDependencies(projectId);
    res.json({ success: true, dependencies });
  } catch (error) {
    console.error('Error getting dependencies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove dependency
app.delete('/api/projects/:projectId/dependencies', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { package_name, type = 'dependency' } = req.query;
    
    if (!package_name) {
      return res.status(400).json({ success: false, error: 'Package name is required' });
    }

    await database.removeDependency(projectId, package_name, type);
    
    // Sync package.json to file system
    await database.syncProjectToFileSystem(projectId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing dependency:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Install dependencies (runs npm install)
app.post('/api/projects/:projectId/dependencies/install', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await database.getProject(projectId);
    
    if (!project || !project.workspace_path) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Sync database to file system first
    await database.syncProjectToFileSystem(projectId);

    // Run npm install
    const result = await workspaceManager.executeCommand(projectId, 'npm', ['install'], {
      cwd: project.workspace_path,
    });

    res.json({ success: true, message: 'Dependencies installed successfully' });
  } catch (error) {
    console.error('Error installing dependencies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sync project from database to file system
app.post('/api/projects/:projectId/sync', async (req, res) => {
  try {
    const { projectId } = req.params;
    await database.syncProjectToFileSystem(projectId);
    res.json({ success: true, message: 'Project synced to file system' });
  } catch (error) {
    console.error('Error syncing project:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sync project from file system to database
app.post('/api/projects/:projectId/sync-from-fs', async (req, res) => {
  try {
    const { projectId } = req.params;
    await database.syncFileSystemToDatabase(projectId);
    res.json({ success: true, message: 'Project synced from file system to database' });
  } catch (error) {
    console.error('Error syncing from file system:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Workspace Management ====================

// Create or get workspace
app.post('/api/workspace/create', async (req, res) => {
  try {
    const { workspaceId, project, useDocker = false } = req.body;
    
    // Check if this is a database project
    const dbProject = await database.getProject(workspaceId);
    let workspacePath;
    
    if (dbProject) {
      // Use database project's workspace path
      workspacePath = dbProject.workspace_path;
      // Sync database to file system
      await database.syncProjectToFileSystem(workspaceId);
    } else {
      // Initialize workspace with real file system (template project)
      workspacePath = await workspaceManager.initializeWorkspace(workspaceId, project);
    }
    
    workspaces.set(workspaceId, {
      id: workspaceId,
      project,
      path: workspacePath,
      createdAt: new Date(),
      useDocker,
    });

    // Create Docker container if requested and available
    if (useDocker && dockerManager.isAvailable()) {
      try {
        const containerInfo = await dockerManager.createContainer(workspaceId, {
          image: getImageForProject(project),
          memory: '2g',
          cpus: '1',
        });
        workspaces.get(workspaceId).containerId = containerInfo.id;
      } catch (error) {
        console.warn(`Failed to create Docker container: ${error.message}`);
      }
    }

    res.json({ success: true, workspaceId, path: workspacePath });
  } catch (error) {
    console.error('Error creating workspace:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get file content
app.get('/api/workspace/:workspaceId/file', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { path: filePath } = req.query;
    
    const content = await workspaceManager.readFile(workspaceId, filePath);
    res.json({ success: true, content });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Save file
app.post('/api/workspace/:workspaceId/file', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { path: filePath, content } = req.body;
    
    await workspaceManager.writeFile(workspaceId, filePath, content);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List directory
app.get('/api/workspace/:workspaceId/files', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { path: dirPath = '.' } = req.query;
    
    const files = await workspaceManager.listDirectory(workspaceId, dirPath);
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== GitHub Integration ====================

// Clone GitHub repository
app.post('/api/github/clone', async (req, res) => {
  try {
    const { repoUrl, workspaceId, branch = 'main', token = null } = req.body;
    
    const result = await githubService.cloneRepository(repoUrl, workspaceId, { branch, token });
    
    // Get repo info
    const repoInfo = await githubService.getRepoInfo(repoUrl);
    
    workspaces.set(workspaceId, {
      id: workspaceId,
      project: {
        id: `github-${repoInfo.owner}-${repoInfo.repo}`,
        name: repoInfo.name || repoInfo.repo,
        description: repoInfo.description || '',
        language: repoInfo.language || 'unknown',
        files: {}, // Will be loaded from file system
        repoUrl,
        repoInfo,
      },
      path: result.path,
      createdAt: new Date(),
    });

    res.json({ success: true, ...result, repoInfo });
  } catch (error) {
    console.error('Error cloning repository:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get repository info
app.get('/api/github/repo', async (req, res) => {
  try {
    const { url } = req.query;
    const repoInfo = await githubService.getRepoInfo(url);
    res.json({ success: true, ...repoInfo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Commit and push changes
app.post('/api/github/commit', async (req, res) => {
  try {
    const { workspaceId, message, branch = 'main', token } = req.body;
    const result = await githubService.commitAndPush(workspaceId, message, { branch, token });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get GitHub OAuth URL
app.get('/api/github/oauth-url', (req, res) => {
  const state = uuidv4();
  const redirectUri = `${req.protocol}://${req.get('host')}/api/github/callback`;
  const url = githubService.getOAuthUrl(redirectUri, state);
  res.json({ success: true, url, state });
});

// GitHub OAuth callback
app.get('/api/github/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const token = await githubService.exchangeCodeForToken(code);
    const userInfo = await githubService.getUserInfo(token);
    res.json({ success: true, token, user: userInfo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List user repositories
app.get('/api/github/repos', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token required' });
    }
    const repos = await githubService.listUserRepos(token);
    res.json({ success: true, repos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== VS Code Web ====================

// Start code-server for workspace
app.post('/api/vscode/start', async (req, res) => {
  try {
    const { workspaceId } = req.body;
    
    // In production, this would:
    // 1. Start code-server in Docker container
    // 2. Expose it via reverse proxy
    // 3. Return the URL
    
    // For now, return a placeholder
    // You would need to install code-server in your Docker image
    const codeServerUrl = `http://localhost:8080/${workspaceId}`;
    
    res.json({
      success: true,
      url: codeServerUrl,
      message: 'Code-server integration requires setup. See ARCHITECTURE.md for details.',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Preview Server ====================

// Start preview server
app.post('/api/preview/start', async (req, res) => {
  try {
    const { workspaceId, project } = req.body;
    
    // Stop existing server if any
    if (devServers.has(workspaceId)) {
      const oldServer = devServers.get(workspaceId);
      oldServer.process.kill();
      workspaceManager.releasePort(oldServer.port);
      devServers.delete(workspaceId);
    }
    
    // Start new dev server
    const serverInfo = await workspaceManager.startDevServer(workspaceId, project);
    
    if (serverInfo) {
      devServers.set(workspaceId, serverInfo);
      
      // Wait a bit for server to start
      setTimeout(() => {
        const port = serverInfo.port;
        const previewUrl = `http://localhost:${port}`;
        
        res.json({
          success: true,
          url: previewUrl,
          port: port,
        });
      }, 2000);
    } else {
      // Static HTML project - serve directly
      res.json({
        success: true,
        url: `http://localhost:3001/workspace/${workspaceId}/index.html`,
      });
    }
  } catch (error) {
    console.error('Error starting preview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Terminal WebSocket ====================

// Track running processes per terminal
const terminalProcesses = new Map(); // terminalId -> Set of child processes

// Helper function to get next sequential project number
async function getNextProjectNumber(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const projectNumbers = [];
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const match = entry.name.match(/^project-(\d+)$/);
        if (match) {
          projectNumbers.push(parseInt(match[1], 10));
        }
      }
    }
    
    if (projectNumbers.length === 0) {
      return 1;
    }
    
    // Find the next available number
    const maxNumber = Math.max(...projectNumbers);
    return maxNumber + 1;
  } catch (error) {
    // If directory doesn't exist or can't be read, start with 1
    return 1;
  }
}

// Fallback command execution (used when node-pty is not available)
async function executeCommand(socket, command, workspaceId, currentDir = null, terminalId = null) {
  // Split command and filter out empty strings (from multiple spaces)
  const parts = command.split(' ').filter(part => part.length > 0);
  const [cmd, ...args] = parts;
  
  // Handle case where user types "npm npx" - treat as just "npx"
  if (cmd === 'npm' && args.length > 0 && args[0] === 'npx') {
    return executeCommand(socket, args.join(' '), workspaceId, currentDir, terminalId);
  }

  // Handle cd command
  if (cmd === 'cd') {
    const targetDir = args[0] || '';
    const workspacePath = workspaceManager.getWorkspacePath(workspaceId);
    const dbProject = await database.getProject(workspaceId);
    const basePath = dbProject?.workspace_path || workspacePath;
    
    if (!targetDir) {
      // cd without args - go to workspace root
      return null;
    }
    
    // Resolve path
    let newPath;
    if (targetDir.startsWith('/') || targetDir.match(/^[A-Za-z]:/)) {
      // Absolute path
      newPath = targetDir;
    } else {
      // Relative path
      const currentPath = currentDir ? path.join(basePath, currentDir) : basePath;
      newPath = path.resolve(currentPath, targetDir);
    }
    
    // Check if directory exists
    try {
      const stats = await fs.stat(newPath);
      if (stats.isDirectory()) {
        // Make path relative to workspace
        const relativePath = path.relative(basePath, newPath);
        return relativePath || null;
      } else {
        socket.emit('output', `cd: ${targetDir}: Not a directory\r\n`);
        return currentDir;
      }
    } catch (error) {
      socket.emit('output', `cd: ${targetDir}: No such file or directory\r\n`);
      return currentDir;
    }
  }

  // Handle clear command
  if (cmd === 'clear' || cmd === 'cls') {
    socket.emit('output', '\x1b[2J\x1b[H'); // Clear screen and move cursor to top
    // Prompt will be shown by the caller
    return currentDir;
  }

  // Handle special commands
  if (cmd === 'help') {
    socket.emit('output', 'Available commands:\r\n');
    socket.emit('output', '  npm install     - Install dependencies\r\n');
    socket.emit('output', '  npm run dev     - Start development server\r\n');
    socket.emit('output', '  npm run build   - Build project\r\n');
    socket.emit('output', '  ls              - List files\r\n');
    socket.emit('output', '  pwd             - Print working directory\r\n');
    socket.emit('output', '  cat <file>      - Show file content\r\n');
    socket.emit('output', '  cd <dir>        - Change directory\r\n');
    socket.emit('output', '  clear           - Clear terminal\r\n');
    return currentDir;
  }

  if (cmd === 'pwd') {
    const workspacePath = workspaceManager.getWorkspacePath(workspaceId);
    const dbProject = await database.getProject(workspaceId);
    const basePath = dbProject?.workspace_path || workspacePath;
    const fullPath = currentDir ? path.join(basePath, currentDir) : basePath;
    socket.emit('output', `${fullPath}\r\n`);
    return currentDir;
  }

  if (cmd === 'ls' || cmd === 'dir') {
    try {
      const targetPath = args[0] || currentDir || '.';
      const files = await workspaceManager.listDirectory(workspaceId, targetPath);
      for (const file of files) {
        const icon = file.type === 'directory' ? '📁' : '📄';
        socket.emit('output', `  ${icon} ${file.name}\r\n`);
      }
    } catch (error) {
      socket.emit('output', `Error: ${error.message}\r\n`);
    }
    return currentDir;
  }

  if (cmd === 'cat') {
    if (!args[0]) {
      socket.emit('output', 'Usage: cat <file>\r\n');
      return currentDir;
    }
    try {
      const filePath = currentDir ? `${currentDir}/${args[0]}` : args[0];
      const content = await workspaceManager.readFile(workspaceId, filePath);
      socket.emit('output', `${content}\r\n`);
    } catch (error) {
      socket.emit('output', `Error: ${error.message}\r\n`);
    }
    return currentDir;
  }

  // Execute real commands
  try {
    // Get the correct working directory
    const workspacePath = workspaceManager.getWorkspacePath(workspaceId);
    const dbProject = await database.getProject(workspaceId);
    const basePath = dbProject?.workspace_path || workspacePath;
    const cwd = currentDir ? path.join(basePath, currentDir) : basePath;
    
    // Handle npm create commands - allow specifying project name and template
    let finalCmd = cmd;
    let finalArgs = [...args];
    
    if (cmd === 'npm' && args[0] === 'create') {
      // npm create vite@latest [project-name] [-- --template react]
      // If no project name provided, add a sequential one to make it non-interactive
      if (args.length === 2) {
        // Only the template name, add sequential project name
        const templateName = args[1];
        const nextNumber = await getNextProjectNumber(cwd);
        const projectName = `project-${nextNumber}`;
        finalArgs = [args[0], templateName, projectName];
        socket.emit('output', `\x1b[36mCreating project: ${projectName}\x1b[0m\r\n`);
      }
      // If project name is already provided, use as-is
    }
    
    // Handle npx create-vite commands - use sequential naming
    if (cmd === 'npx' && args.length > 0 && args[0].includes('create-vite')) {
      // npx create-vite@latest [project-name] [-- --template react]
      // Check if project name is provided (first non-flag argument)
      let hasProjectName = false;
      
      // Look for project name (first non-flag argument after create-vite)
      for (let i = 1; i < args.length; i++) {
        if (!args[i].startsWith('--') && !args[i].startsWith('-')) {
          hasProjectName = true;
          break;
        }
      }
      
      if (!hasProjectName) {
        // No project name provided, add sequential one
        const nextNumber = await getNextProjectNumber(cwd);
        const projectName = `project-${nextNumber}`;
        finalArgs = [...args];
        finalArgs.splice(1, 0, projectName);
        socket.emit('output', `\x1b[36mCreating project: ${projectName}\x1b[0m\r\n`);
      }
    }
    
    // Handle npx create-next-app - make it non-interactive
    if (cmd === 'npx' && args.length > 0 && args[0].includes('create-next-app')) {
      // Extract the create-next-app package (could be create-next-app@latest, etc.)
      const createNextAppCmd = args[0];
      const remainingArgs = args.slice(1);
      
      // Check if project name is already provided
      let projectName = null;
      let otherArgs = [];
      let hasTypeScript = false;
      let hasTailwind = false;
      let hasApp = false;
      let hasSrcDir = false;
      
      // Parse existing flags
      for (let i = 0; i < remainingArgs.length; i++) {
        const arg = remainingArgs[i];
        if (!arg.startsWith('-') && !arg.startsWith('--')) {
          if (!projectName) {
            projectName = arg;
          } else {
            otherArgs.push(arg);
          }
        } else {
          otherArgs.push(arg);
          if (arg === '--typescript' || arg === '--ts') hasTypeScript = true;
          if (arg === '--tailwind' || arg === '--tw') hasTailwind = true;
          if (arg === '--app') hasApp = true;
          if (arg === '--src-dir') hasSrcDir = true;
        }
      }
      
      // If no project name provided, generate one
      if (!projectName) {
        projectName = `my-app-${Date.now()}`;
        socket.emit('output', `\x1b[33mNo project name provided, using: ${projectName}\x1b[0m\r\n`);
      }
      
      // Add default flags to make it non-interactive (if not already specified)
      // These are the defaults that create-next-app would ask for
      const defaultFlags = [];
      if (!hasTypeScript && !otherArgs.includes('--javascript') && !otherArgs.includes('--js')) {
        defaultFlags.push('--typescript');
      }
      if (!hasTailwind && !otherArgs.includes('--no-tailwind')) {
        defaultFlags.push('--tailwind');
      }
      if (!hasApp && !otherArgs.includes('--no-app')) {
        defaultFlags.push('--app');
      }
      if (!hasSrcDir && !otherArgs.includes('--src-dir')) {
        defaultFlags.push('--no-src-dir');
      }
      if (!otherArgs.includes('--import-alias')) {
        defaultFlags.push('--import-alias', '@/*');
      }
      if (!otherArgs.includes('--use-npm') && !otherArgs.includes('--use-yarn') && !otherArgs.includes('--use-pnpm') && !otherArgs.includes('--use-bun')) {
        defaultFlags.push('--use-npm');
      }
      // Add ESLint flag to skip linter selection prompt
      // create-next-app asks: "Which linter would you like to use?"
      // Options: ESLint, Biome, None
      // We default to ESLint to skip this prompt
      if (!otherArgs.includes('--eslint') && !otherArgs.includes('--no-eslint') && !otherArgs.includes('--biome') && !otherArgs.includes('--no-lint')) {
        defaultFlags.push('--eslint');
      }
      
      // Add --no-react-compiler flag to skip React Compiler prompt
      // create-next-app asks: "Would you like to use React Compiler?"
      if (!otherArgs.includes('--react-compiler') && !otherArgs.includes('--no-react-compiler')) {
        defaultFlags.push('--no-react-compiler');
      }
      
      // Ensure we have all flags to make it completely non-interactive
      // This prevents any prompts from appearing
      
      finalArgs = [createNextAppCmd, projectName, ...defaultFlags, ...otherArgs];
      
      socket.emit('output', `\x1b[36mCreating Next.js app "${projectName}" with TypeScript, Tailwind CSS, App Router, and ESLint...\x1b[0m\r\n`);
    }
    
    // Check if this is a dev server command (npm run dev, npm start, etc.)
    const isDevServer = (cmd === 'npm' && ((args[0] === 'run' && args[1] === 'dev') || 
                        args[0] === 'start')) || 
                        (cmd === 'vite' && args.includes('dev')) ||
                        (cmd === 'next' && args.includes('dev'));
    
    // Auto-assign port for dev servers
    let assignedPort = null;
    if (isDevServer) {
      assignedPort = workspaceManager.getAvailablePort();
      socket.emit('output', `\x1b[36m[Auto-assigned port: ${assignedPort}]\x1b[0m\r\n`);
    }
    
    // Check if package.json exists in current directory, if not, check subdirectories
    let finalCwd = cwd;
    if (cmd === 'npm' && (args[0] === 'run' || args[0] === 'start' || args[0] === 'install')) {
      const fs = require('fs');
      const packageJsonPath = path.join(cwd, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        // Look for package.json in subdirectories
        try {
          const dirs = await fs.promises.readdir(cwd, { withFileTypes: true });
          for (const dir of dirs) {
            if (dir.isDirectory()) {
              const subPackageJson = path.join(cwd, dir.name, 'package.json');
              if (fs.existsSync(subPackageJson)) {
                finalCwd = path.join(cwd, dir.name);
                socket.emit('output', `\x1b[33mNote: Running in ${dir.name} directory\x1b[0m\r\n`);
                break;
              }
            }
          }
        } catch (error) {
          // Ignore errors, use original cwd
        }
      }
    }
    
    // Prepare environment variables
    const envVars = { 
      ...process.env, 
      FORCE_COLOR: '1',
    };
    if (isDevServer && assignedPort) {
      envVars.PORT = assignedPort.toString();
      envVars.VITE_PORT = assignedPort.toString();
      envVars.NEXT_PORT = assignedPort.toString();
      envVars.WDS_SOCKET_PORT = assignedPort.toString();
    }
    
    const result = await workspaceManager.executeCommand(workspaceId, finalCmd, finalArgs, { 
      cwd: finalCwd,
      env: envVars
    });
    
    if (result.process) {
      // Streaming command (like npm install, npm run dev)
      const child = result.process;
      
      // Ensure stdin stays open and doesn't close prematurely
      // This is important for interactive commands
      if (child.stdin) {
        child.stdin.setDefaultEncoding('utf8');
        // Keep stdin open - don't end it automatically
        // The process will close stdin when it's done
      }
      
      // Track process for this terminal
      if (terminalId) {
        if (!terminalProcesses.has(terminalId)) {
          terminalProcesses.set(terminalId, new Set());
        }
        terminalProcesses.get(terminalId).add(child);
        
        // Mark process as not killed initially
        child._forceKilled = false;
        
        // Remove from tracking when process ends
        child.on('close', () => {
          const processes = terminalProcesses.get(terminalId);
          if (processes) {
            processes.delete(child);
            if (processes.size === 0) {
              terminalProcesses.delete(terminalId);
            }
          }
        });
      }
      
      child.stdout.on('data', (data) => {
        const text = data.toString();
        // Normalize output: preserve visual structure but clean up excessive whitespace
        let cleaned = text
          .replace(/\r\n/g, '\n') // Normalize to \n first
          .replace(/\r/g, '\n')   // Handle Mac line endings
          .replace(/\n{4,}/g, '\n\n\n') // Max 3 consecutive newlines (preserve some spacing)
          .replace(/\n/g, '\r\n'); // Convert back to CRLF for terminal
        // Don't collapse spaces - preserve formatting for npm output
        
        socket.emit('output', cleaned);
      });
      
      child.stderr.on('data', (data) => {
        const text = data.toString();
        // Same normalization for stderr
        let cleaned = text
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .replace(/\n{4,}/g, '\n\n\n')
          .replace(/\n/g, '\r\n');
        socket.emit('output', `\x1b[31m${cleaned}\x1b[0m`);
      });
      
      child.on('close', async (code) => {
        // Remove from tracking
        if (terminalId && terminalProcesses.has(terminalId)) {
          const processes = terminalProcesses.get(terminalId);
          processes.delete(child);
          if (processes.size === 0) {
            terminalProcesses.delete(terminalId);
          }
        }
        
        // Only show success message if it completed normally (not interrupted)
        if (code === 0) {
          socket.emit('output', `\r\n\x1b[32m✓ Command completed successfully\x1b[0m\r\n`);
          
          // Auto-sync file system to database for database projects
          // Check if workspaceId is a database project
          const dbProject = await database.getProject(workspaceId);
          if (dbProject) {
            // Sync file system changes to database
            try {
              await database.syncFileSystemToDatabase(workspaceId);
              // Notify frontend to refresh files
              socket.emit('files-changed');
            } catch (error) {
              console.error('Error syncing after command:', error);
            }
          }
        } else if (code === null || code === 130 || code === 143) {
          // Process was interrupted (Ctrl+C) - code 130 is SIGINT, 143 is SIGTERM
          // Don't show error message, just show prompt
          socket.emit('output', '\r\n');
        } else {
          socket.emit('output', `\r\n\x1b[31m✗ Command exited with code ${code}\x1b[0m\r\n`);
        }
        // Prompt will be shown by the caller
      });
      
      child.on('error', (error) => {
        socket.emit('output', `\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`);
        // Prompt will be shown by the caller
      });
    } else {
      // Non-streaming command
      if (result.stdout) {
        socket.emit('output', result.stdout);
      }
      if (result.stderr) {
        socket.emit('output', `\x1b[31m${result.stderr}\x1b[0m`);
      }
      
      // Auto-sync for database projects
      const dbProject = await database.getProject(workspaceId);
      if (dbProject && result.success) {
        try {
          await database.syncFileSystemToDatabase(workspaceId);
          socket.emit('files-changed');
        } catch (error) {
          console.error('Error syncing after command:', error);
        }
      }
      
      // Prompt will be shown by the caller
    }
    return currentDir;
  } catch (error) {
    socket.emit('output', `\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`);
    // Prompt will be shown by the caller
    return currentDir;
  }
}

io.on('connection', (socket) => {
  const workspaceId = socket.handshake.query.workspaceId;
  const terminalId = socket.handshake.query.terminalId || workspaceId; // Support multiple terminals per workspace
  const isNewTerminal = socket.handshake.query.isNewTerminal === 'true'; // Check if this is a new terminal
  
  if (!workspaceId) {
    socket.disconnect();
    return;
  }

  console.log(`Terminal connected for workspace: ${workspaceId}, terminal: ${terminalId}`);

  // If this is a new terminal, clear any existing processes
  if (isNewTerminal && terminalProcesses.has(terminalId)) {
    const processes = terminalProcesses.get(terminalId);
    processes.forEach((proc) => {
      try {
        proc.kill('SIGTERM');
      } catch (error) {
        console.error('Error killing process:', error);
      }
    });
    terminalProcesses.delete(terminalId);
  }

  // Create or get terminal session (use terminalId for unique sessions)
  let session;
  try {
    session = terminalService.getSession(terminalId, {
      cols: 80,
      rows: 24,
    });
  } catch (error) {
    // If it's a MODULE_NOT_FOUND error for node-pty, just use fallback mode
    if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('conpty.node')) {
      session = null; // Will trigger fallback mode
    } else {
    console.error(`Failed to create terminal session: ${error.message}`);
    socket.emit('output', `\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`);
    socket.disconnect();
    return;
    }
  }

  // If PTY is not available, use fallback command execution mode
  if (!session || !session.pty) {
    console.log(`Using fallback terminal mode for workspace ${workspaceId}, terminal ${terminalId}`);
    
    // Clear terminal if it's a new terminal
    if (isNewTerminal) {
      socket.emit('output', '\x1b[2J\x1b[H'); // Clear screen
    }
    
    // Fallback to existing command execution
    let buffer = '';
    let currentDir = null; // Track current directory
    
    // Show proper PowerShell prompt on Windows, bash on Unix
    const getPrompt = async () => {
      const workspacePath = workspaceManager.getWorkspacePath(workspaceId);
      const dbProject = await database.getProject(workspaceId);
      const basePath = dbProject?.workspace_path || workspacePath;
      let displayPath = basePath;
      
      if (currentDir) {
        displayPath = path.join(basePath, currentDir);
      }
      
      // Normalize path separators for display (Windows uses backslashes)
      if (process.platform === 'win32') {
        displayPath = displayPath.replace(/\//g, '\\');
        return `PS ${displayPath}> `;
      } else {
        // On Unix, show relative path if not at root
        const relativePath = path.relative(basePath, displayPath);
        return relativePath && relativePath !== '.' ? `$ ` : `$ `;
      }
    };
    
    // Only show prompt, no warning message
    getPrompt().then(prompt => socket.emit('output', prompt));
    
    // Track last Ctrl+C time for immediate force kill on rapid presses
    let lastCtrlCTime = 0;
    
    socket.on('input', (data) => {
      // Handle Ctrl+C (SIGINT) - \x03 is the ETX character sent by Ctrl+C
      if (data === '\x03' || data === '\u0003') {
        const now = Date.now();
        const timeSinceLastCtrlC = now - lastCtrlCTime;
        lastCtrlCTime = now;
        const isRapidPress = timeSinceLastCtrlC < 500; // If pressed again within 500ms, force kill immediately
        
        // Check if there are running processes
        if (terminalProcesses.has(terminalId)) {
          const processes = terminalProcesses.get(terminalId);
          if (processes.size > 0) {
            // Send Ctrl+C to running processes first (try graceful shutdown)
            socket.emit('output', '\r\n^C\r\n');
            
            const { exec } = require('child_process');
            const processesToKill = Array.from(processes);
            
            // Helper function to force kill a process
            const forceKillProcess = (proc) => {
              try {
                // Check if process is already dead
                if (proc.killed || proc.exitCode !== null) {
                  return;
                }
                
                // Mark as force killed to prevent multiple kill attempts
                if (proc._forceKilled) {
                  return;
                }
                proc._forceKilled = true;
                
                  if (process.platform === 'win32') {
                  // On Windows, use taskkill to kill process tree (/T = tree, /F = force)
                    exec(`taskkill /pid ${proc.pid} /T /F`, (error) => {
                      if (error) {
                      // If taskkill fails, try direct kill
                      try {
                        proc.kill('SIGTERM');
                        // Force kill after another short delay if still running
                        setTimeout(() => {
                          try {
                            if (proc.exitCode === null && !proc.killed) {
                              proc.kill('SIGKILL');
                }
                          } catch (e) {
                            // Process might already be dead
                          }
                        }, 100);
                      } catch (killError) {
                        console.error('Error killing process:', killError);
                      }
                    }
                  });
                  } else {
                  // On Unix, try SIGTERM first, then SIGKILL
                  try {
                    proc.kill('SIGTERM');
                    setTimeout(() => {
                      try {
                        if (proc.exitCode === null && !proc.killed) {
                          proc.kill('SIGKILL');
                  }
                      } catch (e) {
                        // Process might already be dead
                      }
                    }, 100);
                } catch (killError) {
                  console.error('Error killing process:', killError);
                }
              }
              } catch (error) {
                console.error('Error in kill process handler:', error);
              }
            };
            
            if (isRapidPress) {
              // Rapid Ctrl+C press - force kill immediately
              processesToKill.forEach(forceKillProcess);
              setTimeout(() => {
                socket.emit('output', getPrompt());
              }, 200);
            } else {
              // First Ctrl+C - try graceful shutdown first
              // First, try to send Ctrl+C to stdin for graceful shutdown
              processesToKill.forEach((proc) => {
                try {
                  if (proc.stdin && !proc.stdin.destroyed) {
                    proc.stdin.write('\x03');
                  }
                } catch (error) {
                  // Ignore errors when writing to stdin
                }
              });
              
              // Force kill all processes after a short delay (200ms)
              // This ensures processes are killed even if they don't respond to Ctrl+C
              setTimeout(() => {
                processesToKill.forEach(forceKillProcess);
              }, 200);
              
              // Show prompt after a short delay
              setTimeout(() => {
                socket.emit('output', getPrompt());
              }, 400);
            }
          } else {
            // No processes running, just show prompt
            socket.emit('output', '\r\n');
            socket.emit('output', getPrompt());
          }
        } else {
          // No processes, just clear buffer and show prompt
          socket.emit('output', '\r\n');
          socket.emit('output', getPrompt());
        }
        // Clear buffer
        buffer = '';
        return;
      }
      
      if (data === '\r' || data === '\n') {
        const command = buffer.trim();
        if (command) {
          // Echo the command
          socket.emit('output', `\r\n`);
          // Don't echo the command - executeCommand will handle output
          executeCommand(socket, command, workspaceId, currentDir, terminalId).then((newDir) => {
            if (newDir !== undefined) {
              currentDir = newDir;
            }
            socket.emit('output', getPrompt());
          }).catch((error) => {
            socket.emit('output', `\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`);
            socket.emit('output', getPrompt());
          });
          buffer = '';
        } else {
          socket.emit('output', `\r\n${getPrompt()}`);
        }
      } else if (data === '\x7f' || data === '\b') {
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
          socket.emit('output', '\b \b');
        }
      } else if (data.charCodeAt(0) >= 32) {
        buffer += data;
        socket.emit('output', data);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Terminal disconnected for workspace: ${workspaceId}, terminal: ${terminalId}`);
      
      // Kill all processes for this terminal when disconnected
      if (terminalProcesses.has(terminalId)) {
        const processes = terminalProcesses.get(terminalId);
        console.log(`Killing ${processes.size} processes for terminal ${terminalId}`);
        processes.forEach((proc) => {
          try {
            // Kill the process and all its children
            if (process.platform === 'win32') {
              exec(`taskkill /pid ${proc.pid} /T /F`, (error) => {
                if (error) {
                  proc.kill('SIGTERM');
                }
              });
            } else {
              proc.kill('SIGTERM');
            }
          } catch (error) {
            console.error('Error killing process:', error);
          }
        });
        terminalProcesses.delete(terminalId);
      }
    });
    return;
  }

  const pty = session.pty;

  // Send terminal output to client with proper formatting
  pty.onData((data) => {
    // Normalize output for better display (preserve formatting)
    let normalized = data.toString()
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{4,}/g, '\n\n\n') // Max 3 consecutive newlines
      .replace(/\n/g, '\r\n');
    socket.emit('output', normalized);
  });

  // Handle terminal input from client
  socket.on('input', (data) => {
    pty.write(data);
  });

  // Handle terminal resize
  socket.on('resize', ({ cols, rows }) => {
    terminalService.resize(terminalId, cols, rows);
  });

  // Handle disconnect
    socket.on('terminal-close', () => {
      // Explicit terminal close - kill all processes
      if (terminalProcesses.has(terminalId)) {
        const processes = terminalProcesses.get(terminalId);
        console.log(`Killing ${processes.size} processes for terminal ${terminalId}`);
        processes.forEach((proc) => {
          try {
            if (process.platform === 'win32') {
              const { exec } = require('child_process');
              exec(`taskkill /pid ${proc.pid} /T /F`, (error) => {
                if (error) {
                  proc.kill('SIGTERM');
                }
              });
            } else {
              proc.kill('SIGTERM');
            }
          } catch (error) {
            console.error('Error killing process:', error);
          }
        });
        terminalProcesses.delete(terminalId);
      }
    });
    
    socket.on('disconnect', () => {
      console.log(`Terminal disconnected for workspace: ${workspaceId}, terminal: ${terminalId}`);
      
      // Kill all processes for this terminal when disconnected
      if (terminalProcesses.has(terminalId)) {
        const processes = terminalProcesses.get(terminalId);
        console.log(`Killing ${processes.size} processes for terminal ${terminalId}`);
        processes.forEach((proc) => {
          try {
            if (process.platform === 'win32') {
              const { exec } = require('child_process');
              exec(`taskkill /pid ${proc.pid} /T /F`, (error) => {
                if (error) {
                  proc.kill('SIGTERM');
                }
              });
            } else {
              proc.kill('SIGTERM');
            }
          } catch (error) {
            console.error('Error killing process:', error);
          }
        });
        terminalProcesses.delete(terminalId);
      }
    });
});

// ==================== Helper Functions ====================

function getImageForProject(project) {
  // Determine Docker image based on project type
  if (project.language === 'python') {
    return 'python:3.11';
  } else if (project.language === 'java') {
    return 'openjdk:17';
  } else {
    return 'node:18';
  }
}

// ==================== Cleanup ====================

// Cleanup inactive containers and sessions periodically
setInterval(async () => {
  try {
    if (dockerManager.isAvailable()) {
      const removed = await dockerManager.cleanupInactiveContainers(60);
      if (removed > 0) {
        console.log(`Cleaned up ${removed} inactive containers`);
      }
    }
    
    const sessionsRemoved = terminalService.cleanupInactiveSessions(60);
    if (sessionsRemoved > 0) {
      console.log(`Cleaned up ${sessionsRemoved} inactive terminal sessions`);
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Initialize workspaces directory
workspaceManager.ensureWorkspacesDir().then(() => {
  console.log('Workspaces directory ready');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('✅ Terminal server ready');
  console.log('✅ Real-time terminal with node-pty enabled');
  if (dockerManager.isAvailable()) {
    console.log('✅ Docker sandbox available');
  } else {
    console.log('⚠️  Docker not available - using local file system');
  }
});
