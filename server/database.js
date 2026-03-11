const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs').promises;

class DatabaseService {
  constructor() {
    const dbPath = path.join(__dirname, '../database.sqlite');
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  initializeTables() {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Projects table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        problem_statement TEXT,
        tech_stack TEXT,
        user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        workspace_path TEXT,
        is_completed INTEGER DEFAULT 0,
        completion_validated_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Add problem_statement column if it doesn't exist (for existing databases)
    try {
      this.db.exec(`ALTER TABLE projects ADD COLUMN problem_statement TEXT`);
    } catch (e) {
      // Column already exists, ignore
    }
    
    // Add completion tracking columns if they don't exist
    try {
      this.db.exec(`ALTER TABLE projects ADD COLUMN is_completed INTEGER DEFAULT 0`);
    } catch (e) {
      // Column already exists, ignore
    }
    
    try {
      this.db.exec(`ALTER TABLE projects ADD COLUMN completion_validated_at DATETIME`);
    } catch (e) {
      // Column already exists, ignore
    }

    // Files table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content TEXT,
        is_directory INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(project_id, file_path)
      )
    `);

    // Dependencies table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dependencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        package_name TEXT NOT NULL,
        version TEXT,
        type TEXT DEFAULT 'dependency',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(project_id, package_name, type)
      )
    `);

    // Feedback table for learning system
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        file_path TEXT,
        feedback_type TEXT NOT NULL,
        feedback_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // Progress tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS progress_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        task_name TEXT NOT NULL,
        task_description TEXT,
        status TEXT DEFAULT 'pending',
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // Agent preferences table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        trigger_mode TEXT DEFAULT 'manual',
        preferences TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(project_id, user_id, agent_name)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
      CREATE INDEX IF NOT EXISTS idx_dependencies_project ON dependencies(project_id);
      CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_project ON feedback(project_id);
      CREATE INDEX IF NOT EXISTS idx_progress_tasks_project ON progress_tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_agent_preferences_project ON agent_preferences(project_id);
    `);
  }

  // ==================== Users ====================

  createUser(userData) {
    const { id, email, password, name } = userData;
    
    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, password, name)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(id, email, password, name || '');
    return this.getUser(id);
  }

  getUser(userId) {
    const stmt = this.db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?');
    return stmt.get(userId);
  }

  getUserByEmail(email) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  }

  // ==================== Projects ====================

  createProject(projectData) {
    const { id, name, description, problem_statement, tech_stack, user_id, workspace_path } = projectData;
    
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, description, problem_statement, tech_stack, user_id, workspace_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, name, description || '', problem_statement || '', tech_stack || '', user_id || 'default', workspace_path);
    return this.getProject(id);
  }

  getProject(projectId) {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    return stmt.get(projectId);
  }

  getAllProjects(userId = 'default') {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC');
    return stmt.all(userId);
  }

  updateProject(projectId, updates) {
    const fields = [];
    const values = [];
    
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.problem_statement !== undefined) {
      fields.push('problem_statement = ?');
      values.push(updates.problem_statement);
    }
    if (updates.tech_stack !== undefined) {
      fields.push('tech_stack = ?');
      values.push(updates.tech_stack);
    }
    if (updates.is_completed !== undefined) {
      fields.push('is_completed = ?');
      values.push(updates.is_completed ? 1 : 0);
    }
    if (updates.completion_validated_at !== undefined) {
      fields.push('completion_validated_at = ?');
      values.push(updates.completion_validated_at);
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(projectId);
    
    const stmt = this.db.prepare(`
      UPDATE projects 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    
    stmt.run(...values);
    return this.getProject(projectId);
  }

  deleteProject(projectId) {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    return stmt.run(projectId);
  }

  // ==================== Files ====================

  createFile(projectId, filePath, content = '', isDirectory = false) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO files (project_id, file_path, content, is_directory, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(projectId, filePath, content, isDirectory ? 1 : 0);
    return this.getFile(projectId, filePath);
  }

  getFile(projectId, filePath) {
    const stmt = this.db.prepare('SELECT * FROM files WHERE project_id = ? AND file_path = ?');
    return stmt.get(projectId, filePath);
  }

  getFilesByProject(projectId, directory = null) {
    if (directory && directory !== '') {
      const stmt = this.db.prepare(`
        SELECT * FROM files 
        WHERE project_id = ? 
        AND file_path LIKE ? 
        AND file_path NOT LIKE ?
        ORDER BY is_directory DESC, file_path
      `);
      // Match files in this directory (not in subdirectories)
      const pattern = directory.endsWith('/') ? `${directory}%` : `${directory}/%`;
      const excludePattern = `${pattern}/%/%`; // Exclude nested subdirectories
      return stmt.all(projectId, pattern, excludePattern);
    } else {
      // Get root level files (no / in path or only one level)
      const stmt = this.db.prepare(`
        SELECT * FROM files 
        WHERE project_id = ? 
        AND (file_path NOT LIKE '%/%' OR file_path NOT LIKE '%/%/%')
        ORDER BY is_directory DESC, file_path
      `);
      const allFiles = stmt.all(projectId);
      // Filter to only show root level (no parent directory)
      return allFiles.filter(file => {
        const parts = file.file_path.split('/');
        return parts.length === 1;
      });
    }
  }

  updateFile(projectId, filePath, content) {
    const stmt = this.db.prepare(`
      UPDATE files 
      SET content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE project_id = ? AND file_path = ?
    `);
    
    stmt.run(content, projectId, filePath);
    return this.getFile(projectId, filePath);
  }

  deleteFile(projectId, filePath) {
    // Delete file and all files in subdirectories if it's a directory
    const stmt = this.db.prepare(`
      DELETE FROM files 
      WHERE project_id = ? 
      AND (file_path = ? OR file_path LIKE ?)
    `);
    
    const pattern = filePath.endsWith('/') ? `${filePath}%` : `${filePath}/%`;
    return stmt.run(projectId, filePath, pattern);
  }

  // ==================== Dependencies ====================

  addDependency(projectId, packageName, version, type = 'dependency') {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO dependencies (project_id, package_name, version, type)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(projectId, packageName, version, type);
    return this.getDependency(projectId, packageName, type);
  }

  getDependency(projectId, packageName, type = 'dependency') {
    const stmt = this.db.prepare(`
      SELECT * FROM dependencies 
      WHERE project_id = ? AND package_name = ? AND type = ?
    `);
    return stmt.get(projectId, packageName, type);
  }

  getDependencies(projectId) {
    const stmt = this.db.prepare(`
      SELECT * FROM dependencies 
      WHERE project_id = ?
      ORDER BY type, package_name
    `);
    return stmt.all(projectId);
  }

  removeDependency(projectId, packageName, type = 'dependency') {
    const stmt = this.db.prepare(`
      DELETE FROM dependencies 
      WHERE project_id = ? AND package_name = ? AND type = ?
    `);
    return stmt.run(projectId, packageName, type);
  }

  // ==================== Sync with File System ====================

  async syncProjectToFileSystem(projectId) {
    const project = this.getProject(projectId);
    if (!project || !project.workspace_path) {
      throw new Error('Project or workspace path not found');
    }

    const workspacePath = project.workspace_path;
    await fs.mkdir(workspacePath, { recursive: true });

    // Get all files for the project
    const stmt = this.db.prepare('SELECT * FROM files WHERE project_id = ?');
    const files = stmt.all(projectId);

    // Write files to file system
    for (const file of files) {
      if (file.is_directory) {
        await fs.mkdir(path.join(workspacePath, file.file_path), { recursive: true });
      } else {
        const filePath = path.join(workspacePath, file.file_path);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, file.content || '', 'utf8');
      }
    }

    // Sync package.json if dependencies exist
    const dependencies = this.getDependencies(projectId);
    if (dependencies.length > 0) {
      const packageJson = {
        name: project.name.toLowerCase().replace(/\s+/g, '-'),
        version: '1.0.0',
        description: project.description || '',
        dependencies: {},
        devDependencies: {},
      };

      for (const dep of dependencies) {
        if (dep.type === 'devDependency') {
          packageJson.devDependencies[dep.package_name] = dep.version || 'latest';
        } else {
          packageJson.dependencies[dep.package_name] = dep.version || 'latest';
        }
      }

      const packageJsonPath = path.join(workspacePath, 'package.json');
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
    }
  }

  async syncFileSystemToDatabase(projectId) {
    const project = this.getProject(projectId);
    if (!project || !project.workspace_path) {
      return;
    }

    const workspacePath = project.workspace_path;

    // Check if directory exists
    try {
      await fs.access(workspacePath);
    } catch (error) {
      console.log(`Workspace path does not exist: ${workspacePath}`);
      return;
    }

    async function scanDirectory(dirPath, relativePath = '') {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          // Skip node_modules and other common ignore directories
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') {
            continue;
          }

          const fullPath = path.join(dirPath, entry.name);
          const filePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            // Create directory record
            this.createFile(projectId, filePath, '', true);
            // Recursively scan subdirectory
            await scanDirectory.call(this, fullPath, filePath);
          } else {
            // Read file content and create file record
            try {
              const content = await fs.readFile(fullPath, 'utf8');
              this.createFile(projectId, filePath, content, false);
            } catch (readError) {
              // If file can't be read (binary, etc.), create with empty content
              this.createFile(projectId, filePath, '', false);
            }
          }
        }
      } catch (error) {
        console.error(`Error scanning directory ${dirPath}:`, error.message);
      }
    }

    try {
      await scanDirectory.call(this, workspacePath);
      console.log(`Synced file system to database for project ${projectId}`);
    } catch (error) {
      console.error('Error syncing file system to database:', error);
    }
  }

  // ==================== Feedback & Learning ====================

  createFeedback(feedbackData) {
    const { project_id, file_path, feedback_type, feedback_data } = feedbackData;
    const stmt = this.db.prepare(`
      INSERT INTO feedback (project_id, file_path, feedback_type, feedback_data)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(project_id, file_path || null, feedback_type, JSON.stringify(feedback_data));
    return this.getFeedback(this.db.lastInsertRowid);
  }

  getFeedback(feedbackId) {
    const stmt = this.db.prepare('SELECT * FROM feedback WHERE id = ?');
    const feedback = stmt.get(feedbackId);
    if (feedback) {
      feedback.feedback_data = JSON.parse(feedback.feedback_data);
    }
    return feedback;
  }

  getFeedbackByProject(projectId) {
    const stmt = this.db.prepare('SELECT * FROM feedback WHERE project_id = ? ORDER BY created_at DESC');
    const feedbacks = stmt.all(projectId);
    return feedbacks.map(f => ({
      ...f,
      feedback_data: JSON.parse(f.feedback_data)
    }));
  }

  // ==================== Progress Tracking ====================

  createProgressTask(taskData) {
    const { project_id, task_name, task_description, status } = taskData;
    const stmt = this.db.prepare(`
      INSERT INTO progress_tasks (project_id, task_name, task_description, status)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(project_id, task_name, task_description || '', status || 'pending');
    return this.getProgressTask(this.db.lastInsertRowid);
  }

  getProgressTask(taskId) {
    const stmt = this.db.prepare('SELECT * FROM progress_tasks WHERE id = ?');
    return stmt.get(taskId);
  }

  getProgressTasksByProject(projectId) {
    const stmt = this.db.prepare('SELECT * FROM progress_tasks WHERE project_id = ? ORDER BY created_at ASC');
    return stmt.all(projectId);
  }

  updateProgressTask(taskId, updates) {
    const fields = [];
    const values = [];
    
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
      if (updates.status === 'completed') {
        fields.push('completed_at = CURRENT_TIMESTAMP');
      }
    }
    if (updates.task_name !== undefined) {
      fields.push('task_name = ?');
      values.push(updates.task_name);
    }
    if (updates.task_description !== undefined) {
      fields.push('task_description = ?');
      values.push(updates.task_description);
    }
    
    values.push(taskId);
    
    const stmt = this.db.prepare(`
      UPDATE progress_tasks 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    stmt.run(...values);
    return this.getProgressTask(taskId);
  }

  // ==================== Agent Preferences ====================

  setAgentPreference(preferenceData) {
    const { project_id, user_id, agent_name, enabled, trigger_mode, preferences } = preferenceData;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO agent_preferences (project_id, user_id, agent_name, enabled, trigger_mode, preferences, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(project_id, user_id, agent_name, enabled ? 1 : 0, trigger_mode || 'manual', JSON.stringify(preferences || {}));
    return this.getAgentPreference(project_id, user_id, agent_name);
  }

  getAgentPreference(projectId, userId, agentName) {
    const stmt = this.db.prepare('SELECT * FROM agent_preferences WHERE project_id = ? AND user_id = ? AND agent_name = ?');
    const pref = stmt.get(projectId, userId, agentName);
    if (pref) {
      pref.preferences = JSON.parse(pref.preferences);
    }
    return pref;
  }

  getAgentPreferencesByProject(projectId, userId) {
    const stmt = this.db.prepare('SELECT * FROM agent_preferences WHERE project_id = ? AND user_id = ?');
    const prefs = stmt.all(projectId, userId);
    return prefs.map(p => ({
      ...p,
      preferences: JSON.parse(p.preferences)
    }));
  }
}

module.exports = new DatabaseService();

